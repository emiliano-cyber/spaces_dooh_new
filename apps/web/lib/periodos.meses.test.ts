import { describe, it, expect } from 'vitest'
import { fechaFinDesde, periodosEnRango, cantidadEfectiva } from './periodos'

// ============================================================================
//  Los meses son MESES DE CALENDARIO (decisión del dueño, 2026-10-02).
// ----------------------------------------------------------------------------
//  El dueño lo encontró en «Nueva propuesta»: «elijo mes 2 y se los resta en
//  vez de sumar». Con la regla de antes —1 mes = 30 días— «Desde 05/10 · 2
//  meses» terminaba el 03/12: el día de fin RETROCEDÍA respecto al de inicio
//  con cada mes. Y el precio, que dividía los días entre 30 redondeando hacia
//  ARRIBA, cobraba 2 meses por 01/10–31/10 (31 días).
//
//  La fecha «Hasta» y la cuenta de meses que se cobran cambian JUNTAS: si solo
//  cambiara la fecha, 05/10–04/12 (61 días) se cobraría como 3 meses.
// ============================================================================

describe('fechaFinDesde · mensual en meses de calendario', () => {
  it('05/10 + 1 mes termina el 04/11, y + 2 meses el 04/12 (no el 03/12)', () => {
    expect(fechaFinDesde('2026-10-05', 'mensual', 1)).toBe('2026-11-04')
    expect(fechaFinDesde('2026-10-05', 'mensual', 2)).toBe('2026-12-04')
  })

  it('desde el día 1, el mes termina el último día del mes', () => {
    expect(fechaFinDesde('2026-10-01', 'mensual', 1)).toBe('2026-10-31')
    expect(fechaFinDesde('2026-02-01', 'mensual', 1)).toBe('2026-02-28')
  })

  it('cruza el año', () => {
    expect(fechaFinDesde('2026-12-20', 'mensual', 1)).toBe('2027-01-19')
    expect(fechaFinDesde('2026-11-15', 'mensual', 3)).toBe('2027-02-14')
  })

  it('si el día no existe en el mes de llegada, termina el último día de ese mes', () => {
    // 31/01 + 1 mes: no hay 31 de febrero → el mes es todo febrero restante.
    expect(fechaFinDesde('2027-01-31', 'mensual', 1)).toBe('2027-02-28')
    expect(fechaFinDesde('2028-01-31', 'mensual', 1)).toBe('2028-02-29') // bisiesto
    expect(fechaFinDesde('2026-03-31', 'mensual', 1)).toBe('2026-04-30')
  })

  it('semanas, catorcenas y días NO cambian', () => {
    expect(fechaFinDesde('2026-10-05', 'semanal', 3)).toBe('2026-10-25')
    expect(fechaFinDesde('2026-10-05', 'catorcenal', 1)).toBe('2026-10-18')
    expect(fechaFinDesde('2026-10-05', 'diaria', 10)).toBe('2026-10-14')
  })
})

describe('periodosEnRango · los meses que se cobran', () => {
  it('lo que da fechaFinDesde se cobra exactamente como esos meses', () => {
    for (const desde of ['2026-10-05', '2026-01-31', '2026-12-20', '2026-02-01']) {
      for (const n of [1, 2, 3, 6, 12]) {
        expect(periodosEnRango('mensual', desde, fechaFinDesde(desde, 'mensual', n))).toBe(n)
      }
    }
  })

  it('NEGATIVA · 01/10–31/10 es 1 mes, no 2 (antes: 31 días ÷ 30 hacia arriba)', () => {
    expect(periodosEnRango('mensual', '2026-10-01', '2026-10-31')).toBe(1)
  })

  it('un día más allá del mes ya es el segundo mes', () => {
    expect(periodosEnRango('mensual', '2026-10-05', '2026-11-05')).toBe(2)
  })

  it('menos de un mes cuenta como 1', () => {
    expect(periodosEnRango('mensual', '2026-10-05', '2026-10-20')).toBe(1)
    expect(periodosEnRango('mensual', '2026-10-05', '2026-10-05')).toBe(1)
  })

  it('las propuestas de antes con 30 días siguen siendo 1 mes', () => {
    expect(periodosEnRango('mensual', '2026-10-05', '2026-11-03')).toBe(1)
    expect(periodosEnRango('mensual', '2026-10-05', '2026-12-03')).toBe(2)
  })

  it('semanas y catorcenas siguen igual', () => {
    expect(periodosEnRango('semanal', '2026-10-05', '2026-10-25')).toBe(3)
    expect(periodosEnRango('catorcenal', '2026-10-05', '2026-10-19')).toBe(2)
  })

  it('cantidadEfectiva usa la misma cuenta', () => {
    expect(cantidadEfectiva('mensual', '2026-10-01', '2026-10-31')).toBe(1)
  })
})
