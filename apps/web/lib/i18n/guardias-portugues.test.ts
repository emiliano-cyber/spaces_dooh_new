import { describe, it, expect, afterEach } from 'vitest'
import { huellasEnPortugues, HUELLAS_PORTUGUES } from './guardias-portugues'
import { formatearDinero, formatearFecha, formatearNumero, fijarMonedaInstancia } from './dinero'
import { formatMonto, formatFecha, formatFechaHora } from '../data/derive'

// ============================================================================
//  Ola 0 del portugues (2026-11-05) · LA GUARDIA DE FORMATOS DEL HTML pt-BR.
//  En el HTML portugues no puede quedar ni un formato espanol («01 dic 2026»,
//  «$ 1,160.00», «20 de octubre») ni uno ingles («Dec 1, 2026», «10:15 AM»,
//  «55.0%»). Lo que la app escribe en portugues tiene que pasar limpio: eso es
//  lo que dice que la guardia no da falsos positivos.
//
//  Ojo con lo que comparten el espanol y el portugues: «abril» y «agosto» se
//  escriben igual, y «1 de abril de 2026» es portugues correcto.
// ============================================================================

afterEach(() => fijarMonedaInstancia('MXN'))

describe('huellasEnPortugues · lo portugues pasa limpio', () => {
  it('lo que escriben los formateadores en portugues', () => {
    const html = [
      formatearDinero(1160, 'pt'),
      formatearDinero(-1234567.5, 'pt'),
      formatMonto(1160, 'pt'),
      formatMonto(-5, 'pt'),
      formatearFecha('2026-12-01T12:00:00Z', 'pt'),
      formatearFecha('2026-04-01T12:00:00Z', 'pt'),
      formatearFecha('2026-08-01T12:00:00Z', 'pt', { day: 'numeric', month: 'long', year: 'numeric' }),
      formatFecha('2026-12-01', 'pt'),
      formatFechaHora('2026-12-01T15:45:00', 'pt'),
      formatearNumero(1160.5, 'pt'),
      '55,0%',
      '<span title="1 de dezembro de 2026">GPS 19.43262, -99.13321</span>',
    ]
      .map((x) => `<td>${x}</td>`)
      .join('')
    expect(huellasEnPortugues(html)).toEqual([])
  })

  it('una instancia USD: US$ delante, sin huellas', () => {
    fijarMonedaInstancia('USD')
    expect(huellasEnPortugues(`<b>${formatearDinero(1160, 'pt')}</b>`, { moneda: 'USD' })).toEqual([])
  })
})

describe('huellasEnPortugues · caza lo ajeno', () => {
  it.each([
    ['fecha dd/mm/aaaa', '<td>01/12/2026</td>', '01/12/2026'],
    ['fecha larga en español', '<p>20 de octubre de 2026</p>', '20 de octubre'],
    ['fecha larga en español', '<p>5 de septiembre</p>', '5 de septiembre'],
    ['mes corto en español', '<p>01 dic 2026</p>', '01 dic'],
    ['mes corto en español', '<p>5 ene 2026</p>', '5 ene'],
    ['mes corto en español', '<p>12 abr 2026</p>', '12 abr'],
    ['a. m. / p. m.', '<p>10:15 p. m.</p>', 'p. m.'],
    ['fecha en ingles', '<p>Dec 1, 2026</p>', 'Dec 1, 2026'],
    ['mes largo en ingles', '<p>November 2026</p>', 'November 2026'],
    ['AM / PM', '<p>3:45 PM</p>', '3:45 PM'],
    ['cifra con coma de millar', '<p>1,160 spots</p>', '1,160'],
    ['cifra con punto decimal', '<p>55.0%</p>', '55.0'],
    ['dinero sin prefijo', '<p>$ 1.160,00</p>', '$ 1.160,00'],
    ['simbolo pegado a la cifra', '<p>MX$1.160,00</p>', 'MX$1'],
  ])('%s en «%s»', (tipo, html, trozo) => {
    const h = huellasEnPortugues(html)
    expect(h.some((x) => x.startsWith(`${tipo} «${trozo}»`)), h.join(' | ')).toBe(true)
  })

  it('lo que el espanol y el portugues escriben igual NO es huella', () => {
    expect(huellasEnPortugues('<p>1 de abril de 2026 · 15 de agosto de 2026</p>')).toEqual([])
  })

  it('la moneda equivocada: US$ en una instancia MXN y MX$ en una USD', () => {
    expect(huellasEnPortugues('<b>US$ 5,00</b>', { moneda: 'MXN' })[0]).toMatch(/^moneda equivocada/)
    expect(huellasEnPortugues('<b>MX$ 5,00</b>', { moneda: 'USD' })[0]).toMatch(/^moneda equivocada/)
  })

  it('lo declarado como dato no cuenta', () => {
    expect(huellasEnPortugues('<p>Fecha del papel: 01/12/2026</p>', { permitidos: [/^01\/12\/2026$/] })).toEqual([])
  })

  it('cada huella tiene nombre y expresion global', () => {
    for (const [nombre, re] of HUELLAS_PORTUGUES) {
      expect(nombre).not.toBe('')
      expect(re.flags).toContain('g')
    }
  })
})
