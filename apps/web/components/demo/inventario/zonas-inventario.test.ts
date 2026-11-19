import { describe, it, expect } from 'vitest'
import { zonasInventario, enZona, hayFiltros, FILTROS_VACIOS, SIN_ALCALDIA } from './ResumenInventario'

// 18/11 · el filtro por zona de Inventario. La lógica es pura (no toca la
// base): agrupa por ciudad y alcaldía lo que la tabla ya tiene en memoria.

const s = (ciudad: string, alcaldia: string | null) => ({ ciudad, alcaldia })

describe('zonasInventario', () => {
  it('agrupa por ciudad y alcaldía, de más pantallas a menos', () => {
    const z = zonasInventario([
      s('Guadalajara', 'Zapopan'),
      s('CDMX', 'Benito Juárez'),
      s('CDMX', 'Coyoacán'),
      s('CDMX', 'Benito Juárez'),
    ])
    expect(z.map((c) => [c.nombre, c.n])).toEqual([['CDMX', 3], ['Guadalajara', 1]])
    expect(z[0].alcaldias).toEqual([
      { nombre: 'Benito Juárez', n: 2 },
      { nombre: 'Coyoacán', n: 1 },
    ])
  })

  it('una ciudad con espacio al final NO es otra zona', () => {
    const z = zonasInventario([s('Lima ', 'Miraflores'), s('Lima', 'Miraflores ')])
    expect(z).toEqual([{ nombre: 'Lima', n: 2, alcaldias: [{ nombre: 'Miraflores', n: 2 }], sinAlcaldia: 0 }])
  })

  it('sin ciudad no forma zona, y sin alcaldía cuenta en la ciudad pero no en la lista de alcaldías', () => {
    const z = zonasInventario([s('', 'Centro'), s('Puebla', null)])
    expect(z).toEqual([{ nombre: 'Puebla', n: 1, alcaldias: [], sinAlcaldia: 1 }])
  })

  // Hallazgo C (19/11): en Fijos, CDMX marcaba 9 y sus zonas sumaban 5. Las
  // cuatro pantallas sin alcaldía no tenían opción propia, así que no había
  // forma de encontrarlas desde el filtro y los números no cuadraban.
  it('las pantallas sin alcaldía se cuentan aparte, y la suma cuadra con la ciudad', () => {
    const z = zonasInventario([
      s('CDMX', 'Coyoacán'),
      s('CDMX', null),
      s('CDMX', '  '),
      s('CDMX', 'Coyoacán'),
    ])
    expect(z[0].sinAlcaldia).toBe(2)
    expect(z[0].alcaldias.reduce((a, b) => a + b.n, 0) + z[0].sinAlcaldia).toBe(z[0].n)
  })
})

describe('enZona', () => {
  it('sin ciudad elegida, todas caen', () => {
    expect(enZona(s('CDMX', 'Coyoacán'), FILTROS_VACIOS)).toBe(true)
  })

  it('la alcaldía se exige DENTRO de la ciudad: «Centro» de otra ciudad no cae', () => {
    const f = { ciudad: 'Puebla', alcaldia: 'Centro' }
    expect(enZona(s('Puebla', 'Centro'), f)).toBe(true)
    expect(enZona(s('Oaxaca', 'Centro'), f)).toBe(false)
    expect(enZona(s('Puebla', 'Angelópolis'), f)).toBe(false)
  })

  it('«Sin alcaldía» deja pasar SOLO las de esa ciudad sin alcaldía', () => {
    const f = { ciudad: 'CDMX', alcaldia: SIN_ALCALDIA }
    expect(enZona(s('CDMX', null), f)).toBe(true)
    expect(enZona(s('CDMX', ' '), f)).toBe(true)
    expect(enZona(s('CDMX', 'Coyoacán'), f)).toBe(false)
    expect(enZona(s('Puebla', null), f)).toBe(false)
  })

  it('compara recortado, igual que las zonas que ofrece', () => {
    expect(enZona(s('Lima ', ' Miraflores'), { ciudad: 'Lima', alcaldia: 'Miraflores' })).toBe(true)
  })
})

describe('hayFiltros', () => {
  it('cuenta la zona como filtro (si no, «Quitar filtros» no aparecería)', () => {
    expect(hayFiltros(FILTROS_VACIOS)).toBe(false)
    expect(hayFiltros({ ...FILTROS_VACIOS, ciudad: 'CDMX' })).toBe(true)
    expect(hayFiltros({ ...FILTROS_VACIOS, medio: 'fija' })).toBe(true)
  })
})
