'use client'

import { Loader2 } from 'lucide-react'
import { useCargando } from '@/lib/loading-fetch'

// Indicador de carga GLOBAL: se muestra mientras haya alguna petición que muta
// (POST/PUT/PATCH/DELETE) en vuelo. Dos piezas discretas:
//   · una barra delgada indeterminada en el borde superior de la pantalla, y
//   · un pequeño spinner con "Procesando…" abajo a la derecha.
// No bloquea la interacción; solo da feedback de "esperando respuesta".
export function IndicadorCarga() {
  const cargando = useCargando()
  if (!cargando) return null
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden">
        <div
          className="h-full w-1/3 rounded-full bg-accent"
          style={{ animation: 'barra-carga 1.1s ease-in-out infinite' }}
        />
      </div>
      <div className="pointer-events-none fixed bottom-3 right-3 z-[200] inline-flex items-center gap-2 rounded-full border border-border bg-surface/95 px-2.5 py-1 shadow-sm backdrop-blur">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        <span className="text-[11px] text-muted">Procesando…</span>
      </div>
    </>
  )
}
