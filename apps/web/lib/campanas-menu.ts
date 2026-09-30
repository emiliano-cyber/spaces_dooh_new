'use client'
import { useCallback, useEffect, useState } from 'react'

// ============================================================================
//  lib/campanas-menu.ts — Si el menú lateral de campañas está plegado.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-09-30: en el detalle de una campaña (el pipeline)
//  el menú de la izquierda con las demás campañas «también debe de poderse
//  minimizar en TODOS los tamaños de pantalla». Antes no se plegaba en ninguno:
//  en móvil y tableta se apilaba encima del pipeline (hasta 60vh) y en
//  escritorio reservaba 16rem de ancho fijo.
//
//  Es preferencia de pantalla y de cada navegador, así que vive en
//  localStorage y NO toca el servidor — el patrón de `lib/alertas-visibles.ts`.
//  Va en su propio archivo y con su propia clave, no dentro de
//  `lib/campanas-vista.ts` (la vista de la LISTA), para que las dos cosas
//  puedan cambiar por separado.
//
//  Lo leído se valida: solo el valor exacto '1' pliega. Cualquier otra cosa
//  —nada, basura, una versión futura— deja el menú a la vista, que es como
//  estaba antes. Una preferencia rota no puede esconder la navegación.
// ============================================================================

export const CLAVE_MENU_CAMPANAS = 'spaces:campanas-menu'

/** true si lo guardado dice «plegado». Todo lo que no sea exactamente '1' es false. */
export function leerMenuPlegado(raw: string | null): boolean {
  return raw === '1'
}

export function serializarMenuPlegado(plegado: boolean): string {
  return plegado ? '1' : '0'
}

export interface MenuCampanas {
  plegado: boolean
  alternar: () => void
  /** Ya se hidrató desde localStorage. */
  listo: boolean
}

export function useMenuCampanasPlegado(): MenuCampanas {
  // Arranca desplegado en servidor y cliente para que el HTML coincida; la
  // preferencia real se aplica en el efecto (hidratación sin desajuste).
  const [plegado, setPlegado] = useState(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    try {
      setPlegado(leerMenuPlegado(window.localStorage.getItem(CLAVE_MENU_CAMPANAS)))
    } catch {
      /* localStorage no disponible (modo privado, etc.): se queda desplegado */
    }
    setListo(true)
  }, [])

  const alternar = useCallback(() => {
    setPlegado((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(CLAVE_MENU_CAMPANAS, serializarMenuPlegado(next))
      } catch {
        /* sin localStorage la preferencia dura lo que dure la pestaña */
      }
      return next
    })
  }, [])

  return { plegado, alternar, listo }
}
