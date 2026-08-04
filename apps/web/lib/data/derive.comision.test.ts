import { describe, it, expect } from 'vitest'
import { divisorDeComision } from './derive'

// ============================================================================
//  Comisión de agencia → divisor. Hallazgo C-2 de la auditoría QA (04/08/2026).
//
//  El nombre engaña: `divisor` MULTIPLICA (neto = bruto × divisor). Se calculaba
//  como `1 - comisionPct/100` sin acotar, así que una comisión de 150% daba
//  -0.5 y el neto salía NEGATIVO. Así se creó en producción la campaña
//  TEST_EdgeCase con presupuesto_neto = -135 333.33, que además se sumaba a los
//  KPI del dashboard y arrastraba el total de la red hacia abajo.
//
//  La regla: el neto nunca es negativo. Una comisión ≥ 100% significa que la
//  agencia se lleva todo, y eso es un neto de CERO.
// ============================================================================

describe('divisorDeComision', () => {
  it('comisión normal descuenta lo que toca', () => {
    expect(divisorDeComision(0)).toBe(1)
    expect(divisorDeComision(15)).toBeCloseTo(0.85)
    expect(divisorDeComision(50)).toBeCloseTo(0.5)
  })

  it('150% NO produce un divisor negativo — la regresión de C-2', () => {
    expect(divisorDeComision(150)).toBe(0)
    // Lo que importa de verdad: el neto derivado no cambia de signo.
    const bruto = 100_000
    expect(bruto * divisorDeComision(150)).toBeGreaterThanOrEqual(0)
  })

  it('100% deja el neto en cero, no en negativo', () => {
    expect(divisorDeComision(100)).toBe(0)
  })

  it('una comisión negativa no infla el neto por encima del bruto', () => {
    // -50 daría 1.5 sin acotar: cobrar MÁS que la tarifa de lista.
    expect(divisorDeComision(-50)).toBe(1)
  })

  it('nulos y basura se tratan como sin comisión, nunca como NaN', () => {
    expect(divisorDeComision(null)).toBe(1)
    expect(divisorDeComision(undefined)).toBe(1)
    expect(divisorDeComision(Number.NaN)).toBe(1)
    expect(divisorDeComision(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('reproduce TEST_EdgeCase: con el bruto real el neto deja de ser negativo', () => {
    // La propuesta hermana mostraba 162 400 en positivo; la campaña, -135 333.33.
    const bruto = 162_400
    expect(bruto * divisorDeComision(150)).toBe(0)
    expect(bruto * divisorDeComision(150)).not.toBeLessThan(0)
  })
})
