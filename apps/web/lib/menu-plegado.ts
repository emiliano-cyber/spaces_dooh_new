'use client'

import { useCallback, useEffect, useState } from 'react'

// ============================================================================
//  lib/menu-plegado.ts — EL MENÚ EN CASCADA (MENU-CASCADA, 12/11).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «el menú hazlo tipo cascada: que cada sección esté
//  desplegada, pero si se desea, ocultar el resto y solo dejar el nombre del
//  submenú, guardándolo en localStorage».
//
//  Se guarda lo PLEGADO, no lo desplegado: sin nada guardado todo va abierto,
//  que es como estaba el menú, y una sección nueva aparece abierta en vez de
//  escondida para quien ya había plegado otras. Por navegador, como el ancho
//  del menú (`MenuMovilContext`) y las alertas del Dashboard.
// ============================================================================

export const CLAVE_MENU_PLEGADO = 'spaces:menu-plegado'

/** Lo guardado → las secciones plegadas que existen. Lo que no se entiende, fuera. Pura. */
export function leerPlegadas(raw: string | null, validas: readonly string[]): Set<string> {
  if (!raw) return new Set()
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string' && validas.includes(x)))
  } catch {
    return new Set()
  }
}

/** Pliega o despliega una, sin mutar el conjunto de entrada. Pura. */
export function alternarPlegada(plegadas: ReadonlySet<string>, clave: string): Set<string> {
  const s = new Set(plegadas)
  if (s.has(clave)) s.delete(clave)
  else s.add(clave)
  return s
}

export function useMenuPlegado(validas: readonly string[]) {
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set())

  // Se lee al montar y no en el primer render: el servidor no tiene
  // localStorage, y pintar distinto en cada lado rompe la hidratación.
  // `validas` va por su contenido: la lista se arma en cada render.
  const firma = validas.join('|')
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(CLAVE_MENU_PLEGADO)
    } catch {
      /* sin localStorage: todo desplegado */
    }
    setPlegadas(leerPlegadas(raw, firma.split('|')))
  }, [firma])

  const alternar = useCallback((clave: string) => {
    setPlegadas((prev) => {
      const next = alternarPlegada(prev, clave)
      try {
        window.localStorage.setItem(CLAVE_MENU_PLEGADO, JSON.stringify([...next]))
      } catch {
        /* modo privado: dura la sesión */
      }
      return next
    })
  }, [])

  return { plegada: (clave: string) => plegadas.has(clave), alternar }
}
