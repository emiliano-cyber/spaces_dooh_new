import { describe, it, expect } from 'vitest'
import { fechaDia, propuestaVencida, vigenciaDesde, vigenciaDiasValida } from './propuesta-vigencia'

describe('vigencia de la propuesta (decisión del dueño, 29/10)', () => {
  it('el último día todavía vale; vence el siguiente', () => {
    expect(propuestaVencida('2026-11-28', '2026-11-28')).toBe(false)
    expect(propuestaVencida('2026-11-28', '2026-11-29')).toBe(true)
    expect(propuestaVencida('2026-11-28', '2026-11-01')).toBe(false)
  })

  it('sin fecha (las enviadas antes del 29/10) NUNCA vence', () => {
    expect(propuestaVencida(null, '2099-01-01')).toBe(false)
  })

  it('30 días desde el envío, cruzando mes y año', () => {
    expect(vigenciaDesde('2026-10-29', 30)).toBe('2026-11-28')
    expect(vigenciaDesde('2026-12-15', 30)).toBe('2027-01-14')
    expect(vigenciaDesde('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('una columna date se lee con el día LOCAL, no el de UTC', () => {
    // El driver entrega `date` a medianoche local; `toISOString()` lo correría
    // al día anterior en cualquier zona al oeste de Greenwich.
    expect(fechaDia(new Date(2026, 10, 28))).toBe('2026-11-28')
    expect(fechaDia('2026-11-28')).toBe('2026-11-28')
    expect(fechaDia(null)).toBeNull()
    expect(fechaDia('basura')).toBeNull()
  })

  it('los días configurables son enteros de 1 a 365; lo demás cae a 30', () => {
    expect(vigenciaDiasValida(15)).toBe(15)
    expect(vigenciaDiasValida(365)).toBe(365)
    for (const malo of [0, -3, 366, 2.5, 'x', null, Number.NaN]) {
      expect(vigenciaDiasValida(malo)).toBe(30)
    }
  })
})
