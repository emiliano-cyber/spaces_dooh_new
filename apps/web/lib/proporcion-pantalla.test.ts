import { describe, it, expect } from 'vitest'
import {
  proporcion,
  medidaDeOrden,
  proporcionDeResolucion,
  ajusteEnMarco,
  nombreProporcion,
  proporcionDibujable,
} from './proporcion-pantalla'

describe('proporcion', () => {
  it('ancho / alto', () => {
    expect(proporcion(12.9, 7.2)).toBeCloseTo(1.7917, 3)
  })
  it('cero, negativo o vacío no es una medida', () => {
    expect(proporcion(0, 0)).toBeNull()
    expect(proporcion(3, 0)).toBeNull()
    expect(proporcion(-3, 2)).toBeNull()
    expect(proporcion(null, 2)).toBeNull()
  })
})

describe('medidaDeOrden', () => {
  it('manda la medida de la orden', () => {
    expect(medidaDeOrden({ ancho: 6, alto: 3 }, { ancho: 12, alto: 4 })).toEqual({ ancho: 6, alto: 3, origen: 'orden' })
  })
  it('una orden 0 × 0 (digital o sin capturar) toma la del sitio', () => {
    expect(medidaDeOrden({ ancho: 0, alto: 0 }, { ancho: 12, alto: 4 })).toEqual({ ancho: 12, alto: 4, origen: 'sitio' })
  })
  it('sin ninguna de las dos, null: no se inventa un marco', () => {
    expect(medidaDeOrden({ ancho: 0, alto: 0 }, { ancho: null, alto: null })).toBeNull()
    expect(medidaDeOrden({ ancho: 0, alto: 0 }, null)).toBeNull()
  })
})

describe('proporcionDeResolucion', () => {
  it('lee las formas de escribirla', () => {
    expect(proporcionDeResolucion('1920x1080')).toBeCloseTo(16 / 9, 5)
    expect(proporcionDeResolucion('1080 × 1920 px')).toBeCloseTo(9 / 16, 5)
    expect(proporcionDeResolucion('12,9*7,2')).toBeCloseTo(12.9 / 7.2, 5)
  })
  it('sin resolución no hay proporción', () => {
    expect(proporcionDeResolucion(null)).toBeNull()
    expect(proporcionDeResolucion('HD')).toBeNull()
  })
})

describe('ajusteEnMarco', () => {
  it('misma proporción: ajusta', () => {
    expect(ajusteEnMarco(16 / 9, 16 / 9)).toEqual({ tipo: 'ajusta' })
  })
  it('dentro de la tolerancia también ajusta', () => {
    // 12,9 × 7,2 (1,792) contra 16:9 (1,778): menos del 1 %.
    expect(ajusteEnMarco(12.9 / 7.2, 16 / 9).tipo).toBe('ajusta')
  })
  it('arte horizontal en sitio vertical: pierde los costados', () => {
    const a = ajusteEnMarco(1 / 3, 16 / 9)
    expect(a.tipo).toBe('recorta')
    if (a.tipo === 'recorta') {
      expect(a.por).toBe('costados')
      expect(a.pierde).toBeCloseTo(1 - (1 / 3) / (16 / 9), 5)
    }
  })
  it('arte vertical en sitio horizontal: pierde arriba y abajo', () => {
    const a = ajusteEnMarco(3, 1)
    expect(a).toEqual({ tipo: 'recorta', pierde: 1 - 1 / 3, por: 'arriba-abajo' })
  })
})

describe('nombreProporcion y proporcionDibujable', () => {
  it('nombra las conocidas y escribe la cifra en las demás', () => {
    expect(nombreProporcion(16 / 9)).toBe('16:9')
    expect(nombreProporcion(12.9 / 7.2)).toBe('16:9')
    expect(nombreProporcion(1)).toBe('1:1')
    expect(nombreProporcion(5)).toBe('5.00:1')
    expect(nombreProporcion(0.2)).toBe('1:5.00')
    expect(nombreProporcion(null)).toBeNull()
  })
  it('acota solo lo que se dibuja', () => {
    expect(proporcionDibujable(15)).toBe(4)
    expect(proporcionDibujable(0.1)).toBe(0.35)
    expect(proporcionDibujable(1.5)).toBe(1.5)
  })
})
