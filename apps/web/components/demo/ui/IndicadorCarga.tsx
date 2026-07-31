'use client'

import { useEffect, useState } from 'react'
import { instalarContadorDeCarga, suscribirCarga } from '@/lib/carga-global'

// ============================================================================
//  Barra de carga global. Se enciende mientras haya alguna petición a la API en
//  vuelo, para que el usuario sepa que el sistema está trabajando aunque la
//  pantalla no cambie todavía.
//
//  Dos decisiones que evitan que moleste más de lo que ayuda:
//
//  · RETARDO antes de aparecer. Una petición que tarda 80 ms no necesita aviso;
//    mostrar y ocultar la barra en ese tiempo produce un parpadeo que se percibe
//    como un fallo. Solo aparece si la espera se nota.
//  · PERMANENCIA MÍNIMA una vez visible. Si apareciera y desapareciera al
//    instante seguiría pareciendo un parpadeo, así que se queda un momento.
//
//  La animación no representa el progreso real —no se puede conocer— sino que
//  algo está en marcha. Por eso avanza rápido al principio y se frena cerca del
//  final, en vez de fingir un porcentaje.
// ============================================================================

const RETARDO_MS = 180   // por debajo de esto, la petición se siente instantánea
const MINIMO_MS = 400    // una vez visible, no desaparece antes de esto

export function IndicadorCarga() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    instalarContadorDeCarga()

    let mostrarEn: ReturnType<typeof setTimeout> | null = null
    let ocultarEn: ReturnType<typeof setTimeout> | null = null
    let desde = 0

    const limpiar = () => {
      if (mostrarEn) { clearTimeout(mostrarEn); mostrarEn = null }
      if (ocultarEn) { clearTimeout(ocultarEn); ocultarEn = null }
    }

    const off = suscribirCarga((n) => {
      if (n > 0) {
        if (ocultarEn) { clearTimeout(ocultarEn); ocultarEn = null }
        if (!mostrarEn && !desde) {
          mostrarEn = setTimeout(() => {
            desde = Date.now()
            setVisible(true)
            mostrarEn = null
          }, RETARDO_MS)
        }
        return
      }
      // Ya no queda nada en vuelo.
      if (mostrarEn) { clearTimeout(mostrarEn); mostrarEn = null; return } // ni llegó a verse
      if (!desde) return
      const restante = Math.max(0, MINIMO_MS - (Date.now() - desde))
      ocultarEn = setTimeout(() => {
        setVisible(false)
        desde = 0
        ocultarEn = null
      }, restante)
    })

    return () => { off(); limpiar() }
  }, [])

  return (
    <div
      // `role="status"` + aria-live: un lector de pantalla anuncia que se está
      // cargando. `aria-hidden` cuando no hay nada, para no anunciar el vacío.
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {visible && (
        <>
          <div className="carga-barra h-full bg-accent" />
          <span className="sr-only">Cargando…</span>
        </>
      )}
    </div>
  )
}
