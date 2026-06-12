'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUsuario, landingDeRol } from '@/lib/data/client'

// Compuerta de sesión del shell. Sin sesión → /demo/login. Cliente externo →
// su portal (no ve módulos internos). El "login" es mock (estado en memoria),
// así que la decisión es 100% client-side tras montar.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const usuario = useUsuario() // undefined (pre-montaje) | null (sin sesión) | UsuarioDemo
  const router = useRouter()

  useEffect(() => {
    if (usuario === undefined) return
    if (usuario === null) router.replace('/demo/login')
    else if (usuario.rol === 'CLIENTE') router.replace(landingDeRol('CLIENTE'))
  }, [usuario, router])

  // Mientras no hay sesión válida para el shell, no renderizamos los módulos.
  if (usuario === undefined || usuario === null || usuario.rol === 'CLIENTE') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    )
  }

  return <>{children}</>
}
