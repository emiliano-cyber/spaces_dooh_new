// ============================================================================
//  lib/crm-cotejo.ts — El cotejo por cliente (CRM, Fase 1 del ADR 0051, 17/11).
// ----------------------------------------------------------------------------
//  Pedido del dueño: ver por cliente cuántas cotizaciones lleva, cuánto tiempo
//  llevamos negociando y cuánto dinero hay en juego. La Fase 1 lo saca SOLO de
//  lo que ya trae `GET /api/propuestas` —sin migración y sin ruta nueva—. El
//  presupuesto del cliente (Fase 2) y el historial campo por campo (Fase 3)
//  todavía no existen, y esta función no los finge.
//
//  Decisiones, con su porqué:
//
//  · Los días se cuentan con MARCAS DE TIEMPO, no con fechas de calendario.
//    El navegador no conoce la zona del negocio (`zonaDelNegocio()` lee `TZ`
//    del servidor), y convertir a «día» con la zona del navegador daría un día
//    de más o de menos según quién mire. Contar 24 h enteras no depende de eso.
//  · Con todo cerrado, el reloj se PARA en la última decisión: un cliente que
//    aprobó hace un año no lleva «400 días negociando». Si las cerradas no
//    tienen fecha (lo aprobado antes del 09/10, `20261009_propuestas_fechas_
//    estatus.sql`), se devuelve null: inventar la fecha es peor que no darla.
//  · El dinero va en TOTAL CON IVA, la misma base que las tarjetas de arriba de
//    la pantalla (`funnelPropuestas`, «en vuelo»). Lo ganado es
//    `totalAprobado` —solo los sitios aprobados—, que es lo que se vendió.
//  · Se agrupa por `clienteId` (el anunciante), no por la agencia. Las de sin
//    cliente van juntas con `clienteId: null`.
// ============================================================================

import type { EstPropuesta } from '@/lib/data/client'

/** Lo mínimo de una `Propuesta` que el cotejo lee. */
export interface PropuestaCotejo {
  id: string
  folio: string
  nombre: string
  clienteId: string | null
  estatus: EstPropuesta
  version: number
  creadoEn: string
  aprobadaEn?: string | null
  rechazadaEn?: string | null
  vendedorId?: string | null
  vendedorNombre?: string | null
  total: number
  totalAprobado: number
  vencida?: boolean
}

export interface CotejoCliente {
  clienteId: string | null
  cotizaciones: number
  porEstatus: Record<EstPropuesta, number>
  /** Σ (version − 1): cuántas veces se renegoció alguna de sus propuestas. */
  renegociaciones: number
  /** Hay algún BORRADOR o ENVIADA. */
  abierta: boolean
  /** ENVIADAS cuya vigencia ya pasó: siguen abiertas, pero hay que renovarlas. */
  vencidas: number
  primeraEn: string
  /** La fecha más reciente entre creación, aprobación y rechazo. */
  ultimaActividadEn: string
  /** Días enteros desde la primera cotización; null si no se puede saber. */
  diasNegociando: number | null
  /** Total con IVA de BORRADOR + ENVIADA. */
  enJuego: number
  /** Total con IVA de lo aprobado en las APROBADAS. */
  ganado: number
  tasaCierre: number | null
  /** Nombres de quienes le han cotizado, sin repetir, en orden de aparición. */
  vendedores: string[]
  /** Sus cotizaciones, de la más nueva a la más vieja. */
  propuestas: PropuestaCotejo[]
}

const DIA_MS = 24 * 60 * 60 * 1000

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const v = Date.parse(iso)
  return Number.isNaN(v) ? null : v
}

export function cotejoPorCliente(propuestas: PropuestaCotejo[], ahora: Date = new Date()): CotejoCliente[] {
  const grupos = new Map<string | null, PropuestaCotejo[]>()
  for (const p of propuestas) {
    const k = p.clienteId ?? null
    const arr = grupos.get(k) ?? []
    arr.push(p)
    grupos.set(k, arr)
  }

  const out: CotejoCliente[] = []
  for (const [clienteId, ps] of grupos) {
    const orden = [...ps].sort((a, b) => (ms(b.creadoEn) ?? 0) - (ms(a.creadoEn) ?? 0))
    const porEstatus: Record<EstPropuesta, number> = { BORRADOR: 0, ENVIADA: 0, APROBADA: 0, RECHAZADA: 0 }
    let renegociaciones = 0
    let vencidas = 0
    let enJuego = 0
    let ganado = 0
    let ultimaDecision: number | null = null
    let decisionSinFecha = false
    let ultimaActividad = -Infinity
    let ultimaActividadEn = orden[0].creadoEn
    const vendedores: string[] = []

    for (const p of orden) {
      porEstatus[p.estatus]++
      renegociaciones += Math.max(0, (p.version ?? 1) - 1)
      if (p.estatus === 'BORRADOR' || p.estatus === 'ENVIADA') enJuego += p.total
      if (p.estatus === 'ENVIADA' && p.vencida) vencidas++
      if (p.estatus === 'APROBADA') ganado += p.totalAprobado

      if (p.estatus === 'APROBADA' || p.estatus === 'RECHAZADA') {
        const d = ms(p.estatus === 'APROBADA' ? p.aprobadaEn : p.rechazadaEn)
        if (d == null) decisionSinFecha = true
        else if (ultimaDecision == null || d > ultimaDecision) ultimaDecision = d
      }

      for (const f of [p.creadoEn, p.aprobadaEn, p.rechazadaEn]) {
        const v = ms(f)
        if (v != null && v > ultimaActividad) {
          ultimaActividad = v
          ultimaActividadEn = f as string
        }
      }

      const nombre = p.vendedorNombre?.trim()
      if (nombre && !vendedores.includes(nombre)) vendedores.push(nombre)
    }

    const primera = orden[orden.length - 1]
    const inicio = ms(primera.creadoEn)
    const abierta = porEstatus.BORRADOR + porEstatus.ENVIADA > 0
    let fin: number | null
    if (abierta) fin = ahora.getTime()
    else fin = decisionSinFecha ? null : ultimaDecision
    const diasNegociando = inicio != null && fin != null ? Math.max(0, Math.floor((fin - inicio) / DIA_MS)) : null

    const cerradas = porEstatus.APROBADA + porEstatus.RECHAZADA
    out.push({
      clienteId,
      cotizaciones: orden.length,
      porEstatus,
      renegociaciones,
      abierta,
      vencidas,
      primeraEn: primera.creadoEn,
      ultimaActividadEn,
      diasNegociando,
      enJuego,
      ganado,
      tasaCierre: cerradas > 0 ? porEstatus.APROBADA / cerradas : null,
      vendedores,
      propuestas: orden,
    })
  }

  return out.sort((a, b) => {
    if (a.abierta !== b.abierta) return a.abierta ? -1 : 1
    return (ms(b.ultimaActividadEn) ?? 0) - (ms(a.ultimaActividadEn) ?? 0)
  })
}
