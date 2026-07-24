'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { landingDeRol } from '@/lib/data/client'
import { useSesionCtx } from './SesionContext'
import { NAV } from './nav'

// Compuerta del shell basada en la sesión REAL (/api/auth/me).
//  - Sin sesión → /demo/login
//  - Cliente externo → su portal (no ve módulos internos)
//  - Rol sin acceso al módulo de la ruta actual → su landing
// El control de acceso por ruta usa el MISMO NAV que el menú, así ocultar el
// ítem y bloquear la ruta nunca se desincronizan. Esto cierra las fugas por
// links directos (pipeline, OT, etc.), no solo el menú.
function moduloDe(pathname: string | null) {
  const path = (pathname ?? '/').replace(/\/spaces-dooh/, '').replace(/\/$/, '') || '/'
  const matches = NAV.filter((n) => path === n.href || path.startsWith(n.href + '/'))
  // El href más largo gana: /demo/comercial vence a /demo (dashboard).
  return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? null
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { sesion } = useSesionCtx() // undefined = cargando | null = sin sesión
  const router = useRouter()
  const pathname = usePathname()

  const rol = sesion?.usuario.rol
  const modulo = moduloDe(pathname)
  const noAutorizado = !!rol && rol !== 'CLIENTE' && !!modulo && !modulo.roles.includes(rol)

  useEffect(() => {
    if (sesion === undefined) return
    if (sesion === null) {
      router.replace('/login')
    } else if (sesion.usuario.rol === 'CLIENTE') {
      router.replace(landingDeRol('CLIENTE'))
    } else if (noAutorizado) {
      router.replace(landingDeRol(sesion.usuario.rol))
    }
  }, [sesion, noAutorizado, router])

  if (sesion === undefined || sesion === null || sesion.usuario.rol === 'CLIENTE' || noAutorizado) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    )
  }

  return <>{children}</>
}
