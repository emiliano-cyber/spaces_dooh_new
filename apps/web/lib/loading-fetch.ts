'use client'

import { useEffect, useState } from 'react'

// ============================================================================
//  lib/loading-fetch.ts — Indicador de carga GLOBAL para peticiones que MUTAN.
//
//  Parchea window.fetch una sola vez y cuenta las peticiones same-origin que
//  mutan (POST/PUT/PATCH/DELETE) mientras están en vuelo. Un componente
//  (<IndicadorCarga>) se suscribe y muestra una pequeña animación mientras haya
//  alguna pendiente. Así toda acción de "guardar y esperar respuesta" tiene
//  feedback, sin tocar cada botón.
//
//  Se instala DESPUÉS del parche CSRF (lib/csrf-client), así que lo envuelve: al
//  llamar fetch, este cuenta, delega en el fetch (con el header CSRF ya puesto) y
//  descuenta al terminar.
// ============================================================================

let activos = 0
const suscriptores = new Set<() => void>()

function notificar() {
  suscriptores.forEach((f) => f())
}

export function hayCarga(): boolean {
  return activos > 0
}

const MUTACIONES = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function esMismoOrigen(url: string): boolean {
  if (url.startsWith('/')) return true
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

let instalado = false

export function instalarIndicadorCarga(): void {
  if (instalado || typeof window === 'undefined') return
  instalado = true
  const original = window.fetch.bind(window)

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let cuenta = false
    try {
      const metodo = (
        init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET') ?? 'GET'
      ).toUpperCase()
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (MUTACIONES.has(metodo) && esMismoOrigen(url)) {
        cuenta = true
        activos++
        notificar()
      }
    } catch {
      /* si algo falla al inspeccionar, no bloqueamos la petición */
    }
    const p = original(input, init)
    if (cuenta) {
      p.finally(() => {
        activos = Math.max(0, activos - 1)
        notificar()
      })
    }
    return p
  }
}

// Hook: true mientras haya al menos una petición que muta en vuelo.
export function useCargando(): boolean {
  const [cargando, setCargando] = useState(false)
  useEffect(() => {
    const cb = () => setCargando(hayCarga())
    suscriptores.add(cb)
    cb()
    return () => {
      suscriptores.delete(cb)
    }
  }, [])
  return cargando
}
