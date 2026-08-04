'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { landingDeRol } from '@/lib/data/client'
import { useDemoStore } from '@/lib/data/store'
import { refrescarEstado } from '@/lib/data/estado-api'
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

function Cargando() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  )
}

// Fallo al cargar el estado. Se muestra en vez de los módulos vacíos: un "0 de
// 0" es indistinguible de "no tienes datos" y manda al usuario a buscar el
// problema en sus filtros. Con reintento, para no obligar a recargar la página.
function ErrorDeCarga() {
  const [reintentando, setReintentando] = useState(false)
  async function reintentar() {
    setReintentando(true)
    useDemoStore.setState({ estadoCarga: 'pendiente' })
    await refrescarEstado()
    setReintentando(false)
  }
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        <p className="text-[15px] font-medium text-ink">No se pudieron cargar los datos</p>
        <p className="mt-1 text-[13px] text-muted">
          La información no llegó del servidor. No es que no existan datos: no se pudieron leer.
        </p>
        <button
          type="button"
          onClick={reintentar}
          disabled={reintentando}
          className="mt-4 rounded-md border border-border px-3 py-1.5 text-[13px] text-ink hover:bg-bg disabled:opacity-60"
        >
          {reintentando ? 'Reintentando…' : 'Reintentar'}
        </button>
      </div>
    </div>
  )
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { sesion } = useSesionCtx() // undefined = cargando | null = sin sesión
  const estadoCarga = useDemoStore((s) => s.estadoCarga)
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
    return <Cargando />
  }

  // El store arranca VACÍO (buildSeed) y se llena con /api/estado. Hasta que eso
  // ocurra no se renderizan los módulos: si no, muestran "0 de 0" y "No hay
  // campañas" como si fueran datos ciertos. Es el hallazgo C1 de la auditoría.
  if (estadoCarga === 'pendiente') return <Cargando />
  if (estadoCarga === 'error') return <ErrorDeCarga />

  return <>{children}</>
}
