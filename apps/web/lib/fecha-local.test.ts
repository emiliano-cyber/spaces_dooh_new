import { describe, it, expect } from 'vitest'
import { fechaLocalISO } from './fecha-local'

// «Hoy» en la hora de quien mira, como AAAA-MM-DD. `toISOString()` da el día
// en UTC, y en México a partir de las 18:00 (o 19:00 en horario de verano) ya
// sería mañana: una OT capturada a las 20:00 nacía programada para el día
// siguiente.
describe('fechaLocalISO', () => {
  it('da el día LOCAL, también de noche', () => {
    expect(fechaLocalISO(new Date(2026, 9, 8, 23, 30))).toBe('2026-10-08')
  })

  it('a medianoche y con meses y días de un dígito, con su cero', () => {
    expect(fechaLocalISO(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05')
  })
})
