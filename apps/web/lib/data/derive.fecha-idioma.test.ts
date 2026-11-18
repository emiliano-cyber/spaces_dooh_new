import { describe, it, expect } from 'vitest'
import { formatFecha, formatFechaHora } from './derive'

// ============================================================================
//  formatFecha / formatFechaHora con IDIOMA (decision del dueno, 2026-11-02).
// ----------------------------------------------------------------------------
//  En ingles la fecha cambia de FORMATO y nunca de DIA: «01/12/2026» lo lee un
//  estadounidense como 12 de enero, asi que en `en` sale «Dec 1, 2026». El
//  espanol es el de siempre, con y sin el parametro: hay ~80 llamadores que no
//  lo pasan y no pueden notar nada.
// ============================================================================

describe('formatFecha · el espanol NO cambia', () => {
  it('sin idioma, dd/mm/aaaa como siempre', () => {
    expect(formatFecha('2026-12-01')).toBe('01/12/2026')
    expect(formatFecha('2026-08-29')).toBe('29/08/2026')
  })
  it("con 'es' explicito, exactamente lo mismo que sin idioma", () => {
    for (const f of ['2026-12-01', '2028-02-29', '2026-01-05T10:30:00', '2026-11-30']) {
      expect(formatFecha(f, 'es')).toBe(formatFecha(f))
    }
  })
  it('una fecha invalida en espanol sigue saliendo como antes (no se toco esa rama)', () => {
    expect(formatFecha('basura', 'es')).toBe(formatFecha('basura'))
  })
})

describe('formatFecha · ingles sin ambiguedad', () => {
  it('mes con nombre, dia y ano: «Dec 1, 2026»', () => {
    expect(formatFecha('2026-12-01', 'en')).toBe('Dec 1, 2026')
    expect(formatFecha('2028-02-29', 'en')).toBe('Feb 29, 2028')
  })
  it('el MISMO dia que en espanol: la fecha de calendario no se corre por zona', () => {
    // «YYYY-MM-DD» se construye a medianoche LOCAL en las dos ramas.
    expect(formatFecha('2026-01-01', 'es')).toBe('01/01/2026')
    expect(formatFecha('2026-01-01', 'en')).toBe('Jan 1, 2026')
  })
  it('una fecha invalida no revienta: `Intl` lanzaria RangeError', () => {
    expect(formatFecha('basura', 'en')).toBe('—')
  })
})

describe('formatFechaHora', () => {
  // Hora LOCAL, sin «Z»: la prueba no depende de la zona de la maquina.
  const iso = '2026-12-01T15:45:00'
  it('el espanol NO cambia: dd/mm/aaaa HH:mm', () => {
    expect(formatFechaHora(iso)).toBe('01/12/2026 15:45')
    expect(formatFechaHora(iso, 'es')).toBe('01/12/2026 15:45')
  })
  it('en ingles: «Dec 1, 2026, 3:45 PM»', () => {
    // ICU puede separar «PM» con un espacio estrecho (U+202F): se normaliza.
    expect(formatFechaHora(iso, 'en').replace(/ /g, ' ')).toBe('Dec 1, 2026, 3:45 PM')
  })
  it('vacia o invalida: «—» en los dos', () => {
    expect(formatFechaHora('', 'en')).toBe('—')
    expect(formatFechaHora('basura', 'en')).toBe('—')
    expect(formatFechaHora('basura')).toBe('—')
  })
})
