import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { filasPropuestasResumen } from './propuestas-resumen-repo'
import { hoyDeLaBase } from './finanzas-repo'
import { listarSitios } from './sitios-repo'
import { listarContratos } from './arrendadores-repo'
import { periodoDe, type TipoPeriodo } from '@/lib/finanzas-periodo'
import { resumirPropuestas, type PropuestaP } from '@/lib/propuestas-periodo'
import { contratoVigentePorSitio, rentaAtribuidaPorSitio, type DatosAtribucion } from '@/lib/data/derive'
import { periodosEnRango } from '@/lib/periodos'

// ============================================================================
//  lib/server/propuestas-resumen-controller.ts — El tablero de propuestas por
//  periodo (PROP-PER, 06/10). No conoce HTTP.
//
//  LA RENTA SALE DEL CONTRATO, no del campo opcional de la propuesta. Es la
//  misma fuente que `margenCampana` y los reportes (`rentaAtribuidaPorSitio`,
//  que además reparte la renta de un predio entre sus pantallas): una segunda
//  cuenta de la renta daría dos márgenes distintos para la misma pantalla. Se
//  multiplica por los MESES DE CALENDARIO de cada pantalla aprobada
//  (`periodosEnRango('mensual')`), la misma cuenta con la que se cobra.
//
//  Una pantalla sin contrato vigente no tiene costo CONOCIDO: la propuesta
//  queda «sin costo» y fuera de la ganancia, en vez de sumarle 0. Y el contrato
//  es el VIGENTE HOY, no el de las fechas de la propuesta: es la aproximación
//  que hacen también los reportes.
// ============================================================================

const TIPOS: TipoPeriodo[] = ['mes', 'mes-anterior', 'trimestre', 'trimestre-anterior', 'anio', 'rango']
const schema = z.object({
  periodo: z.enum(TIPOS as [TipoPeriodo, ...TipoPeriodo[]], { errorMap: () => ({ message: 'Periodo inválido' }) }),
  desde: z.string().optional(),
  hasta: z.string().optional(),
})

// `conGanancia` lo decide la ruta con el permiso de la SESIÓN (`finanzas.ver`):
// sin él no se lee ni un contrato.
export async function resumenPropuestasCtrl(query: Record<string, string | undefined>, conGanancia: boolean) {
  const d = validar(schema, query)
  const hoy = await hoyDeLaBase()
  let periodo
  try {
    periodo = periodoDe(d.periodo, hoy, { desde: d.desde, hasta: d.hasta })
  } catch (e) {
    throw new AppError(e instanceof Error ? e.message : 'Periodo inválido', 400)
  }

  const { propuestas, items } = await filasPropuestasResumen()
  const costoDe = conGanancia ? await costosDeRenta(items) : new Map<string, number | null>()

  const props: PropuestaP[] = propuestas.map((p) => ({
    id: p.id,
    folio: p.folio ?? '—',
    nombre: p.nombre,
    estatus: p.estatus,
    creada: p.creada,
    aprobada: p.aprobada,
    rechazada: p.rechazada,
    vendedorId: p.vendedorId,
    vendedor: p.vendedor,
    venta: p.venta,
    costoRenta: conGanancia ? (costoDe.get(p.id) ?? null) : null,
  }))

  return { periodo, hoy, conGanancia, resumen: resumirPropuestas(props, periodo, conGanancia) }
}

async function costosDeRenta(
  items: { propuestaId: string; sitioId: string; fechaInicio: string; fechaFin: string }[],
): Promise<Map<string, number | null>> {
  const [sitios, contratos] = await Promise.all([listarSitios(), listarContratos()])
  // Son las MISMAS filas que `/api/estado` manda al store y sobre las que el
  // navegador corre estas dos funciones; el tipo del repo es más ancho que el
  // del store y TypeScript no los iguala. Lo que las funciones leen —sitioId,
  // predioId, estatus, fechas, montoRenta, periodicidad, caras— sí viene
  // (`arrendadores-repo.ts:190`, `sitios-repo.ts:61,92`).
  const estado = { sitios, contratos } as unknown as DatosAtribucion
  const vigente = contratoVigentePorSitio(estado)
  const mensual = rentaAtribuidaPorSitio(estado)
  const out = new Map<string, number | null>()
  for (const it of items) {
    if (out.get(it.propuestaId) === null) continue // ya sin costo conocido
    if (!vigente.has(it.sitioId)) {
      out.set(it.propuestaId, null)
      continue
    }
    const meses = periodosEnRango('mensual', it.fechaInicio, it.fechaFin) ?? 0
    const costo = (mensual.get(it.sitioId) ?? 0) * meses
    out.set(it.propuestaId, Math.round(((out.get(it.propuestaId) ?? 0) + costo) * 100) / 100)
  }
  return out
}
