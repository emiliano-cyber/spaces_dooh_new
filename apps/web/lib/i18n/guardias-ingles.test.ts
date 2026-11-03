import { describe, it, expect } from 'vitest'
import { huellasDeFormatoEspanol } from './guardias-ingles'

describe('huellasDeFormatoEspanol', () => {
  it('un importe con MX$ y una fecha inglesa estan limpios', () => {
    expect(huellasDeFormatoEspanol('<td>MX$ 10,000.00</td><td>Oct 2, 2026</td>')).toEqual([])
  })

  it('caza el dinero sin MX$ (con y sin espacio) y la fecha dd/mm/aaaa', () => {
    const h = huellasDeFormatoEspanol('<td>$ 10,000.00</td><td>$9.50</td><td>02/10/2026</td>')
    expect(h).toHaveLength(3)
    expect(h[0]).toMatch(/dinero sin MX\$ «\$ 10,000\.00»/)
    expect(h[2]).toMatch(/fecha dd\/mm\/aaaa «02\/10\/2026»/)
  })

  it('no mira los value= de los campos', () => {
    expect(huellasDeFormatoEspanol('<input value="$ 5"/><input value="02/10/2026"/>')).toEqual([])
  })

  it('respeta lo declarado como dato', () => {
    expect(huellasDeFormatoEspanol('<b>$10,000.00 MXN</b>', { permitidos: [/\$[\d,.]+ MXN/] })).toEqual([])
  })

  it('en una instancia USD el «$» es el ingles correcto; la fecha se sigue vigilando', () => {
    expect(huellasDeFormatoEspanol('<td>$10,000.00</td><td>02/10/2026</td>', { moneda: 'USD' })).toHaveLength(1)
  })
})
