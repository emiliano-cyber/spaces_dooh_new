// ============================================================================
//  lib/propuestas-periodo.ts — El tablero de propuestas por periodo (PROP-PER).
// ----------------------------------------------------------------------------
//  Pedido del dueño el 06/10: aprobadas, ganancia por aprobada, rechazadas y
//  generadas, por lapsos de tiempo. PURO, para que la ruta, la pantalla y las
//  pruebas cuenten igual. El periodo lo resuelve `lib/finanzas-periodo.ts`
//  (`periodoDe`): mismo selector y mismas reglas que Finanzas.
//
//  Cada cosa por SU fecha:
//  · GENERADAS: creadas en el periodo, acaben como acaben.
//  · APROBADAS: con `aprobada_en` en el periodo. Las anteriores a la migración
//    del 06/10 la tienen de cuando se congeló su precio (que es al aprobar).
//  · RECHAZADAS: con `rechazada_en` en el periodo. Las anteriores a la
//    migración NO tienen fecha y no caen en ningún periodo: no se inventa.
//  · TASA DE CIERRE: aprobadas / (aprobadas + rechazadas) del periodo.
//
//  GANANCIA = venta − renta de las pantallas (decisión del dueño, 06/10). La
//  venta es el NETO congelado al aprobar (sin IVA, después de comisión); la
//  renta, la de cada pantalla aprobada por los meses de calendario de sus
//  fechas. Una aprobada con alguna pantalla sin renta capturada cuenta en la
//  venta pero NO en la ganancia (`sinCosto`): suponerle costo 0 inflaría el
//  margen, que es el fallo que `montoMensualEquivalente` ya documenta.
//
//  El costo y la ganancia solo viajan con `conGanancia` (permiso
//  `finanzas.ver`): quien vende ve cuánto vende, no cuánto cuesta la pantalla.
// ============================================================================

import type { Periodo } from './finanzas-periodo'

export interface PropuestaP {
  id: string
  folio: string
  nombre: string
  estatus: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA'
  /** AAAA-MM-DD */
  creada: string
  aprobada: string | null
  rechazada: string | null
  vendedorId: string | null
  vendedor: string | null
  /** Neto congelado al aprobar (sin IVA). null si no hay precio congelado. */
  venta: number | null
  /** Renta de las pantallas por el periodo de la propuesta. null = falta capturar alguna. */
  costoRenta: number | null
}

export interface FilaAprobada {
  id: string
  folio: string
  nombre: string
  vendedor: string | null
  aprobada: string
  venta: number | null
  costoRenta: number | null
  ganancia: number | null
}

export interface ResumenPropuestas {
  generadas: number
  aprobadas: {
    n: number
    venta: number
    costo: number | null
    ganancia: number | null
    gananciaPromedio: number | null
    margenPct: number | null
    /** Aprobadas sin renta capturada en alguna pantalla: fuera de la ganancia. */
    sinCosto: number
  }
  rechazadas: number
  tasaCierre: number | null
  porVendedor: { vendedor: string; generadas: number; aprobadas: number; rechazadas: number; venta: number; ganancia: number | null }[]
  lista: FilaAprobada[]
}

const r2 = (v: number) => Math.round(v * 100) / 100
const en = (dia: string | null, p: Periodo) => dia !== null && dia >= p.desde && dia <= p.hasta

export function resumirPropuestas(props: PropuestaP[], p: Periodo, conGanancia: boolean): ResumenPropuestas {
  const generadas = props.filter((x) => en(x.creada, p))
  const aprobadas = props.filter((x) => x.estatus === 'APROBADA' && en(x.aprobada, p))
  const rechazadas = props.filter((x) => x.estatus === 'RECHAZADA' && en(x.rechazada, p))

  const conCosto = aprobadas.filter((x) => x.costoRenta !== null && x.venta !== null)
  const venta = r2(aprobadas.reduce((s, x) => s + (x.venta ?? 0), 0))
  const ventaConCosto = conCosto.reduce((s, x) => s + (x.venta as number), 0)
  const costo = r2(conCosto.reduce((s, x) => s + (x.costoRenta as number), 0))
  const ganancia = r2(ventaConCosto - costo)

  const ganDe = (x: PropuestaP) =>
    conGanancia && x.costoRenta !== null && x.venta !== null ? r2(x.venta - x.costoRenta) : null

  // Por vendedor: lo de cada quien EN el periodo, con la misma regla de fechas.
  const nombres = new Map<string, string>()
  for (const x of [...generadas, ...aprobadas, ...rechazadas]) nombres.set(x.vendedorId ?? '—', x.vendedor ?? 'Sin vendedor')
  const porVendedor = [...nombres.entries()]
    .map(([id, vendedor]) => {
      const mio = (x: PropuestaP) => (x.vendedorId ?? '—') === id
      const aps = aprobadas.filter(mio)
      const ganancias = aps.map(ganDe).filter((g): g is number => g !== null)
      return {
        vendedor,
        generadas: generadas.filter(mio).length,
        aprobadas: aps.length,
        rechazadas: rechazadas.filter(mio).length,
        venta: r2(aps.reduce((s, x) => s + (x.venta ?? 0), 0)),
        ganancia: conGanancia ? r2(ganancias.reduce((s, g) => s + g, 0)) : null,
      }
    })
    .sort((a, b) => b.venta - a.venta || b.aprobadas - a.aprobadas)

  // Las aprobadas del periodo: de más a menos ganancia; sin costo, al final.
  const lista: FilaAprobada[] = aprobadas
    .map((x) => ({
      id: x.id,
      folio: x.folio,
      nombre: x.nombre,
      vendedor: x.vendedor,
      aprobada: x.aprobada as string,
      venta: x.venta,
      costoRenta: conGanancia ? x.costoRenta : null,
      ganancia: ganDe(x),
    }))
    .sort((a, b) => (b.ganancia ?? -Infinity) - (a.ganancia ?? -Infinity) || (b.venta ?? 0) - (a.venta ?? 0))

  const decididas = aprobadas.length + rechazadas.length
  return {
    generadas: generadas.length,
    aprobadas: {
      n: aprobadas.length,
      venta,
      costo: conGanancia ? costo : null,
      ganancia: conGanancia ? ganancia : null,
      gananciaPromedio: conGanancia && conCosto.length > 0 ? r2(ganancia / conCosto.length) : null,
      margenPct: conGanancia && ventaConCosto > 0 ? (ganancia / ventaConCosto) * 100 : null,
      sinCosto: aprobadas.length - conCosto.length,
    },
    rechazadas: rechazadas.length,
    tasaCierre: decididas > 0 ? aprobadas.length / decididas : null,
    porVendedor,
    lista,
  }
}
