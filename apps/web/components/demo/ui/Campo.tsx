'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { camposFaltantes, type ReglaObligatorio } from '@/lib/campos-obligatorios'

// ============================================================================
//  OBLIG-01 · el campo de un formulario de alta o edición.
//
//  Regla del dueño (20/10): el obligatorio lleva asterisco; el opcional, solo
//  su nombre (nada de «(opcional)»); y si al guardar falta un obligatorio, ESE
//  campo se pinta en rojo con «Falta este dato» debajo. Antes cada pantalla
//  tenía su propio `Campo` local —más de una docena, todos distintos— y casi
//  ninguno decía cuál era obligatorio: el usuario se enteraba al recibir un
//  400 del servidor, sin saber de qué campo.
//
//  El rojo NO sale al abrir el formulario, solo después del primer intento de
//  guardar (`useObligatorios().validar()`): un formulario recién abierto lleno
//  de rojo regaña por algo que la persona todavía no ha tenido ocasión de hacer.
//
//  El borde rojo del control lo pone `app/(app)/demo.css` (`[data-falta]`), así sirve
//  igual para un <input>, un <select>, un <textarea> o un `CampoCifra` sin que
//  cada uno tenga que enterarse.
// ============================================================================

export function Campo({
  label,
  obligatorio = false,
  falta = false,
  error,
  como = 'label',
  className,
  children,
}: {
  label: React.ReactNode
  obligatorio?: boolean
  /** Obligatorio y vacío tras intentar guardar: se pinta en rojo. */
  falta?: boolean
  /** Otro motivo concreto (formato, rango). Gana sobre «Falta este dato». */
  error?: string | null
  /** `div` cuando dentro hay varios controles o botones: un <label> que
   *  envuelve botones dispara el primero al pulsar el texto. */
  como?: 'label' | 'div'
  className?: string
  children: React.ReactNode
}) {
  const Envoltura = como
  const mensaje = error || (falta ? 'Falta este dato' : null)
  return (
    <Envoltura className={cn('block', className)} data-falta={mensaje ? 'true' : undefined}>
      <span className={cn('mb-1 block text-[12px] font-medium', mensaje ? 'text-error' : 'text-ink')}>
        {label}
        {obligatorio && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-error">
              *
            </span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        )}
      </span>
      {children}
      {mensaje ? (
        <span role="alert" className="mt-1 block text-[11px] text-error">
          {mensaje}
        </span>
      ) : null}
    </Envoltura>
  )
}

/**
 * Lleva la cuenta de qué obligatorio falta en un formulario.
 *
 *   const ob = useObligatorios({ nombre, email }, ['nombre'])
 *   <Campo label="Nombre" obligatorio falta={ob.falta('nombre')}>…
 *   function guardar() { if (!ob.validar()) return; … }
 *
 * El botón de guardar NO se deshabilita por un obligatorio vacío: si lo
 * estuviera, la persona nunca vería cuál le falta, que es justo lo que pidió
 * el dueño. Se pulsa, se pinta el rojo y no se manda nada.
 */
export function useObligatorios(valores: Record<string, unknown>, reglas: ReglaObligatorio[]) {
  const [intento, setIntento] = React.useState(false)
  const faltan = camposFaltantes(valores, reglas)
  return {
    intento,
    faltan,
    falta: (campo: string) => intento && faltan.includes(campo),
    /** Marca el intento y dice si se puede guardar. */
    validar: () => {
      setIntento(true)
      return faltan.length === 0
    },
    reiniciar: () => setIntento(false),
  }
}
