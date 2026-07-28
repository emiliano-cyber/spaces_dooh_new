'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const LS_COLAPSADO = 'spaces:sidebar-colapsado'

// Estado del menú lateral. Dos ejes independientes:
//  - `abierto`: drawer retráctil en móvil (<md). Se reinicia en cada carga.
//  - `colapsado`: modo icon-only del aside en desktop (>=md). Persiste en
//    localStorage para que la preferencia sobreviva a la recarga.
type MenuMovilCtx = {
  abierto: boolean
  abrir: () => void
  cerrar: () => void
  alternar: () => void
  colapsado: boolean
  alternarColapso: () => void
  // false durante el primer render (SSR + hidratación): evita animar el ancho
  // del aside cuando se aplica la preferencia guardada.
  montado: boolean
}

const Ctx = createContext<MenuMovilCtx | null>(null)

export function MenuMovilProvider({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  // Arranca expandido en servidor y cliente para que el HTML coincida; la
  // preferencia real se aplica en el efecto de abajo.
  const [colapsado, setColapsado] = useState(false)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LS_COLAPSADO) === '1') setColapsado(true)
    } catch {
      /* localStorage bloqueado (modo privado): se queda expandido */
    }
    setMontado(true)
  }, [])

  const alternarColapso = () => {
    setColapsado((v) => {
      const siguiente = !v
      try {
        window.localStorage.setItem(LS_COLAPSADO, siguiente ? '1' : '0')
      } catch {
        /* noop */
      }
      return siguiente
    })
  }

  const valor: MenuMovilCtx = {
    abierto,
    abrir: () => setAbierto(true),
    cerrar: () => setAbierto(false),
    alternar: () => setAbierto((v) => !v),
    colapsado,
    alternarColapso,
    montado,
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useMenuMovil() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMenuMovil debe usarse dentro de MenuMovilProvider')
  return ctx
}
