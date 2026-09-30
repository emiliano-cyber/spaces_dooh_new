'use client'
import { useCallback, useEffect, useState } from 'react'

// ============================================================================
//  lib/campanas-vista.ts — Cómo quiere ver cada persona la lista de Campañas.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-09-30: cada tarjeta dibuja el pipeline entero, y
//  con muchas campañas la pantalla se vuelve una tira interminable. Se puede:
//
//   · poner la lista en VISTA COMPACTA (ningún pipeline, una fila por campaña),
//   · MINIMIZAR una sola tarjeta (se pliega su pipeline), y
//   · OCULTAR una campaña de la lista (vuelve con «Mostrar ocultas»).
//
//  Es preferencia de pantalla y de cada navegador, así que vive en
//  localStorage y NO toca el servidor — el mismo patrón que
//  `lib/alertas-visibles.ts`. Ocultar una campaña no le cambia nada a nadie
//  más: no es archivarla ni cancelarla.
//
//  Todo lo que se lee de localStorage se valida campo a campo: puede traer
//  basura, una versión vieja o nada, y una preferencia rota no puede tirar la
//  pantalla.
// ============================================================================

export interface VistaCampanas {
  compacta: boolean
  minimizadas: string[]
  ocultas: string[]
}

export const VISTA_VACIA: VistaCampanas = { compacta: false, minimizadas: [], ocultas: [] }

const STORAGE_KEY = 'spaces:campanas-vista'

const ids = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []

/** Lee lo guardado. Cualquier cosa rara vuelve a la vista vacía, campo a campo. */
export function leerVista(raw: string | null): VistaCampanas {
  if (!raw) return { ...VISTA_VACIA }
  let d: unknown
  try {
    d = JSON.parse(raw)
  } catch {
    return { ...VISTA_VACIA }
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ...VISTA_VACIA }
  const o = d as Record<string, unknown>
  return {
    compacta: o.compacta === true,
    minimizadas: ids(o.minimizadas),
    ocultas: ids(o.ocultas),
  }
}

export function serializarVista(v: VistaCampanas): string {
  return JSON.stringify(v)
}

/** Añade el id si no está, lo quita si está. Devuelve una lista NUEVA. */
export function alternarEn(lista: string[], id: string): string[] {
  return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]
}

export function useVistaCampanas() {
  const [vista, setVista] = useState<VistaCampanas>(VISTA_VACIA)

  // Se hidrata en el cliente para no romper el render del servidor.
  useEffect(() => {
    try {
      setVista(leerVista(window.localStorage.getItem(STORAGE_KEY)))
    } catch {
      /* localStorage no disponible (modo privado, etc.): vista por defecto */
    }
  }, [])

  const guardar = useCallback((cambio: (v: VistaCampanas) => VistaCampanas) => {
    setVista((prev) => {
      const next = cambio(prev)
      try {
        window.localStorage.setItem(STORAGE_KEY, serializarVista(next))
      } catch {
        /* sin localStorage la preferencia dura lo que dure la pestaña */
      }
      return next
    })
  }, [])

  return {
    vista,
    alternarCompacta: () => guardar((v) => ({ ...v, compacta: !v.compacta })),
    alternarMinimizada: (id: string) => guardar((v) => ({ ...v, minimizadas: alternarEn(v.minimizadas, id) })),
    alternarOculta: (id: string) => guardar((v) => ({ ...v, ocultas: alternarEn(v.ocultas, id) })),
    mostrarTodas: () => guardar((v) => ({ ...v, ocultas: [] })),
  }
}
