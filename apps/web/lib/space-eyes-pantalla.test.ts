import { describe, expect, it } from 'vitest'
import { HORA, celdaEn, contorno, homografia, aplicar, lineas, numeroGabinete, ordenar, type Punto } from './space-eyes-pantalla'

const cuadrado: Punto[] = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]]

describe('homografía de la pantalla', () => {
  it('lleva las esquinas del cuadrado unidad a las 4 esquinas marcadas', () => {
    const q: Punto[] = [[0.2, 0.1], [0.8, 0.15], [0.85, 0.9], [0.1, 0.8]]
    const H = homografia(q)
    const unidad: Punto[] = [[0, 0], [1, 0], [1, 1], [0, 1]]
    unidad.forEach(([u, v], k) => {
      const [x, y] = aplicar(H, u, v)
      expect(x).toBeCloseTo(q[k][0], 9)
      expect(y).toBeCloseTo(q[k][1], 9)
    })
  })

  it('encuentra el gabinete bajo un punto y null fuera de la pantalla', () => {
    const p = { esquinas: cuadrado, filas: 2, columnas: 4 }
    expect(celdaEn(p, 0.15, 0.15)).toEqual([0, 0])
    expect(celdaEn(p, 0.85, 0.85)).toEqual([1, 3])
    expect(celdaEn(p, 0.55, 0.3)).toEqual([0, 2])
    expect(celdaEn(p, 0.05, 0.5)).toBeNull()
  })

  it('dibuja las líneas interiores y el contorno de un gabinete', () => {
    const p = { esquinas: cuadrado, filas: 2, columnas: 4 }
    expect(lineas(p)).toHaveLength(3 + 1)
    const pts = contorno(p, 0, 0).split(' ').map((s) => s.split(',').map(Number))
    expect(pts[0][0]).toBeCloseTo(0.1)
    expect(pts[2][0]).toBeCloseTo(0.3)
    expect(pts[2][1]).toBeCloseTo(0.5)
  })
})

describe('ordenar las esquinas', () => {
  it('acomoda arriba-izq, arriba-der, abajo-der, abajo-izq sin importar el orden', () => {
    const revuelto: Punto[] = [[0.9, 0.9], [0.1, 0.1], [0.1, 0.9], [0.9, 0.1]]
    expect(ordenar(revuelto)).toEqual(cuadrado)
  })
})

describe('utilidades', () => {
  it('numera los gabinetes por renglones desde 1', () => {
    expect(numeroGabinete(4, [0, 0])).toBe(1)
    expect(numeroGabinete(4, [1, 2])).toBe(7)
  })
  it('acepta 24:00 y rechaza 25:00', () => {
    expect(HORA.test('24:00')).toBe(true)
    expect(HORA.test('06:30')).toBe(true)
    expect(HORA.test('25:00')).toBe(false)
    expect(HORA.test('6:00')).toBe(false)
  })
})
