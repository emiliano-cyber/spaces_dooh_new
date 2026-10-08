import { describe, it, expect } from 'vitest'
import { formatNumero } from './formato-numero'
import { conteo } from './plural'
import { etiquetaFrecuencia } from './periodos'

// ============================================================================
//  El estándar del 08/10: todo importe o cantidad que se MUESTRA lleva coma
//  cada tres dígitos, al estilo es-MX (2,500 · 1,234,567.5). Los importes van
//  por `formatMonto`; las cantidades, por `formatNumero`.
// ============================================================================

describe('formatNumero', () => {
  it('pone coma cada tres dígitos, también con cuatro (2,500, no 2500)', () => {
    expect(formatNumero(2500)).toBe('2,500')
    expect(formatNumero(1234567)).toBe('1,234,567')
  })

  it('sin decimales por omisión, y con los que se pidan', () => {
    expect(formatNumero(1234.567)).toBe('1,235')
    expect(formatNumero(1234.5, 2)).toBe('1,234.50')
  })

  it('debajo de mil no cambia nada', () => {
    expect(formatNumero(999)).toBe('999')
    expect(formatNumero(0)).toBe('0')
  })

  it('NEGATIVO: no se inventa un número de lo que no lo es', () => {
    expect(formatNumero(Number.NaN)).toBe('—')
    expect(formatNumero(null)).toBe('—')
    expect(formatNumero(undefined)).toBe('—')
  })
})

describe('los contadores de la interfaz llevan la coma', () => {
  it('conteo: «1,532 registros»', () => {
    expect(conteo(1532, 'registro')).toBe('1,532 registros')
    expect(conteo(1, 'registro')).toBe('1 registro')
  })

  it('etiquetaFrecuencia: «6,000 pases al día»', () => {
    expect(etiquetaFrecuencia(6000)).toBe('6,000 pases al día')
  })
})
