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
  // El servidor lo MANDA desde el ADR 0009, pero este tipo no lo declaraba y por
  // tanto nadie lo miraba. Con la contraseña temporal puesta, `exigir()` corta
  // TODAS las rutas menos `/api/auth/me` y `/api/perfil` — así que la app se
  // quedaba en «No se pudieron cargar los datos» con un botón de reintentar que
  // no podía funcionar nunca, y sin decir por qué ni adónde ir.
  debeCambiarPassword?: boolean
  // ADR 0018. Mismo cuento que la línea de arriba, y por eso se declara a la
  // vez que se usa: el servidor lo manda desde `auth_usuario_por_sesion`, y si
  // este tipo no lo nombrara, la pantalla no podría saber que se entró con
  // Google — que es justo lo que decide si hay que pedir la contraseña
  // anterior. Opcional porque las sesiones abiertas antes de la migración no lo
  // traen, y ese caso tiene que fallar CERRADO.
  metodoSesion?: 'password' | 'google'
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
