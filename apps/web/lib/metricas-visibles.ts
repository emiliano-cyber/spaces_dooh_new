'use client'

import { useCallback, useEffect, useState } from 'react'

// ============================================================================
//  lib/metricas-visibles.ts — QUÉ MÉTRICAS SE VEN EN EL DASHBOARD (DASH-METRICAS).
// ----------------------------------------------------------------------------
//  Pedido del dueño (12/11): «que del dashboard se puedan elegir qué métricas
//  ver y cuáles no». Mismo patrón que `alertas-visibles.ts`: se guarda lo
//  OCULTO, por navegador (localStorage), y sin nada guardado el tablero sale
//  completo, exactamente como estaba. Así una métrica nueva aparece sola, en
//  vez de quedar escondida para todo el que ya había elegido.
//
//  El diseño del Dashboard está aprobado (26/10): esto no cambia ninguna
//  tarjeta, solo decide si se pinta. Lo único que se ajusta es el ancho de la
//  compañera cuando una de una fila se oculta, para no dejar un hueco.
// ============================================================================

export const METRICAS_DASHBOARD = [
  // Los cuatro indicadores de arriba. Ingreso/margen los ve quien tiene
  // Finanzas; pipeline abierto/tasa, quien no (DASH-REF).
  { id: 'ingreso', grupo: 'indicadores' },
  { id: 'margen', grupo: 'indicadores' },
  { id: 'pipeline-abierto', grupo: 'indicadores' },
  { id: 'tasa', grupo: 'indicadores' },
  { id: 'ganado', grupo: 'indicadores' },
  { id: 'ocupacion-red', grupo: 'indicadores' },
  { id: 'costos', grupo: 'indicadores' },
  // Las tarjetas.
  { id: 'grafica-ocupacion', grupo: 'tarjetas' },
  { id: 'pipeline', grupo: 'tarjetas' },
  { id: 'alertas', grupo: 'tarjetas' },
  { id: 'huecos', grupo: 'tarjetas' },
  { id: 'cobranza', grupo: 'tarjetas' },
  { id: 'mapa', grupo: 'tarjetas' },
] as const

export type MetricaDashboard = (typeof METRICAS_DASHBOARD)[number]['id']

const STORAGE_KEY = 'spaces:metricas-ocultas'
const VALIDAS = new Set<string>(METRICAS_DASHBOARD.map((m) => m.id))

/** Lo guardado → el conjunto de ocultas. Lo que no se entiende, se ignora. Pura. */
export function leerOcultas(raw: string | null): Set<MetricaDashboard> {
  if (!raw) return new Set()
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is MetricaDashboard => typeof x === 'string' && VALIDAS.has(x)))
  } catch {
    return new Set()
  }
}

/** Oculta o vuelve a mostrar una, sin mutar el conjunto de entrada. Pura. */
export function alternarOculta<T extends string>(ocultas: ReadonlySet<T>, id: T): Set<T> {
  const s = new Set(ocultas)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  return s
}

/**
 * Las filas del tablero son de 3 columnas: una tarjeta ancha (2) y una angosta
 * (1). Si se oculta una, la otra se queda con la fila entera; si no, quedaría
 * un hueco del tamaño de la que falta. Pura.
 */
export function anchoDeFila(ancha: boolean, angosta: boolean): { ancha: string; angosta: string | undefined } {
  if (ancha && angosta) return { ancha: 'lg:col-span-2', angosta: undefined }
  return { ancha: 'lg:col-span-3', angosta: 'lg:col-span-3' }
}

export interface MetricasVisibles {
  ve: (id: MetricaDashboard) => boolean
  alternar: (id: MetricaDashboard) => void
  mostrarTodas: () => void
  ocultas: number
  /** Ya se leyó localStorage: antes, se pinta todo (como el SSR). */
  listo: boolean
}

function guardar(s: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]))
  } catch {
    /* localStorage no disponible (modo privado…): la elección dura la sesión */
  }
}

export function useMetricasVisibles(): MetricasVisibles {
  const [ocultas, setOcultas] = useState<Set<MetricaDashboard>>(new Set())
  const [listo, setListo] = useState(false)

  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      /* sin localStorage: todo visible */
    }
    setOcultas(leerOcultas(raw))
    setListo(true)
  }, [])

  const alternar = useCallback((id: MetricaDashboard) => {
    setOcultas((prev) => {
      const next = alternarOculta(prev, id)
      guardar(next)
      return next
    })
  }, [])

  const mostrarTodas = useCallback(() => {
    setOcultas(new Set())
    guardar(new Set())
  }, [])

  return { ve: (id) => !ocultas.has(id), alternar, mostrarTodas, ocultas: ocultas.size, listo }
}
