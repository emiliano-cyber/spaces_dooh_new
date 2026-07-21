'use client'

// ============================================================================
//  lib/data/cambios-api.ts — Control de cambios con desbloqueo.
//  OJO: esto es solo la cara del cliente. Quien decide si un cambio pasa es el
//  servidor (lib/server/cambios.ts): aquí no hay ninguna comprobación en la que
//  confiar, solo la UX de pedir la contraseña y reintentar.
// ============================================================================

const API = '/spaces-dooh/api'

export interface EstadoCambios {
  activo: boolean
  requiere: boolean
  desbloqueadoHasta: string | null
  minutos: number
}

export async function estadoCambiosApi(): Promise<EstadoCambios> {
  const r = await fetch(`${API}/cambios/`, { cache: 'no-store' })
  if (!r.ok) throw new Error('No se pudo leer el control de cambios')
  return r.json()
}

// password null = quitar el control. Solo el Dueño (lo exige el servidor).
export async function fijarPasswordCambiosApi(password: string | null): Promise<void> {
  const r = await fetch(`${API}/cambios/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo guardar')
}

export async function desbloquearApi(password: string): Promise<{ hasta: string }> {
  const r = await fetch(`${API}/cambios/desbloquear/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo desbloquear')
  return d
}

export async function bloquearApi(): Promise<void> {
  await fetch(`${API}/cambios/desbloquear/`, { method: 'DELETE' })
}

// ─── Cómo la UI reconoce "falta desbloquear" ────────────────────────────────
// El servidor responde 403 con { requiereDesbloqueo: true }. Los clientes API ya
// existentes lanzan Error(d.error), así que se pierde esa marca; por eso el
// mensaje del servidor es reconocible y aquí se detecta por él.
export const MENSAJE_DESBLOQUEO = 'Este cambio necesita la contraseña del Dueño.'

export function esErrorDeDesbloqueo(e: unknown): boolean {
  return e instanceof Error && e.message === MENSAJE_DESBLOQUEO
}
