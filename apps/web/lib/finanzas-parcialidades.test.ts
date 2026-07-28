import { describe, it, expect } from 'vitest'
import { duracionMeses, opcionesParcialidad } from './finanzas-calculo'

// ============================================================================
//  Qué parcialidades caben en una campaña. Regla única: las cuotas deben salir
//  ENTERAS y ser al menos 2 — cobrar en "una parcialidad" no es fraccionar el
//  pago, es el cobro único de siempre.
//
//  De ahí salen solas las restricciones pedidas:
//    · 1 mes  → nada mensual ni bimestral; solo quincenal (2 cuotas)
//    · 2 meses→ como mucho mensual
//    · anual  → solo a partir de 24 meses (12 daría 1 sola cuota)
// ============================================================================

const per = (meses: number) => opcionesParcialidad(meses).map((o) => o.periodicidad)
const cuotasDe = (meses: number, p: string) =>
  opcionesParcialidad(meses).find((o) => o.periodicidad === p)?.cuotas

describe('duracionMeses', () => {
  it('un mes natural cuenta como 1', () => {
    expect(duracionMeses('2026-08-01', '2026-08-31')).toBe(1)
  })

  it('a caballo entre meses también, si son ~30 días', () => {
    expect(duracionMeses('2026-07-14', '2026-08-13')).toBe(1)
  })

  it('un año aunque no cierre en fecha exacta', () => {
    expect(duracionMeses('2026-07-30', '2027-07-24')).toBe(12)
  })

  it('dos años', () => {
    expect(duracionMeses('2026-01-01', '2027-12-31')).toBe(24)
  })

  it('fechas invertidas o inválidas dan 0, no un negativo', () => {
    expect(duracionMeses('2027-01-01', '2026-01-01')).toBe(0)
    expect(duracionMeses('no-es-fecha', '2026-01-01')).toBe(0)
  })
})

describe('restricciones por duración de la campaña', () => {
  it('1 mes: solo quincenal, y da 2 cuotas', () => {
    expect(per(1)).toEqual(['QUINCENAL'])
    expect(cuotasDe(1, 'QUINCENAL')).toBe(2)
    // Lo pedido explícitamente: con un mes no puede ser bimestral.
    expect(per(1)).not.toContain('BIMESTRAL')
    expect(per(1)).not.toContain('MENSUAL')
  })

  it('2 meses: como mucho mensual', () => {
    expect(per(2)).toEqual(['QUINCENAL', 'MENSUAL'])
    expect(cuotasDe(2, 'MENSUAL')).toBe(2)
    expect(per(2)).not.toContain('BIMESTRAL')
  })

  it('12 meses: NO ofrece anual, porque sería una sola cuota', () => {
    expect(per(12)).not.toContain('ANUAL')
    expect(per(12)).toContain('SEMESTRAL')
    expect(cuotasDe(12, 'MENSUAL')).toBe(12)
    expect(cuotasDe(12, 'SEMESTRAL')).toBe(2)
  })

  it('24 meses (múltiplo de 12): ya sí ofrece anual, con 2 cuotas', () => {
    expect(per(24)).toContain('ANUAL')
    expect(cuotasDe(24, 'ANUAL')).toBe(2)
    expect(cuotasDe(24, 'TRIMESTRAL')).toBe(8)
  })

  it('36 meses: anual da 3', () => {
    expect(cuotasDe(36, 'ANUAL')).toBe(3)
  })

  it('duración que no divide exacto no ofrece esa periodicidad', () => {
    // 5 meses: bimestral daría 2.5 cuotas y trimestral 1.67 → fuera.
    expect(per(5)).toEqual(['QUINCENAL', 'MENSUAL'])
  })

  it('sin duración no se ofrece nada (no se puede fraccionar la nada)', () => {
    expect(opcionesParcialidad(0)).toEqual([])
  })

  it('toda opción ofrecida da SIEMPRE 2 cuotas o más', () => {
    for (let m = 0; m <= 48; m++) {
      for (const o of opcionesParcialidad(m)) {
        expect(o.cuotas, `${m} meses en ${o.periodicidad}`).toBeGreaterThanOrEqual(2)
        expect(Number.isInteger(o.cuotas), `${m} meses en ${o.periodicidad}`).toBe(true)
      }
    }
  })
})
