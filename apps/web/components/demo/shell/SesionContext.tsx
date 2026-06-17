'use client'

import { createContext, useContext } from 'react'
import { useSesion, type Sesion } from '@/lib/auth-real'

// Provee la sesión real (usuario + permisos) cargada de /api/auth/me una sola
// vez, para que Sidebar, Topbar, AuthGate y pantallas la compartan.
interface Ctx {
  sesion: Sesion | null | undefined // undefined = cargando, null = sin sesión
  refrescar: () => Promise<void>
}
const SesionCtx = createContext<Ctx>({ sesion: undefined, refrescar: async () => {} })

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const { sesion, refrescar } = useSesion()
  return <SesionCtx.Provider value={{ sesion, refrescar }}>{children}</SesionCtx.Provider>
}

export const useSesionCtx = () => useContext(SesionCtx)

// ¿El usuario en sesión puede `accion` en `modulo`? (RBAC en el front).
export function usePuede(modulo: string, accion: string): boolean {
  const { sesion } = useContext(SesionCtx)
  return !!sesion?.permisos?.[modulo]?.includes(accion)
}
