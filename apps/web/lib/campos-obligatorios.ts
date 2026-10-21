// ============================================================================
//  lib/campos-obligatorios.ts — qué obligatorio falta en un formulario (OBLIG-01).
//
//  Puro y sin React a propósito: lo usa `useObligatorios`
//  (`components/demo/ui/Campo.tsx`) y se prueba aquí, que es donde se puede.
// ============================================================================

/** Un obligatorio, o uno que solo lo es si `si` se cumple (p. ej. la comisión
 *  solo cuando el cliente es una agencia). */
export type ReglaObligatorio = string | { campo: string; si: boolean }

/**
 * ¿Falta este dato? Vacío es: nada, texto en blanco, una cifra que no se
 * entiende (`NaN`, o la cadena 'NaN' que deja `CampoCifra` al no poder leer) y
 * una lista sin elementos. El CERO no es vacío —una comisión de 0 % es un dato—
 * y `false` tampoco: es una respuesta.
 */
export function estaVacio(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'number') return Number.isNaN(v)
  if (typeof v === 'string') {
    const t = v.trim()
    return t === '' || t === 'NaN'
  }
  if (Array.isArray(v)) return v.length === 0
  return false
}

/** Los obligatorios vacíos, en el orden en que se declararon. */
export function camposFaltantes(valores: Record<string, unknown>, reglas: ReglaObligatorio[]): string[] {
  const faltan: string[] = []
  for (const r of reglas) {
    const campo = typeof r === 'string' ? r : r.campo
    if (typeof r !== 'string' && !r.si) continue
    if (estaVacio(valores[campo])) faltan.push(campo)
  }
  return faltan
}
