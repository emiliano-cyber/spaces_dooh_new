'use client'

import type { Movimiento, Periodo, ResumenPeriodo, TipoPeriodo } from '@/lib/finanzas-periodo'

// ============================================================================
//  lib/data/finanzas-periodo-api.ts — El tablero y el estado de cuenta de
//  Finanzas por periodo (ADR 0046). Las cuentas las hace el servidor con
//  `lib/finanzas-periodo.ts`; aquí solo se piden.
// ============================================================================

const API = '/spaces-dooh/api'

export interface RespuestaResumen {
  periodo: Periodo & { etiqueta: string }
  hoy: string
  resumen: ResumenPeriodo
  movimientos: Movimiento[]
}

export async function resumenFinanzasApi(opts: {
  periodo: TipoPeriodo
  desde?: string
  hasta?: string
  cliente?: string | null
}): Promise<RespuestaResumen> {
  const q = new URLSearchParams({ periodo: opts.periodo })
  if (opts.periodo === 'rango') {
    if (opts.desde) q.set('desde', opts.desde)
    if (opts.hasta) q.set('hasta', opts.hasta)
  }
  if (opts.cliente) q.set('cliente', opts.cliente)
  const r = await fetch(`${API}/finanzas/resumen/?${q}`, { cache: 'no-store' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo calcular el periodo')
  return d as RespuestaResumen
}
