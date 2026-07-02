'use client'

import type { RolDemo, UsuarioDemo, ConfigNegocio } from './types'

// ============================================================================
//  lib/data/admin-api.ts — Administración contra la BD (usuarios, permisos,
//  configuración del negocio). basePath + trailingSlash.
// ============================================================================

const API = '/spaces-dooh/api'

async function jsonOk(r: Response) {
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'Error')
  return d
}

// ─── Usuarios ───────────────────────────────────────────────────────────────
export async function listarUsuariosApi(): Promise<UsuarioDemo[]> {
  const r = await fetch(`${API}/usuarios/`, { cache: 'no-store' })
  if (!r.ok) return []
  return r.json()
}
export async function invitarUsuarioApi(input: {
  nombre: string; email: string; cargo?: string; rol: RolDemo; password?: string
}): Promise<UsuarioDemo> {
  return jsonOk(
    await fetch(`${API}/usuarios/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}
export async function actualizarUsuarioApi(
  id: string,
  cambios: { rol?: RolDemo; activo?: boolean; nombre?: string; cargo?: string },
): Promise<UsuarioDemo> {
  return jsonOk(
    await fetch(`${API}/usuarios/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    }),
  )
}
export async function borrarUsuarioApi(id: string): Promise<void> {
  await jsonOk(await fetch(`${API}/usuarios/${id}/`, { method: 'DELETE' }))
}

// ─── Permisos (matriz) ──────────────────────────────────────────────────────
export interface PermisoRow {
  rol: string
  modulo: string
  accion: string
}
export async function getPermisosApi(): Promise<PermisoRow[]> {
  const r = await fetch(`${API}/permisos/`, { cache: 'no-store' })
  if (!r.ok) return []
  return r.json()
}

// ─── Configuración ──────────────────────────────────────────────────────────
export async function getConfigApi(): Promise<ConfigNegocio | null> {
  const r = await fetch(`${API}/config/`, { cache: 'no-store' })
  if (!r.ok) return null
  return r.json()
}
export async function actualizarConfigApi(cambios: Partial<ConfigNegocio>): Promise<ConfigNegocio> {
  return jsonOk(
    await fetch(`${API}/config/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    }),
  )
}
