import { describe, it, expect } from 'vitest'
import { huellasEnItaliano, HUELLAS_ITALIANO } from './guardias-italiano'
import { formatearDinero, formatearFecha, formatearNumero } from './dinero'
import { formatMonto, formatFecha, formatFechaHora } from '../data/derive'

// ============================================================================
//  Ola 0 del italiano · LA GUARDIA DE FORMATOS DEL HTML ITALIANO.
//  En el HTML italiano no puede quedar ni un formato espanol (01/12/2026,
//  «$ 1,160.00», «20 de octubre») ni uno ingles («Dec 1, 2026», «10:15 AM»,
//  «MX$1,160.00», «55.0%»). Lo que la app escribe en italiano tiene que pasar
//  limpio — eso es lo que dice que la guardia no da falsos positivos.
// ============================================================================

describe('huellasEnItaliano · lo italiano pasa limpio', () => {
  it('lo que escriben los formateadores en italiano', () => {
    const html = [
      formatearDinero(1160, 'it'),
      formatearDinero(-1234567.5, 'it'),
      formatMonto(1160, 'it'),
      formatMonto(-5, 'it'),
      formatearFecha('2026-12-01T12:00:00Z', 'it'),
      formatFecha('2026-12-01', 'it'),
      formatFechaHora('2026-12-01T15:45:00', 'it'),
      formatearNumero(1160.5, 'it'),
      '55,0%',
      '<span title="1 dicembre 2026">GPS 19.43262, -99.13321</span>',
    ]
      .map((x) => `<td>${x}</td>`)
      .join('')
    expect(huellasEnItaliano(html)).toEqual([])
  })
})

describe('huellasEnItaliano · caza lo ajeno', () => {
  it.each([
    ['fecha dd/mm/aaaa', '<td>01/12/2026</td>', '01/12/2026'],
    ['fecha larga en español', '<p>20 de octubre de 2026</p>', '20 de octubre de 2026'],
    ['mes corto en español', '<p>5 ene 2026</p>', '5 ene'],
    ['dia con cero delante', '<p>01 dic 2026</p>', '01 dic'],
    ['a. m. / p. m.', '<p>10:15 p. m.</p>', 'p. m.'],
    ['fecha en ingles', '<p>Dec 1, 2026</p>', 'Dec 1, 2026'],
    ['fecha en ingles', '<p>Nov 30</p>', 'Nov 30'],
    ['mes largo en ingles', '<p>November 2026</p>', 'November 2026'],
    ['AM / PM', '<p>3:45 PM</p>', '3:45 PM'],
    ['cifra con coma de millar', '<p>1,160 spots</p>', '1,160'],
    ['cifra con punto decimal', '<p>55.0%</p>', '55.0'],
    ['dinero sin prefijo', '<p>$ 1.160,00</p>', '$ 1.160,00'],
    ['simbolo pegado a la cifra', '<p>MX$1.160,00</p>', 'MX$1'],
  ])('%s en «%s»', (tipo, html, trozo) => {
    const h = huellasEnItaliano(html)
    expect(h.some((x) => x.startsWith(`${tipo} «${trozo}»`)), h.join(' | ')).toBe(true)
  })

  it('el ingles de una instancia MXN («MX$1,160.00») da DOS huellas: pegado y coma', () => {
    const h = huellasEnItaliano('<b>MX$1,160.00</b>')
    expect(h.map((x) => x.split(' «')[0]).sort()).toEqual(['cifra con coma de millar', 'simbolo pegado a la cifra'])
  })

  it('el espanol de una instancia MXN («$ 1,160.00»): sin prefijo y coma', () => {
    const h = huellasEnItaliano('<b>$ 1,160.00</b>')
    expect(h.map((x) => x.split(' «')[0])).toContain('dinero sin prefijo')
  })

  it('en una instancia USD, el MX$ es ajeno', () => {
    expect(huellasEnItaliano('<b>MX$ 5,00</b>', { moneda: 'USD' })[0]).toMatch(/^moneda equivocada/)
    expect(huellasEnItaliano('<b>US$ 5,00</b>', { moneda: 'USD' })).toEqual([])
    expect(huellasEnItaliano('<b>US$ 5,00</b>')[0]).toMatch(/^moneda equivocada/)
  })

  it('permitidos se prueban contra el trozo', () => {
    expect(huellasEnItaliano('<p>v0.12.5</p>')).toEqual([])
    expect(huellasEnItaliano('<p>Tasa 1.5</p>')).toHaveLength(1)
    expect(huellasEnItaliano('<p>Tasa 1.5</p>', { permitidos: [/^1\.5$/] })).toEqual([])
  })

  it('cada huella tiene nombre', () => {
    expect(HUELLAS_ITALIANO.length).toBeGreaterThanOrEqual(12)
  })
})
