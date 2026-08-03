import { describe, it, expect } from 'vitest'
import {
  similitudDireccion,
  pantallasFueraDelGrupo,
  SIMILITUD_MINIMA,
} from './predio-cercania'

// ============================================================================
//  Aviso de "esta pantalla no parece estar en este predio".
//
//  Este aviso solo sirve si NO salta de más: uno que salta en cargas correctas
//  se aprende a ignorar, y entonces tampoco se ve el día que importa. Por eso
//  la mitad de estas pruebas son casos que NO deben avisar.
// ============================================================================

describe('similitud entre direcciones', () => {
  it('la misma dirección escrita distinto se parece', () => {
    expect(similitudDireccion('Av. Reforma 222, Juárez', 'AV REFORMA 222 JUAREZ'))
      .toBeGreaterThanOrEqual(SIMILITUD_MINIMA)
  })

  it('el mismo inmueble con distinto interior se parece', () => {
    expect(similitudDireccion('Av. Reforma 222 piso 3', 'Av. Reforma 222 local B'))
      .toBeGreaterThanOrEqual(SIMILITUD_MINIMA)
  })

  it('dos calles distintas de la misma ciudad NO se parecen', () => {
    expect(similitudDireccion('Av. Insurgentes 1200, Del Valle', 'Calzada Zaragoza 45, Iztapalapa'))
      .toBeLessThan(SIMILITUD_MINIMA)
  })

  it('una dirección vacía no se parece a nada', () => {
    expect(similitudDireccion('', 'Av. Reforma 222')).toBe(0)
    expect(similitudDireccion(null, null)).toBe(0)
  })
})

describe('pantallas fuera del grupo', () => {
  const cerca = { lat: 19.4326, lng: -99.1332, coordsFiables: true }

  it('no avisa cuando todas están cerca', () => {
    expect(
      pantallasFueraDelGrupo([
        { clave: 'A', ...cerca, direccion: 'Reforma 222' },
        { clave: 'B', lat: 19.4331, lng: -99.1338, coordsFiables: true, direccion: 'Reforma 222' },
      ]),
    ).toEqual([])
  })

  it('avisa de la que está en otra colonia, y dice a cuánto', () => {
    const fuera = pantallasFueraDelGrupo([
      { clave: 'A', ...cerca, direccion: 'Reforma 222' },
      { clave: 'LEJANA', lat: 19.36, lng: -99.05, coordsFiables: true, direccion: 'Otra calle 1' },
    ])
    expect(fuera).toHaveLength(1)
    expect(fuera[0].clave).toBe('LEJANA')
    expect(fuera[0].motivo).toMatch(/km|m\b/)
  })

  it('con una sola pantalla no hay nada contra qué comparar', () => {
    expect(pantallasFueraDelGrupo([{ clave: 'A', ...cerca, direccion: 'Reforma 222' }])).toEqual([])
  })

  it('IGNORA las coordenadas por defecto: si no, todas parecerían el mismo punto', () => {
    // Las dos traen la coordenada default (mismo punto exacto) pero direcciones
    // de sitios distintos. Fiarse de la coordenada las daría por juntas.
    const fuera = pantallasFueraDelGrupo([
      { clave: 'A', lat: 19.4326, lng: -99.1332, coordsFiables: false, direccion: 'Av. Insurgentes 1200, Del Valle' },
      { clave: 'B', lat: 19.4326, lng: -99.1332, coordsFiables: false, direccion: 'Calzada Zaragoza 45, Iztapalapa' },
    ])
    expect(fuera.map((f) => f.clave)).toEqual(['B'])
  })

  it('sin coordenadas fiables, direcciones parecidas NO avisan', () => {
    expect(
      pantallasFueraDelGrupo([
        { clave: 'A', coordsFiables: false, direccion: 'Av. Reforma 222 piso 3' },
        { clave: 'B', coordsFiables: false, direccion: 'Av. Reforma 222 local B' },
      ]),
    ).toEqual([])
  })

  it('no avisa por una dirección VACÍA: es dato ausente, no evidencia', () => {
    expect(
      pantallasFueraDelGrupo([
        { clave: 'A', coordsFiables: false, direccion: 'Av. Reforma 222' },
        { clave: 'B', coordsFiables: false, direccion: '' },
      ]),
    ).toEqual([])
  })
})
