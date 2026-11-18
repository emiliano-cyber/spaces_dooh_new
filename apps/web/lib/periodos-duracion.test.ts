import { describe, it, expect } from 'vitest'
import { duracionDesdeFechas, fechaFinDesde } from './periodos'

// ============================================================================
//  v0.12.3 · la duración sale de las fechas cuando se escriben a mano.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-10-22: «en las fechas de propuesta, si alguien pone
//  fecha a mano, se auto ponga lo de días o meses, etc., dependiendo el
//  cálculo». Hasta hoy la cuenta iba en UN solo sentido —duración → fecha
//  «Hasta»— y al teclear la fecha se quedaba la duración vieja («1 mes» con un
//  rango de tres).
//
//  La regla: la unidad MÁS GRANDE que cuadre exacta, con la misma cuenta que el
//  precio (`fechaFinDesde`): meses de calendario, catorcenas de 14, semanas de 7;
//  si ninguna cuadra, días. Y la ida y vuelta tiene que dar la misma fecha.
// ============================================================================

describe('duracionDesdeFechas', () => {
  it('tres meses de calendario exactos → 3 meses', () => {
    expect(duracionDesdeFechas('2026-11-01', '2027-01-31')).toEqual({ cantidad: 3, unidad: 'mensual' })
  })

  it('28 días exactos → 2 catorcenas (antes que 4 semanas)', () => {
    expect(duracionDesdeFechas('2026-11-02', '2026-11-29')).toEqual({ cantidad: 2, unidad: 'catorcenal' })
  })

  it('21 días → 3 semanas', () => {
    expect(duracionDesdeFechas('2026-11-02', '2026-11-22')).toEqual({ cantidad: 3, unidad: 'semanal' })
  })

  it('10 días, que no cuadran con nada → 10 días', () => {
    expect(duracionDesdeFechas('2026-11-02', '2026-11-11')).toEqual({ cantidad: 10, unidad: 'diaria' })
  })

  it('el mismo día → 1 día', () => {
    expect(duracionDesdeFechas('2026-11-02', '2026-11-02')).toEqual({ cantidad: 1, unidad: 'diaria' })
  })

  it('al revés o incompleto → null (no se inventa nada)', () => {
    expect(duracionDesdeFechas('2026-11-10', '2026-11-02')).toBeNull()
    expect(duracionDesdeFechas('', '2026-11-02')).toBeNull()
    expect(duracionDesdeFechas('2026-11-02', '')).toBeNull()
  })

  it('ida y vuelta: la duración calculada da EXACTAMENTE la misma fecha «Hasta»', () => {
    // Si no diera la misma, el formulario recalcularía «Hasta» y se comería lo
    // que la persona acaba de escribir.
    const casos: [string, string][] = [
      ['2026-11-01', '2027-01-31'],
      ['2026-11-02', '2026-11-29'],
      ['2026-11-02', '2026-11-22'],
      ['2026-11-02', '2026-11-11'],
      ['2026-01-31', '2026-02-28'],
      ['2026-11-15', '2027-03-14'],
    ]
    for (const [ini, fin] of casos) {
      const d = duracionDesdeFechas(ini, fin)!
      expect(fechaFinDesde(ini, d.unidad, d.cantidad), `${ini} → ${fin}`).toBe(fin)
    }
  })
})
