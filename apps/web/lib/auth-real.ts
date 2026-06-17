'use client'

import { useEffect, useState, useCallback } from 'react'
import type { RolDemo } from '@/lib/data/types'

// ============================================================================
//  lib/auth-real.ts — Cliente de autenticación real (contra /api/auth/*).
//  Reemplaza el login mock: sesión por cookie httpOnly en el servidor.
//  basePath /spaces-dooh + trailingSlash → las rutas llevan barra final.
// ============================================================================

const API = '/spaces-dooh/api/auth'

export interface UsuarioAuth {
  id: string
  nombre: string
  email: string
  cargo: string | null
  rol: RolDemo
  activo: boolean
}
export type Permisos = Record<string, string[]>

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ usuario: UsuarioAuth; permisos: Permisos }> {
  const res = await fetch(`${API}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'No se pudo iniciar sesión')
  return data
}

export async function apiMe(): Promise<{ usuario: UsuarioAuth; permisos: Permisos } | null> {
  const res = await fetch(`${API}/me/`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

export async function apiLogout(): Promise<void> {
  await fetch(`${API}/logout/`, { method: 'POST' })
}

// Hook de sesión: carga /me al montar. undefined = cargando, null = sin sesión.
export interface Sesion {
  usuario: UsuarioAuth
  permisos: Permisos
}
export function useSesion(): {
  sesion: Sesion | null | undefined
  refrescar: () => Promise<void>
} {
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined)
  const refrescar = useCallback(async () => {
    setSesion((await apiMe()) ?? null)
  }, [])
  useEffect(() => {
    refrescar()
  }, [refrescar])
  return { sesion, refrescar }
}

// ¿El rol activo puede `accion` en `modulo`?
export function puede(permisos: Permisos, modulo: string, accion: string): boolean {
  return !!permisos[modulo]?.includes(accion)
}
