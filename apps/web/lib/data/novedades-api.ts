'use client'

import type { EntradaNovedades } from '@/lib/novedades'

// ============================================================================
//  lib/data/novedades-api.ts — Las notas de la version instalada.
//  El tipo se repite aqui (y no se importa de lib/server/) por el mismo motivo
//  que `actualizaciones-api.ts`: lib/server/ arrastraria codigo de servidor al
//  bundle del navegador.
// ============================================================================

export interface NovedadesDeLaInstancia {
  version: string | null
  notas: EntradaNovedades | null
  novedades: EntradaNovedades[]
}

export async function getNovedadesApi(): Promise<NovedadesDeLaInstancia> {
  const r = await fetch('/spaces-dooh/api/novedades/', { cache: 'no-store' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'Error')
  return d
}
