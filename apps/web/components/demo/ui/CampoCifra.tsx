'use client'

import * as React from 'react'
import {
  leerCifra,
  crudoDeLectura,
  textoDesdeCrudo,
  textoAlSalir,
  formatearMientrasEscribe,
  type LecturaCifra,
  type OpcionesCifra,
} from '@/lib/captura-cifra'

// ============================================================================
//  El campo donde se teclea un importe o una cantidad, con su coma de miles
//  mientras se escribe (fase 2 del estándar del 08/10): se teclea 212500 y se
//  ve 212,500.
// ----------------------------------------------------------------------------
//  Toda la lógica —qué se acepta, qué se rechaza, dónde van las comas y el
//  cursor— vive en `lib/captura-cifra.ts`, que tiene pruebas. Aquí solo se
//  conecta al `<input>`: lo que no se puede probar sin DOM se queda en lo
//  mínimo.
//
//  EL CONTRATO CON EL FORMULARIO NO CAMBIA. El padre sigue guardando lo que
//  guardaba con el `<input type="number">`: la cifra SIN comas como texto
//  («212500.5», o '' si está vacío), y por tanto manda al servidor lo mismo que
//  antes. Las comas solo existen en lo que se ve. Si lo tecleado no se entiende,
//  el padre recibe 'NaN' (que `Number()` nunca acepta) y el error, y debe
//  bloquear el envío con él.
//
//  `type="text"` y no `number`: un `<input type="number">` no admite comas (el
//  navegador lo da por vacío), y además cambia el valor con la rueda del ratón.
//  `inputMode` saca el teclado numérico en el teléfono igualmente.
// ============================================================================

const useEfectoDeDisposicion = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

type AtributosInput = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max' | 'step' | 'inputMode'
>

export interface CampoCifraProps extends AtributosInput {
  /** Lo que guarda el formulario: la cifra sin comas, o '' / null si está vacío. */
  valor: string | number | null | undefined
  /** `crudo` es lo que el formulario guardaba antes («212500.5», '' o 'NaN'). */
  onCambio: (crudo: string, lectura: LecturaCifra) => void
  /** 2 para dinero (por defecto), 0 para cantidades enteras. */
  decimales?: number
  /** Por defecto 0 (sin negativos). `null` = sin mínimo. */
  minimo?: number | null
  maximo?: number
  permiteVacio?: boolean
  /** Pinta el motivo del rechazo debajo del campo. Por defecto sí. */
  mostrarError?: boolean
}

function aCrudo(valor: string | number | null | undefined): string {
  if (valor == null) return ''
  return typeof valor === 'number' ? (Number.isFinite(valor) ? String(valor) : '') : valor
}

export function CampoCifra({
  valor,
  onCambio,
  decimales = 2,
  minimo = 0,
  maximo,
  permiteVacio,
  mostrarError = true,
  onBlur,
  ...resto
}: CampoCifraProps) {
  const opciones: OpcionesCifra = {
    decimales,
    minimo: minimo ?? undefined,
    maximo,
    permiteVacio,
  }
  const crudoProp = aCrudo(valor)
  const [texto, setTexto] = React.useState(() => textoDesdeCrudo(crudoProp))
  const ultimoEmitido = React.useRef(crudoProp)
  const cursorPendiente = React.useRef<number | null>(null)
  const ref = React.useRef<HTMLInputElement>(null)

  // Si el formulario cambia el valor por su cuenta (lo limpia tras guardar, o
  // precarga otro registro), se pinta lo nuevo. Lo que este mismo campo emitió
  // no cuenta como cambio: si no, cada tecla borraría el punto final de
  // «212,500.» al volver como «212500».
  React.useEffect(() => {
    if (crudoProp !== ultimoEmitido.current) {
      ultimoEmitido.current = crudoProp
      setTexto(textoDesdeCrudo(crudoProp))
    }
  }, [crudoProp])

  useEfectoDeDisposicion(() => {
    const el = ref.current
    if (cursorPendiente.current != null && el && document.activeElement === el) {
      el.setSelectionRange(cursorPendiente.current, cursorPendiente.current)
    }
    cursorPendiente.current = null
  })

  const emitir = (t: string) => {
    const lectura = leerCifra(t, opciones)
    const crudo = crudoDeLectura(lectura)
    ultimoEmitido.current = crudo
    onCambio(crudo, lectura)
  }

  const lectura = leerCifra(texto, opciones)
  const error = lectura.ok ? null : lectura.error

  return (
    <>
      <input
        {...resto}
        ref={ref}
        type="text"
        inputMode={decimales > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={texto}
        aria-invalid={error ? true : undefined}
        // El borde rojo se ve aunque el formulario esconda el texto del error
        // (`mostrarError={false}` en filas estrechas, que lo dicen en su pie).
        className={`${resto.className ?? ''} aria-[invalid=true]:border-error`.trim()}
        title={error ?? resto.title}
        onChange={(e) => {
          const el = e.target
          const r = formatearMientrasEscribe({
            anterior: texto,
            nuevo: el.value,
            cursor: el.selectionStart ?? el.value.length,
            tipoEntrada: (e.nativeEvent as InputEvent).inputType,
          })
          cursorPendiente.current = r.cursor
          setTexto(r.texto)
          emitir(r.texto)
        }}
        onBlur={(e) => {
          setTexto(textoAlSalir(texto, opciones))
          onBlur?.(e)
        }}
      />
      {mostrarError && error && (
        <span role="alert" className="mt-1 block w-full basis-full text-[11px] leading-snug text-error">
          {error}
        </span>
      )}
    </>
  )
}
