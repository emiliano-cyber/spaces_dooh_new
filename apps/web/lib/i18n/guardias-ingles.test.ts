import { describe, it, expect } from 'vitest'
import { huellasDeFormatoEspanol, textoLegible, HUELLAS } from './guardias-ingles'

describe('huellasDeFormatoEspanol', () => {
  it('un importe con MX$ y una fecha inglesa estan limpios', () => {
    expect(huellasDeFormatoEspanol('<td>MX$ 10,000.00</td><td>Oct 2, 2026</td><td>Oct 2, 2026, 10:15 AM</td>')).toEqual([])
  })

  it('caza el dinero sin MX$ (con y sin espacio) y la fecha dd/mm/aaaa', () => {
    const h = huellasDeFormatoEspanol('<td>$ 10,000.00</td><td>$9.50</td><td>02/10/2026</td>')
    expect(h).toHaveLength(3)
    expect(h[0]).toMatch(/dinero sin MX\$ «\$ 10,000\.00»/)
    expect(h[2]).toMatch(/fecha dd\/mm\/aaaa «02\/10\/2026»/)
  })

  // Las que tenia Space Eyes en su prueba y las que pidieron los validadores
  // (costura 2). Cada una, sola, tiene que dar exactamente su huella.
  it.each([
    ['fecha larga en español', '<p>Document frozen on 20 de octubre de 2026, 9:00</p>', '20 de octubre de 2026'],
    ['fecha larga en español', '<p>Since 3 de marzo</p>', '3 de marzo'],
    ['mes corto en español', '<p>02 nov 2026, 10:15</p>', '02 nov'],
    ['mes corto en español', '<p>5 sept. 2026</p>', '5 sept.'],
    ['fecha corta con guion', '<td>02-nov, 12:30</td>', '02-nov'],
    ['a. m. / p. m.', '<td>Oct 2, 2026, 10:15 a. m.</td>', 'a. m.'],
    ['a. m. / p. m.', '<td>10:15 p.m.</td>', 'p.m.'],
  ])('caza %s en «%s»', (tipo, html, trozo) => {
    const h = huellasDeFormatoEspanol(html)
    expect(h).toHaveLength(1)
    expect(h[0].startsWith(`${tipo} «${trozo}»`)).toBe(true)
  })

  it('el ingles con meses en ingles no salta (Nov 2 · 2-Nov · 10:15 AM · «a man» · 12 marginal)', () => {
    expect(huellasDeFormatoEspanol('<p>Nov 2, 2026 · 2-Nov · 10:15 AM · a man · 12 marginal</p>')).toEqual([])
  })

  it('mira los atributos que se leen: title, aria-label, placeholder y alt', () => {
    for (const atr of ['title', 'aria-label', 'placeholder', 'alt']) {
      expect(huellasDeFormatoEspanol(`<span ${atr}="Paid on 02/10/2026">ok</span>`)).toHaveLength(1)
    }
    // y no los demas (una clase o un data- no se pintan)
    expect(huellasDeFormatoEspanol('<span class="02/10/2026" data-x="$ 5">ok</span>')).toEqual([])
  })

  it('no mira los value= de los campos', () => {
    expect(huellasDeFormatoEspanol('<input value="$ 5"/><input value="02/10/2026"/>')).toEqual([])
  })

  it('respeta lo declarado como dato, comparado contra el TROZO', () => {
    expect(huellasDeFormatoEspanol('<b>$10,000.00 MXN</b>', { permitidos: [/\$[\d,.]+ MXN/] })).toEqual([])
  })

  it('lo declarado NO perdona una huella vecina (antes se comparaba contra 60 caracteres de contexto)', () => {
    const h = huellasDeFormatoEspanol('<b>$10,000.00 MXN</b> <i>$ 500.00</i>', { permitidos: [/\$[\d,.]+ MXN/] })
    expect(h).toHaveLength(1)
    expect(h[0]).toMatch(/«\$ 500\.00»/)
  })

  it('un permitido con /g no se salta coincidencias (lastIndex)', () => {
    const permitidos = [/\$[\d,.]+ MXN/g]
    expect(huellasDeFormatoEspanol('<b>$1.00 MXN</b><b>$2.00 MXN</b><b>$3.00 MXN</b>', { permitidos })).toEqual([])
  })

  it('en una instancia USD el «$» es el ingles correcto; la fecha se sigue vigilando', () => {
    expect(huellasDeFormatoEspanol('<td>$10,000.00</td><td>02/10/2026</td>', { moneda: 'USD' })).toHaveLength(1)
  })

  it('las seis huellas estan declaradas (si se quita una, esta prueba lo dice)', () => {
    expect(HUELLAS.map(([n]) => n)).toEqual([
      'dinero sin MX$',
      'fecha dd/mm/aaaa',
      'fecha larga en español',
      'mes corto en español',
      'fecha corta con guion',
      'a. m. / p. m.',
    ])
  })
})

describe('textoLegible', () => {
  it('saca los nodos de texto y los atributos visibles, y decodifica las entidades', () => {
    const t = textoLegible('<a title="Tom &amp; Jerry" href="/x">It&#x27;s &lt;ok&gt;</a><input value="secreto"/>')
    expect(t).toContain('Tom & Jerry')
    expect(t).toContain("It's <ok>")
    expect(t).not.toContain('secreto')
    expect(t).not.toContain('/x')
  })
})
