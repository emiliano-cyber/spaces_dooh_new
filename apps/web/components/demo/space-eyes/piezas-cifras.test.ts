import { describe, it, expect } from 'vitest'
import { cifra, fijo, gigas } from './piezas'

// ============================================================================
//  LAS CIFRAS DE SPACE EYES EN LOS TRES IDIOMAS (lote L1 del italiano).
// ----------------------------------------------------------------------------
//  `fijo`, `cifra` y `gigas` sustituyen a `toFixed` / `String` en el modulo.
//  En es y en tienen que dar EXACTAMENTE lo de antes —sin agrupar, con punto—
//  (validacion L1, mutante V3: pasar el espanol por `Intl` agrupaba «1,234.57»
//  y no lo veia nadie); en italiano, coma decimal y punto de millar (V2: que
//  `cifra` ignorara el idioma tampoco lo veia nadie).
// ============================================================================

const BORDES = [0, -0, 1, -1, 0.5, 1.005, 2.345, -2.5, 999.95, 1000, 1234.5678, -1234.5, 1e21, 1e-7, NaN, Infinity, -Infinity, 0.812, 63.3, 1440]

describe('fijo / cifra / gigas · en espanol e ingles, lo de siempre', () => {
  for (const idioma of ['es', 'en'] as const) {
    it(`fijo = toFixed (${idioma})`, () => {
      for (const n of BORDES) for (const d of [0, 1, 2, 3]) expect(fijo(n, d, idioma), `${n}/${d}`).toBe(n.toFixed(d))
    })
    it(`cifra = String (${idioma})`, () => {
      for (const n of BORDES) expect(cifra(n, idioma)).toBe(String(n))
    })
    it(`gigas como antes (${idioma})`, () => {
      expect(gigas(null, idioma)).toBe('—')
      expect(gigas(3.1 * 1024 ** 3, idioma)).toBe('3.10 GB')
      expect(gigas(512 * 1024 ** 2, idioma)).toBe('512 MB')
    })
  }
  it('por omision, espanol', () => {
    expect(fijo(1234.5678, 2)).toBe('1234.57')
    expect(cifra(2.5)).toBe('2.5')
    expect(gigas(3.1 * 1024 ** 3)).toBe('3.10 GB')
  })
  it('el SSIM en ingles sigue con punto', () => {
    expect(fijo(0.812, 3, 'en')).toBe('0.812')
  })
})

describe('fijo / cifra / gigas · en italiano, coma decimal y punto de millar', () => {
  it('fijo', () => {
    expect(fijo(0.812, 3, 'it')).toBe('0,812')
    expect(fijo(63.3, 1, 'it')).toBe('63,3')
    expect(fijo(1.2, 1, 'it')).toBe('1,2')
    expect(fijo(0, 2, 'it')).toBe('0,00')
    expect(fijo(1234.5678, 2, 'it')).toBe('1.234,57')
  })
  it('cifra', () => {
    expect(cifra(2.5, 'it')).toBe('2,5')
    expect(cifra(1440, 'it')).toBe('1.440')
    expect(cifra(3, 'it')).toBe('3')
  })
  it('gigas', () => {
    expect(gigas(3.1 * 1024 ** 3, 'it')).toBe('3,10 GB')
    expect(gigas(2048 * 1024 ** 2 - 1, 'it')).toBe('2,00 GB')
    expect(gigas(512 * 1024 ** 2, 'it')).toBe('512 MB')
  })
})
