import { describe, it, expect } from 'vitest'
import { formatMonto, formatMontoCorto } from './derive'

// ============================================================================
//  M9 de la auditoría del 04/08/2026: formato de moneda inconsistente.
//  Los dos casos citados textualmente en el informe son «$ 4897.5k» junto a
//  «$ 2,505,600.00» en la misma tarjeta, y «$ -156,986.66» sin formato contable.
//
//  Ojo: derive.moneda.test.ts es OTRA cosa — la moneda del tenant y la suma
//  entre monedas distintas. Esto es solo cómo se escribe una cifra.
// ============================================================================

describe('formatMonto', () => {
  it('separa miles y fija dos decimales', () => {
    expect(formatMonto(2505600)).toBe('$ 2,505,600.00')
    expect(formatMonto(0)).toBe('$ 0.00')
  })

  it('pone los negativos entre paréntesis, sin signo suelto', () => {
    expect(formatMonto(-156986.66)).toBe('($ 156,986.66)')
  })
})

describe('formatMontoCorto', () => {
  it('abrevia millones con unidad, no en miles de miles', () => {
    // El caso exacto del informe: 4,897,500 salía como «$ 4897.5k».
    expect(formatMontoCorto(4897500)).toBe('$ 4.9M')
  })

  it('conserva la abreviatura en miles por debajo del millón', () => {
    expect(formatMontoCorto(18500)).toBe('$ 18.5k')
    expect(formatMontoCorto(45000)).toBe('$ 45k')
  })

  it('no arrastra decimales que no aportan', () => {
    expect(formatMontoCorto(5_000_000)).toBe('$ 5M')
    expect(formatMontoCorto(1_000)).toBe('$ 1k')
  })

  it('separa miles cuando la cifra abreviada aún los tiene', () => {
    expect(formatMontoCorto(1_234_500_000)).toBe('$ 1,234.5M')
  })

  it('sube de escala cuando el redondeo desborda, en vez de escribir 1,000.0k', () => {
    // El borde: 999,999 cae en el tramo de miles pero redondea a 1000, y
    // «$ 1,000.0k» es el mismo defecto que este formateador vino a quitar.
    expect(formatMontoCorto(999_999)).toBe('$ 1M')
    expect(formatMontoCorto(999_950)).toBe('$ 1M')
  })

  it('no deja un decimal que el redondeo volvió cero', () => {
    expect(formatMontoCorto(4_999_999)).toBe('$ 5M')
  })

  it('deja las cantidades pequeñas sin abreviar', () => {
    expect(formatMontoCorto(850)).toBe('$ 850')
    expect(formatMontoCorto(0)).toBe('$ 0')
  })

  it('usa el mismo criterio contable en negativos', () => {
    expect(formatMontoCorto(-4897500)).toBe('($ 4.9M)')
  })
})
