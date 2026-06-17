'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { landingDeRol } from '@/lib/data/client'
import { useSesionCtx } from './SesionContext'

// Compuerta del shell basada en la sesión REAL (/api/auth/me). Sin sesión →
// /demo/login. Cliente externo → su portal (no ve módulos internos).
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { sesion } = useSesionCtx() // undefined = cargando | null = sin sesión
  const router = useRouter()

  useEffect(() => {
    if (sesion === undefined) return
    if (sesion === null) router.replace('/demo/login')
    else if (sesion.usuario.rol === 'CLIENTE') router.replace(landingDeRol('CLIENTE'))
  }, [sesion, router])

  if (sesion === undefined || sesion === null || sesion.usuario.rol === 'CLIENTE') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    )
  }

  return <>{children}</>
}
