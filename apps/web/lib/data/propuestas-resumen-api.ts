'use client'

import type { Periodo, TipoPeriodo } from '@/lib/finanzas-periodo'
import type { ResumenPropuestas } from '@/lib/propuestas-periodo'
import type { ProspectosNuevos } from '@/lib/prospectos-nuevos'

// ============================================================================
//  lib/data/propuestas-resumen-api.ts — El tablero de propuestas por periodo
//  (PROP-PER, 06/10). Las cuentas las hace el servidor; aquí solo se piden.
// ============================================================================

const API = '/spaces-dooh/api'

export interface RespuestaResumenPropuestas {
  periodo: Periodo & { etiqueta: string }
  hoy: string
  /** false = la sesión no ve finanzas: costo y ganancia vienen en null. */
  conGanancia: boolean
  resumen: ResumenPropuestas
  /** 19/11 · los de la última semana, con la misma regla de quién ve qué. */
  prospectosNuevos: ProspectosNuevos
}

export async function resumenPropuestasApi(opts: {
  periodo: TipoPeriodo
  desde?: string
  hasta?: string
}): Promise<RespuestaResumenPropuestas> {
  const q = new URLSearchParams({ periodo: opts.periodo })
  if (opts.periodo === 'rango') {
    if (opts.desde) q.set('desde', opts.desde)
    if (opts.hasta) q.set('hasta', opts.hasta)
  }
  const r = await fetch(`${API}/propuestas/resumen/?${q}`, { cache: 'no-store' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo calcular el tablero de propuestas')
  return d as RespuestaResumenPropuestas
}
