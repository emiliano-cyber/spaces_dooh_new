'use client'

// ============================================================================
//  lib/data/actualizaciones-api.ts — Actualizacion elegida por instancia.
//  ADR 0037. El tipo vive aqui (y no en lib/server/) porque lo consume un
//  componente de CLIENTE (tarea 4): si viviera en lib/server/ arrastraria `pg`
//  al bundle del navegador, igual que lib/data/cambios-api.ts.
// ============================================================================

export interface EstadoActualizacion {
  modo: 'automatica' | 'aprobacion'
  versionInstalada: string | null
  versionDisponible: string | null
  digestDisponible: string | null
  migracionesPendientes: number | null
  comprobadoEn: string | null
  aprobadoDigest: string | null
  // digestDisponible existe y es distinto del instalado (lo calcula el
  // servidor; ver `route.ts:aEstado`, no se recalcula aqui).
  hayNovedad: boolean
}
