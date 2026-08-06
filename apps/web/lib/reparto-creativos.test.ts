import { describe, it, expect } from 'vitest'
import { repartirSpots, asignacionDePantalla } from './reparto-creativos'

// ============================================================================
//  El reparto de spots entre creativos.
//
//  Esta es la clase de aritmética que se rompe en silencio: nadie ve un error,
//  simplemente una pantalla queda con un slot vacío que el cliente pagó, o con
//  más repeticiones de las que caben en el loop. El contador de la pantalla lo
//  pinta en rojo DESPUÉS, cuando ya está guardado.
//
//  La propiedad que sostiene todo: lo repartido tiene que sumar exactamente los
//  spots reservados. Ni uno menos (slot muerto) ni uno más (no cabe).
// ============================================================================

describe('repartirSpots', () => {
  it('reparte exacto cuando divide', () => {
    expect(repartirSpots(12, 2)).toEqual([6, 6])
    expect(repartirSpots(12, 3)).toEqual([4, 4, 4])
  })

  it('el resto va a los primeros, no se pierde', () => {
    // 10/3: [4,3,3] y no [3,3,3], que dejaría un slot pagado sin ocupar.
    expect(repartirSpots(10, 3)).toEqual([4, 3, 3])
    expect(repartirSpots(11, 3)).toEqual([4, 4, 3])
  })

  it('SIEMPRE suma los spots reservados', () => {
    // La propiedad, sobre toda la rejilla realista de slots y creativos.
    for (let spots = 1; spots <= 24; spots++) {
      for (let n = 1; n <= 6; n++) {
        const r = repartirSpots(spots, n)
        expect(r).toHaveLength(n)
        expect(r.reduce((a, b) => a + b, 0)).toBe(spots)
        // Y lo más parejo posible: entre el mayor y el menor no puede haber
        // más de 1 de diferencia.
        expect(Math.max(...r) - Math.min(...r)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('con más creativos que spots, los que sobran quedan en cero', () => {
    expect(repartirSpots(2, 3)).toEqual([1, 1, 0])
    expect(repartirSpots(1, 3)).toEqual([1, 0, 0])
  })

  it('sin creativos no reparte nada', () => {
    expect(repartirSpots(12, 0)).toEqual([])
  })

  it('cero o negativos no producen repeticiones', () => {
    expect(repartirSpots(0, 2)).toEqual([0, 0])
    expect(repartirSpots(-5, 2)).toEqual([0, 0])
  })
})

describe('asignacionDePantalla', () => {
  it('digital: reparte entre los elegidos y respeta los slots DE ESA pantalla', () => {
    // El caso que motiva todo: 10 y 12 slots conviviendo (M12). Un reparto
    // calculado una sola vez y copiado dejaría una de las dos mal.
    expect(asignacionDePantalla(['a', 'b'], 12)).toEqual([
      { creatividadId: 'a', veces: 6 },
      { creatividadId: 'b', veces: 6 },
    ])
    expect(asignacionDePantalla(['a', 'b'], 10)).toEqual([
      { creatividadId: 'a', veces: 5 },
      { creatividadId: 'b', veces: 5 },
    ])
  })

  it('digital: descarta los que quedaron en cero', () => {
    // Un creativo con cero repeticiones NO está asignado; escribirlo fingiría
    // que sí y el guard de M14 lo daría por bueno.
    expect(asignacionDePantalla(['a', 'b', 'c'], 2)).toEqual([
      { creatividadId: 'a', veces: 1 },
      { creatividadId: 'b', veces: 1 },
    ])
  })

  it('fija (sin slots): un solo creativo, no se reparte una lona', () => {
    expect(asignacionDePantalla(['a', 'b', 'c'], null)).toEqual([
      { creatividadId: 'a', veces: 1 },
    ])
  })

  it('sin creativos elegidos no asigna nada', () => {
    expect(asignacionDePantalla([], 12)).toEqual([])
    expect(asignacionDePantalla([], null)).toEqual([])
  })

  it('una pantalla digital con 0 slots no recibe asignación', () => {
    // No es lo mismo que una fija: es una digital mal capturada. Asignarle algo
    // seria inventar repeticiones que no caben en ningun loop.
    expect(asignacionDePantalla(['a'], 0)).toEqual([])
  })
})
