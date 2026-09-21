'use client'

// ============================================================================
//  lib/data/cambios-api.ts — Control de cambios con desbloqueo.
//  OJO: esto es solo la cara del cliente. Quien decide si un cambio pasa es el
//  servidor (lib/server/cambios.ts): aquí no hay ninguna comprobación en la que
//  confiar, solo la UX de pedir la contraseña y reintentar.
// ============================================================================

import { MENSAJE_DESBLOQUEO } from '@/lib/cambios-mensajes'

const API = '/spaces-dooh/api'

export interface EstadoCambios {
  activo: boolean
  requiere: boolean
  desbloqueadoHasta: string | null
  minutos: number
  tieneContrasenaCompartida: boolean
}

export async function estadoCambiosApi(): Promise<EstadoCambios> {
  const r = await fetch(`${API}/cambios/`, { cache: 'no-store' })
  if (!r.ok) throw new Error('No se pudo leer el control de cambios')
  return r.json()
}

// Enciende o apaga la exigencia de reautenticación. Solo el Dueño (lo exige el
// servidor). Es un interruptor aparte de la contraseña compartida — ver
// `fijarContrasenaCambiosApi` — se puede encender sin haber asignado ninguna.
export async function fijarExigirReautenticacionApi(activo: boolean): Promise<void> {
  const r = await fetch(`${API}/cambios/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo guardar')
}

// Asigna o rota la contraseña compartida del candado de cambios (ADR 0036).
// Solo el Dueño. Independiente del interruptor de arriba.
export async function fijarContrasenaCambiosApi(password: string): Promise<void> {
  const r = await fetch(`${API}/cambios/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo asignar la contraseña')
}

// Restablece la contraseña de OTRO usuario. Devuelve la temporal, que se enseña
// UNA sola vez: no se puede volver a consultar.
export async function restablecerPasswordApi(
  usuarioId: string,
): Promise<{ temporal: string; usuario: { nombre: string } }> {
  const r = await fetch(`${API}/usuarios/${usuarioId}/restablecer/`, { method: 'POST' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo restablecer')
  return d
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
// existentes lanzan Error(d.error), así que se pierde esa marca; por eso se
// detecta por el mensaje. La constante es COMPARTIDA con el servidor
// (@/lib/cambios-mensajes) para que no puedan divergir: cuando estaban
// duplicadas, cambiar el texto en un lado dejaba al usuario con un error rojo
// en vez del modal, sin forma de continuar.
export { MENSAJE_DESBLOQUEO }

export function esErrorDeDesbloqueo(e: unknown): boolean {
  return e instanceof Error && e.message === MENSAJE_DESBLOQUEO
}
