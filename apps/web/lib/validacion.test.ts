import { describe, it, expect } from 'vitest'
import { esEmailValido, esTelefonoValido, esCpValido } from './validacion'

// ============================================================================
//  M1 de la auditoría del 04/08/2026: «El formulario acepta correo
//  "correo-invalido", teléfono "abc123xyz" y C.P. "99" sin error».
//  Los tres casos citados están abajo, literales.
// ============================================================================

describe('esEmailValido', () => {
  it('rechaza el caso del informe', () => {
    expect(esEmailValido('correo-invalido')).toBe(false)
  })

  it('acepta uno normal y recorta espacios', () => {
    expect(esEmailValido('cuentas@cliente.com')).toBe(true)
    expect(esEmailValido('  cuentas@cliente.com  ')).toBe(true)
  })

  it('exige dominio con punto', () => {
    expect(esEmailValido('alguien@localhost')).toBe(false)
  })
})

describe('esTelefonoValido', () => {
  it('rechaza el caso del informe', () => {
    expect(esTelefonoValido('abc123xyz')).toBe(false)
  })

  it('acepta las formas en que la gente escribe el mismo número', () => {
    // Las tres son 55 1234 5678. Rechazarlas obligaría a limpiar a mano un dato
    // que el sistema normaliza solo.
    expect(esTelefonoValido('5512345678')).toBe(true)
    expect(esTelefonoValido('55 1234 5678')).toBe(true)
    expect(esTelefonoValido('(55) 1234-5678')).toBe(true)
    expect(esTelefonoValido('+52 55 1234 5678')).toBe(true)
  })

  it('rechaza lo que tiene pinta de dato a medias', () => {
    expect(esTelefonoValido('99')).toBe(false)
    expect(esTelefonoValido('123456789')).toBe(false) // 9 dígitos
  })

  it('rechaza pasado el máximo de E.164', () => {
    expect(esTelefonoValido('1234567890123456')).toBe(false) // 16 dígitos
  })

  it('vacío es válido: el teléfono es opcional', () => {
    expect(esTelefonoValido('')).toBe(true)
    expect(esTelefonoValido('   ')).toBe(true)
  })

  it('no cuela texto mezclado con dígitos suficientes', () => {
    // El modo de fallo real: «55 1234 5678 ext. 12» tiene letras, y colarlo
    // dejaría un teléfono al que no se puede marcar.
    expect(esTelefonoValido('55 1234 5678 ext 12')).toBe(false)
  })
})

describe('esCpValido', () => {
  it('rechaza el caso del informe', () => {
    expect(esCpValido('99')).toBe(false)
  })

  it('acepta cinco dígitos exactos', () => {
    expect(esCpValido('06700')).toBe(true)
  })

  it('rechaza seis dígitos y letras', () => {
    expect(esCpValido('067001')).toBe(false)
    expect(esCpValido('0670A')).toBe(false)
  })

  it('vacío es válido: es opcional', () => {
    expect(esCpValido('')).toBe(true)
  })
})
