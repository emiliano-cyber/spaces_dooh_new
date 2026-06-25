'use client'

import { createContext, useContext, useState } from 'react'

// Estado del menú lateral en móvil (drawer retráctil). En desktop el sidebar es
// estático y este estado se ignora.
type MenuMovilCtx = {
  abierto: boolean
  abrir: () => void
  cerrar: () => void
  alternar: () => void
}

const Ctx = createContext<MenuMovilCtx | null>(null)

export function MenuMovilProvider({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const valor: MenuMovilCtx = {
    abierto,
    abrir: () => setAbierto(true),
    cerrar: () => setAbierto(false),
    alternar: () => setAbierto((v) => !v),
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useMenuMovil() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMenuMovil debe usarse dentro de MenuMovilProvider')
  return ctx
}
