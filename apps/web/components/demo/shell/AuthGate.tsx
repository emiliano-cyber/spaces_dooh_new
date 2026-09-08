'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { landingDeRol } from '@/lib/data/client'
import { useDemoStore } from '@/lib/data/store'
import { refrescarEstado } from '@/lib/data/estado-api'
import { useSesionCtx } from './SesionContext'
import { NAV } from './nav'
import { decidirPantalla, salidaObligatoria } from './compuerta'

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

  // Contraseña temporal (ADR 0009). El servidor corta TODAS las rutas menos
  // `/api/auth/me` y `/api/perfil`, y deja el motivo en un 403 que nadie leía:
  // el cliente no declaraba siquiera este campo. Resultado en producción — un
  // usuario con temporal veía «No se pudieron cargar los datos» y un botón de
  // reintentar que no podía funcionar NUNCA, sin decirle que su contraseña es
  // temporal ni adónde ir. Encerrado, igual que lo estaba el restablecimiento
  // antes de 3865c4e: el servidor pedía algo y la interfaz no tenía puerta.
  const rutaLimpia = (pathname ?? '').replace(/\/spaces-dooh/, '').replace(/\/$/, '')
  const debeCambiar = !!sesion?.usuario.debeCambiarPassword
  // ADR 0028 · B2. El servidor ya CORTA con 403 mientras falten los códigos
  // (`exigir()`); esto es lo que evita que el usuario se coma ese 403 sin saber
  // por qué. Mismo problema que tenía la contraseña temporal antes de 3865c4e:
  // el servidor pedía algo y la interfaz no tenía puerta.
  //
  // El booleano viene DERIVADO del servidor (`/api/auth/me`) y no se calcula
  // aquí: la regla la decide `exigir()`, y una copia en el cliente divergiría.
  const debeGuardarCodigos = !!sesion?.usuario.debeGuardarCodigos

  // Las DOS mitades de la compuerta —adónde se manda al usuario y qué se le
  // pinta— salen de aquí y no de dos escaleras de `if` escritas por separado.
  // Escribirlas por separado es lo que produjo el encierro del 08/09 en el
  // PADRE: el ADR 0028 añadió la redirección a los códigos y no la exención de
  // render, así que la única pantalla que resolvía el 403 quedaba tapada por
  // «No se pudieron cargar los datos». Ver `compuerta.ts`.
  const salida = salidaObligatoria({ debeGuardarCodigos, debeCambiarPassword: debeCambiar })

  useEffect(() => {
    if (sesion === undefined) return
    if (sesion === null) {
      router.replace('/login')
    } else if (sesion.usuario.rol === 'CLIENTE') {
      router.replace(landingDeRol('CLIENTE'))
    } else if (salida && rutaLimpia !== salida) {
      // Con un estado bloqueante puesto no hay módulo al que pueda entrar, así
      // que esto va antes que cualquier comprobación de ruta: mandarlo a su
      // landing solo lo pasearía entre pantallas vacías.
      router.replace(salida)
    } else if (!salida && noAutorizado) {
      router.replace(landingDeRol(sesion.usuario.rol))
    }
  }, [sesion, noAutorizado, salida, rutaLimpia, router])

  if (sesion === undefined || sesion === null || sesion.usuario.rol === 'CLIENTE') {
    return <Cargando />
  }

  // La escalera de `if` que había aquí vive en `decidirPantalla()`, que se
  // prueba sin React (`compuerta.test.ts`). No es una preferencia de estilo: el
  // encierro del 08/09 era una decisión de RENDER, y `vitest.config.ts` no monta
  // jsdom, así que dentro del `.tsx` no la probaba nadie.
  //
  // Lo que sigue vigente y decide esa función:
  //  · la pantalla de salida de un estado bloqueante se renderiza aunque el
  //    store esté en error — mientras el estado siga puesto, /api/estado
  //    responde 403 y esperar sería esperar para siempre;
  //  · sin estado bloqueante, el store vacío NO se pinta como datos: mostraría
  //    "0 de 0" y "No hay campañas" como si fueran ciertos (hallazgo C1).
  switch (decidirPantalla({
    debeGuardarCodigos,
    debeCambiarPassword: debeCambiar,
    ruta: rutaLimpia,
    noAutorizado,
    estadoCarga,
  })) {
    case 'contenido':
      return <>{children}</>
    case 'error-de-carga':
      return <ErrorDeCarga />
    default:
      return <Cargando />
  }
}
