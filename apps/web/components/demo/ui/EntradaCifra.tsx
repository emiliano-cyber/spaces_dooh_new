'use client'

import * as React from 'react'
import type { Idioma } from '@/lib/i18n/idiomas'
import { useIdioma } from '@/lib/i18n/contexto'
import { comaDecimal } from '@/lib/captura-cifra'
import { CampoCifra } from './CampoCifra'

// ============================================================================
//  EntradaCifra · un campo de cifra que en español e inglés es EXACTAMENTE el
//  `<input>` de siempre y en italiano es un `CampoCifra` con los signos
//  italianos (P-L2-1, decisión del dueño del 2026-11-04).
// ----------------------------------------------------------------------------
//  Para los campos que NO eran `CampoCifra`: medidas, caras, segundos,
//  porcentajes, cupos… Hacían `Number(texto)` sobre lo tecleado, que en
//  español e inglés es lo correcto (punto decimal) y en italiano no: «12,9» en
//  el ancho de una pantalla daba `NaN` → `|| 0` → una pantalla de 0 metros, y
//  «1.500» en una cantidad daba 1,5.
//
//  ESPAÑOL E INGLÉS: se pinta el MISMO `<input>`, con los atributos en el
//  MISMO orden (el HTML sale idéntico byte a byte; lo mide el volcado de toda
//  la suite) y el padre recibe lo tecleado tal cual, como antes.
//
//  ITALIANO: el padre recibe lo que entrega `CampoCifra` —la cifra con punto
//  decimal y sin separadores («12.9»), o `'NaN'` (`CRUDO_INVALIDO`) si no se
//  entiende—, así que su `Number(x)` sigue valiendo sin tocarlo. Lo único que
//  el padre añade es BLOQUEAR el envío con `cifraIlegible(x, idioma)`, que en
//  español e inglés es siempre `false` (un «NaN» tecleado a mano allí sigue
//  haciendo lo de siempre).
// ============================================================================

type AtributosInput = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'>

export interface EntradaCifraProps extends AtributosInput {
  /** Lo que guarda el formulario (lo tecleado en es/en; la cifra canónica en it). */
  valor: string
  onCambio: (crudo: string) => void
  /** Decimales que admite en italiano: 2 en medidas e importes, 0 en cantidades. */
  decimales: number
  /** Mínimo en italiano. `null` = admite negativos. */
  minimo: number | null
  maximo?: number
  idioma?: Idioma
}

const SOLO_ITALIANO = new Set(['decimales', 'minimo', 'maximo', 'idioma'])

export function EntradaCifra(props: EntradaCifraProps) {
  const idiomaPantalla = useIdioma().idioma
  const idioma = props.idioma ?? idiomaPantalla
  if (!comaDecimal(idioma)) {
    // Los atributos se copian EN EL ORDEN en que llegaron, cambiando `valor`
    // por `value` y `onCambio` por `onChange` en su sitio: React pinta los
    // atributos en el orden del objeto, y el HTML tiene que ser el de antes.
    const atributos: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(props)) {
      if (k === 'valor') atributos.value = v
      else if (k === 'onCambio') atributos.onChange = (e: React.ChangeEvent<HTMLInputElement>) => props.onCambio(e.target.value)
      else if (!SOLO_ITALIANO.has(k)) atributos[k] = v
    }
    return <input {...(atributos as React.InputHTMLAttributes<HTMLInputElement>)} />
  }
  // Lo que el `type="number"` traía y `CampoCifra` decide por su cuenta.
  const {
    valor,
    onCambio,
    decimales,
    minimo,
    maximo,
    idioma: _idioma,
    type: _type,
    min: _min,
    max: _max,
    step: _step,
    inputMode: _inputMode,
    ...resto
  } = props
  return (
    <CampoCifra
      {...resto}
      idioma={idioma}
      valor={valor}
      onCambio={(crudo) => onCambio(crudo)}
      decimales={decimales}
      minimo={minimo}
      maximo={maximo}
    />
  )
}
