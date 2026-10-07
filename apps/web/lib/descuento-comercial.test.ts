import { describe, it, expect } from 'vitest'
import { pctConDosDecimales } from './descuento-comercial'

// Pedido del dueño (06/10): el descuento comercial se muestra por omisión como
// 0.00, no vacío ni «0» a secas.
describe('pctConDosDecimales', () => {
  it('sin descuento dice 0.00', () => {
    expect(pctConDosDecimales(0)).toBe('0.00')
  })

  it('lo que falte o no sea número también es 0.00', () => {
    expect(pctConDosDecimales(null)).toBe('0.00')
    expect(pctConDosDecimales(undefined)).toBe('0.00')
    expect(pctConDosDecimales(Number.NaN)).toBe('0.00')
  })

  it('siempre con dos decimales', () => {
    expect(pctConDosDecimales(12.5)).toBe('12.50')
    expect(pctConDosDecimales(15)).toBe('15.00')
  })
})
