'use client'

import * as React from 'react'
import type { Idioma } from '@/lib/i18n/idiomas'
import { useIdioma } from '@/lib/i18n/contexto'
import {
  leerCifra,
  crudoDeLectura,
  pintarCrudo,
  motivoCifraAjena,
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
//  EN ITALIANO los signos van al revés —se teclea y se ve «1.500,50»— y el
//  padre recibe lo mismo que en español: «1500.5». Ver `lib/captura-cifra.ts`.
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
  /**
   * I18N · idioma del motivo de rechazo (`title` y aviso) y, desde el 04/11
   * (P-L2-1), de los SIGNOS: en italiano se teclea y se pinta «1.500,50». Sin
   * él, el de la pantalla (`useIdioma`, que fuera del proveedor es 'es'): en
   * español e inglés sale lo de siempre en todos los formularios.
   */
  idioma?: Idioma
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
  idioma: idiomaProp,
  onBlur,
  ...resto
}: CampoCifraProps) {
  const idiomaPantalla = useIdioma().idioma
  const idioma = idiomaProp ?? idiomaPantalla
  const opciones: OpcionesCifra = {
    decimales,
    minimo: minimo ?? undefined,
    maximo,
    permiteVacio,
    idioma,
  }
  const crudoProp = aCrudo(valor)
  const [texto, setTexto] = React.useState(() => pintarCrudo(crudoProp, idioma).texto)
  // B82: lo pintado es un crudo de OTRO idioma que no es una cifra («1,500»
  // guardado en español y abierto en italiano). Se avisa hasta que se teclee.
  const [ajeno, setAjeno] = React.useState(() => pintarCrudo(crudoProp, idioma).ajeno)
  const ultimoEmitido = React.useRef(crudoProp)
  const cursorPendiente = React.useRef<number | null>(null)
  const ref = React.useRef<HTMLInputElement>(null)

  // Si el formulario guarda algo distinto de lo que este campo le entregó, se
  // pinta lo que guarda: lo limpió tras guardar, precargó otro registro, lo
  // ACOTÓ (la reserva no pasa de los slots libres) o se quedó con el último
  // valor válido porque lo tecleado no se entendía. Así el campo nunca enseña
  // una cifra distinta de la que se va a mandar — que es lo que hacía el
  // `<input type="number">` controlado. Va SIN dependencias a propósito: el
  // valor guardado puede no cambiar (acotar 125 a 12 cuando ya había 12) y aun
  // así lo tecleado hay que corregirlo. Lo que este campo emitió no cuenta como
  // cambio: si no, cada tecla borraría el punto final de «212,500.».
  // Y si cambia el idioma con el campo montado, se repinta con sus signos: el
  // valor es el mismo, pero «1,500.5» leído en italiano sería otra cifra.
  const idiomaPintado = React.useRef(idioma)
  React.useEffect(() => {
    if (crudoProp !== ultimoEmitido.current || idioma !== idiomaPintado.current) {
      ultimoEmitido.current = crudoProp
      idiomaPintado.current = idioma
      const p = pintarCrudo(crudoProp, idioma)
      setTexto(p.texto)
      setAjeno(p.ajeno)
    }
  })

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
    setAjeno(false)
    onCambio(crudo, lectura)
  }

  const lectura = leerCifra(texto, opciones)
  const error = ajeno ? motivoCifraAjena(idioma) : lectura.ok ? null : lectura.error

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
          const r = formatearMientrasEscribe(
            {
              anterior: texto,
              nuevo: el.value,
              cursor: el.selectionStart ?? el.value.length,
              tipoEntrada: (e.nativeEvent as InputEvent).inputType,
            },
            idioma,
          )
          cursorPendiente.current = r.cursor
          setTexto(r.texto)
          emitir(r.texto)
        }}
        onBlur={(e) => {
          // Con un crudo ajeno (B82) no se reformatea al salir: se queda a la
          // vista lo tecleado en el otro idioma, junto a su aviso. Pasarlo por
          // `textoAlSalir` lo leería con la regla italiana y, si allí es
          // válido («1.500,50» → «1.500,5»), lo pintaría como una cifra correcta
          // que no es la que se manda.
          if (!ajeno) setTexto(textoAlSalir(texto, opciones))
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
