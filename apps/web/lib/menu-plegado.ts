'use client'

import { useCallback, useEffect, useState } from 'react'

// ============================================================================
//  lib/menu-plegado.ts — EL MENÚ EN CASCADA (MENU-CASCADA, 12/11).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «el menú hazlo tipo cascada: que cada sección esté
//  desplegada, pero si se desea, ocultar el resto y solo dejar el nombre del
//  submenú, guardándolo en localStorage». Y después: «mejóralo».
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

/** Todas plegadas: las que se le dan, ni una más. Pura. */
export function plegarTodas(claves: readonly string[]): Set<string> {
  return new Set(claves)
}

/**
 * ¿Queda alguna de estas abierta? Decide qué hace el botón del pie: si queda
 * alguna, pliega todas; si no, despliega todas. Pura.
 */
export function hayDesplegadas(plegadas: ReadonlySet<string>, claves: readonly string[]): boolean {
  return claves.some((c) => !plegadas.has(c))
}

// El menú se pinta DOS veces —la barra de escritorio y el cajón del móvil—, y
// cada copia tiene su estado. Sin este aviso, plegar en una no se veía en la
// otra hasta recargar (visto en el navegador el 12/11). `storage` no sirve:
// el navegador no lo dispara en la misma pestaña que escribe.
const EVENTO_MENU_PLEGADO = 'spaces:menu-plegado-cambio'

function guardar(s: Set<string>) {
  try {
    window.localStorage.setItem(CLAVE_MENU_PLEGADO, JSON.stringify([...s]))
  } catch {
    /* modo privado: dura la sesión */
  }
  window.dispatchEvent(new CustomEvent<string[]>(EVENTO_MENU_PLEGADO, { detail: [...s] }))
}

export function useMenuPlegado(validas: readonly string[]) {
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set())
  // Hasta leer localStorage no se anima nada: si no, quien tenía secciones
  // plegadas las vería cerrarse solas al cargar cada página.
  const [listo, setListo] = useState(false)

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
    // Un cuadro después: el estado leído se pinta sin transición y solo los
    // clics posteriores animan.
    const id = window.requestAnimationFrame(() => setListo(true))
    return () => window.cancelAnimationFrame(id)
  }, [firma])

  // La otra copia del menú cambió: adoptar lo suyo. El detalle trae el conjunto
  // entero, así que funciona aunque localStorage no esté disponible.
  useEffect(() => {
    const alCambiar = (e: Event) => {
      const detalle = (e as CustomEvent<string[]>).detail
      if (Array.isArray(detalle)) setPlegadas(new Set(detalle))
    }
    window.addEventListener(EVENTO_MENU_PLEGADO, alCambiar)
    return () => window.removeEventListener(EVENTO_MENU_PLEGADO, alCambiar)
  }, [])

  // Guardar y avisar van FUERA del `setState`: dentro de un actualizador, el
  // aviso pondría a la otra copia a cambiar de estado mientras React pinta
  // ésta, que es justo lo que React prohíbe.
  const alternar = useCallback(
    (clave: string) => guardar(alternarPlegada(plegadas, clave)),
    [plegadas],
  )

  /** Si queda alguna abierta, pliega todas estas; si no, las despliega. */
  const alternarTodas = useCallback(
    (claves: readonly string[]) =>
      guardar(hayDesplegadas(plegadas, claves) ? plegarTodas(claves) : new Set<string>()),
    [plegadas],
  )

  return {
    plegada: (clave: string) => plegadas.has(clave),
    alternar,
    alternarTodas,
    hayDesplegadas: (claves: readonly string[]) => hayDesplegadas(plegadas, claves),
    listo,
  }
}
