import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { esFechaValida, fechaZod, diaComparable, ordenInvertido } from './fechas'

// ============================================================================
//  VAL-05 · «la fecha tiene que ser una fecha» estaba escrita CUATRO veces.
// ----------------------------------------------------------------------------
//  El 26/08 (UX-01) se descubrió que `contratoSchema` aceptaba «mañana» como
//  fecha y el valor llegaba crudo a un `$1::date`, así que el usuario recibía un
//  500 del driver en vez de un 400 que le dijera qué escribió mal. Se arregló en
//  arrendadores-controller… y solo ahí.
//
//  El mismo `z.string().min(1)` seguía en `extenderCampana`, en el primer
//  vencimiento de la facturación y en la fecha de la ODC. Mantener la regla
//  copiada es exactamente lo que le pasó al RFC: se corrige una copia y las
//  otras se quedan atrás sin que nada avise. Vive una sola vez y se prueba aquí.
// ============================================================================

describe('esFechaValida', () => {
  it('acepta las formas que manda la aplicación de verdad', () => {
    expect(esFechaValida('2026-08-26')).toBe(true)
    expect(esFechaValida('2026-08-26T12:00:00.000Z')).toBe(true)
    expect(esFechaValida('  2026-08-26  ')).toBe(true)
  })

  it('rechaza lo que no es una fecha', () => {
    // «mañana» es el valor exacto que destapó UX-01.
    expect(esFechaValida('mañana')).toBe(false)
    expect(esFechaValida('')).toBe(false)
    expect(esFechaValida('   ')).toBe(false)
    expect(esFechaValida(null)).toBe(false)
    expect(esFechaValida(undefined)).toBe(false)
    expect(esFechaValida(42)).toBe(false)
  })
})

describe('fechaZod', () => {
  const s = z.object({ cuando: fechaZod('Falta la fecha') })

  it('deja pasar una fecha y conserva el texto tal cual', () => {
    expect(s.parse({ cuando: ' 2026-08-26 ' }).cuando).toBe('2026-08-26')
  })

  it('rechaza el vacío con el mensaje que se le dio', () => {
    const r = s.safeParse({ cuando: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Falta la fecha')
  })

  it('rechaza lo que no es fecha con «Fecha inválida»', () => {
    const r = s.safeParse({ cuando: 'mañana' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Fecha inválida')
  })
})

describe('diaComparable / ordenInvertido', () => {
  it('compara por CALENDARIO, no como texto', () => {
    // El caso que destapó el control positivo de UX-01: como cadenas,
    // '2026-9-1' > '2026-10-01', y un contrato correcto se rechazaba.
    expect(ordenInvertido('2026-9-1', '2026-10-01')).toBe(false)
    expect(ordenInvertido('2026-10-01', '2026-9-1')).toBe(true)
  })

  it('el mismo día no está invertido', () => {
    expect(ordenInvertido('2026-08-26', '2026-08-26')).toBe(false)
  })

  it('una fecha que no se puede reducir a un día queda FUERA de la comparación', () => {
    // Antes que compararla mal. Los CHECK de la base siguen detrás.
    expect(diaComparable('March 3, 2026')).toBeNull()
    expect(ordenInvertido('March 3, 2026', '2020-01-01')).toBe(false)
  })
})
