import 'server-only'
import { AppError } from '../errores'
import { consumosPorServicios } from '../energia-repo'
import { interpretarRecibo } from './interprete'
import { leerPaginasDePdf } from './lector-pdf'
import { construirPropuesta, type ConsumoYaCapturado, type PropuestaDeRecibo } from './propuesta'

// ============================================================================
//  lib/server/recibos-cfe/controller.ts — Subir PDF y PROPONER lo que dicen.
// ----------------------------------------------------------------------------
//  **ESTE ARCHIVO NO ESCRIBE NADA.** Lee PDF, consulta el historial y devuelve
//  propuestas. Guardar sigue siendo `POST /api/energia/consumos`, renglon a
//  renglon y con una persona dandole a confirmar.
//
//  Es la decision de diseño mas importante del modulo y conviene tener escrito
//  por que: un recibo mal leido que se guarda solo mete un costo falso en el
//  reporte de rentabilidad, y **ahi ya no se distingue de uno bueno**. No hay
//  marca que lo delate, no hay error, y el margen sale peor o mejor de lo que
//  es sin que nadie pueda saber por que. Reusar el endpoint de alta que ya
//  existe —con su validacion, su indice unico y su `registrarAccion`— cuesta
//  una peticion por renglon y no abre un segundo camino de escritura que
//  habria que auditar aparte.
//
//  ─── POR QUE TODOS LOS ARCHIVOS EN UNA SOLA PETICION ────────────────────
//  Hay 72 recibos que subir. De uno en uno es una tarde. Y una sola consulta al
//  historial sirve para todos: `consumosPorServicios` recibe los numeros de
//  servicio de TODOS los PDF de la tanda, que es lo que evita el N+1 —una
//  consulta por archivo— con 72 archivos delante.
// ============================================================================

/** Cuantos PDF se admiten en una tanda. */
export const MAXIMO_ARCHIVOS = 40

export interface ArchivoSubido {
  nombre: string
  datos: Uint8Array
}

export interface RespuestaRecibos {
  propuestas: PropuestaDeRecibo[]
  /** Cuantos se leyeron como recibo de CFE, de cuantos se subieron. */
  leidos: number
  total: number
}

export async function interpretarRecibosCtrl(
  archivos: ArchivoSubido[],
): Promise<RespuestaRecibos> {
  if (archivos.length === 0) throw new AppError('No llego ningun archivo.', 400)
  if (archivos.length > MAXIMO_ARCHIVOS) {
    throw new AppError(
      `Son ${archivos.length} archivos y el maximo por tanda es ${MAXIMO_ARCHIVOS}. ` +
        'Subelos en varias veces.',
      400,
    )
  }

  // Los PDF se leen EN SERIE y no con `Promise.all`. Cada lectura monta un
  // documento de pdf.js en memoria; 40 a la vez es un pico de memoria que en la
  // instancia de un cliente compite con todo lo demas que corre en ese droplet.
  const lecturas: { nombre: string; recibo: ReturnType<typeof interpretarRecibo> }[] = []
  for (const a of archivos) {
    try {
      const lineas = await leerPaginasDePdf(a.datos)
      lecturas.push({ nombre: a.nombre, recibo: interpretarRecibo(lineas) })
    } catch (e) {
      // Un archivo roto NO tumba la tanda: se anota como «no es un recibo» y los
      // otros 71 siguen. Si 40 archivos se perdieran porque uno venia mal, quien
      // los sube volveria a empezar sin saber cual era.
      lecturas.push({
        nombre: a.nombre,
        recibo: {
          ...interpretarRecibo([]),
          avisos: [e instanceof AppError ? e.message : 'No se pudo leer el archivo.'],
        },
      })
    }
  }

  // UNA sola consulta para toda la tanda.
  const servicios = [
    ...new Set(lecturas.map((l) => l.recibo.numeroServicio).filter((s): s is string => !!s)),
  ]
  const historial = await consumosPorServicios(servicios)

  const porServicio = new Map<string, ConsumoYaCapturado[]>()
  for (const c of historial) {
    if (!c.medidor) continue
    const lista = porServicio.get(c.medidor)
    const fila: ConsumoYaCapturado = {
      id: c.id,
      predioId: c.predioId,
      sitioId: c.sitioId,
      periodo: c.periodo,
      medidor: c.medidor,
      kwh: c.kwh,
      importe: c.importe,
    }
    if (lista) lista.push(fila)
    else porServicio.set(c.medidor, [fila])
  }

  const propuestas = lecturas.map((l) =>
    construirPropuesta(
      l.nombre,
      l.recibo,
      l.recibo.numeroServicio ? (porServicio.get(l.recibo.numeroServicio) ?? []) : [],
    ),
  )

  return {
    propuestas,
    leidos: propuestas.filter((p) => p.esRecibo).length,
    total: propuestas.length,
  }
}
