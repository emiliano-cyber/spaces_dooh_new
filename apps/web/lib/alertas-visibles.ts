'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TipoAlerta } from '@/lib/data/derive'

// ============================================================================
//  lib/alertas-visibles.ts — Preferencia (por navegador) de qué TIPOS de alerta
//  se muestran en el Dashboard. Es una preferencia de visualización en pantalla,
//  así que vive en localStorage (no toca el backend).
//
//  Se guarda la lista de tipos OCULTOS; por default está vacía → todas las
//  alertas se muestran (como venía funcionando).
// ============================================================================

export const TIPOS_ALERTA: { tipo: TipoAlerta; label: string }[] = [
  { tipo: 'pago', label: 'Rentas vencidas' },
  { tipo: 'contrato', label: 'Contratos por vencer' },
  { tipo: 'cobranza', label: 'Facturas (cobranza)' },
  { tipo: 'incidencia', label: 'Sitios bloqueados por incidencia' },
  { tipo: 'ot', label: 'Órdenes de trabajo (SLA)' },
]

const STORAGE_KEY = 'spaces:alertas-ocultas'
const TIPOS_VALIDOS = new Set(TIPOS_ALERTA.map((t) => t.tipo))

function leer(): Set<TipoAlerta> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown[]
    return new Set(arr.filter((x): x is TipoAlerta => typeof x === 'string' && TIPOS_VALIDOS.has(x as TipoAlerta)))
  } catch {
    return new Set()
  }
}

export interface AlertasVisibles {
  /** true si ese tipo se muestra en pantalla. */
  esVisible: (tipo: TipoAlerta) => boolean
  /** Enciende/apaga un tipo. */
  alternar: (tipo: TipoAlerta) => void
  /** Cuántos tipos están ocultos (para el badge del botón). */
  ocultos: number
  /** Ya se hidrató desde localStorage (evita parpadeo en SSR). */
  listo: boolean
}

export function useAlertasVisibles(): AlertasVisibles {
  const [ocultas, setOcultas] = useState<Set<TipoAlerta>>(new Set())
  const [listo, setListo] = useState(false)

  // Se hidrata en el cliente para no romper el render del servidor.
  useEffect(() => {
    setOcultas(leer())
    setListo(true)
  }, [])

  const alternar = useCallback((tipo: TipoAlerta) => {
    setOcultas((prev) => {
      const next = new Set(prev)
      if (next.has(tipo)) next.delete(tipo)
      else next.add(tipo)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        /* localStorage no disponible (modo privado, etc.): la preferencia dura la sesión */
      }
      return next
    })
  }, [])

  const esVisible = useCallback((tipo: TipoAlerta) => !ocultas.has(tipo), [ocultas])

  return { esVisible, alternar, ocultos: ocultas.size, listo }
}
