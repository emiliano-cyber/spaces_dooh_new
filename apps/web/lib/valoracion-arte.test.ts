import { describe, it, expect } from 'vitest'
import {
  colocarArte,
  valorarProporcion,
  valorarResolucion,
  valorarFormato,
  valorarPeso,
  valorarArte,
  peorSemaforo,
  MARGEN_SEGURIDAD_M,
  UMBRALES_DPI,
} from './valoracion-arte'

// Un espectacular típico: 12,9 × 7,2 m (≈ 16:9).
const ESPECTACULAR = { ancho: 12.9, alto: 7.2 }
// Un muro vertical de 3 × 9 m.
const MURO = { ancho: 3, alto: 9 }

describe('colocarArte', () => {
  it('a sangre, un arte más ancho que la lona se escala por alto y sobresale por los costados', () => {
    // Lona 2:1 (4 × 2 m), arte 4:1 → a sangre mide 8 × 2 m y sobra 2 m por lado.
    const r = colocarArte({ ancho: 4, alto: 2 }, 4, 'cover')
    expect(r.alto).toBeCloseTo(2)
    expect(r.ancho).toBeCloseTo(8)
    expect(r.x).toBeCloseTo(-2)
    expect(r.y).toBeCloseTo(0)
  })
  it('sin recortar, el mismo arte cabe entero y deja franjas arriba y abajo', () => {
    const r = colocarArte({ ancho: 4, alto: 2 }, 4, 'contain')
    expect(r.ancho).toBeCloseTo(4)
    expect(r.alto).toBeCloseTo(1)
    expect(r.y).toBeCloseTo(0.5)
  })
  it('un arte más alto que la lona, a sangre, sobresale arriba y abajo', () => {
    const r = colocarArte({ ancho: 4, alto: 2 }, 1, 'cover')
    expect(r.ancho).toBeCloseTo(4)
    expect(r.alto).toBeCloseTo(4)
    expect(r.y).toBeCloseTo(-1)
  })
})

describe('valorarProporcion', () => {
  it('un arte de la misma proporción ajusta (verde) y no recorta nada', () => {
    const v = valorarProporcion(ESPECTACULAR, 1920, 1080)
    expect(v.semaforo).toBe('verde')
    expect(v.por).toBeNull()
  })
  it('un recorte moderado es ámbar y dice los cm que se pierden por lado', () => {
    // Lona 4 × 2 m (2:1), arte 16:9 → a sangre mide 4 × 2,25 m: se pierden
    // 12,5 cm arriba y 12,5 abajo (11 % del arte).
    const v = valorarProporcion({ ancho: 4, alto: 2 }, 1600, 900)
    expect(v.semaforo).toBe('ambar')
    expect(v.por).toBe('arriba-abajo')
    expect(v.cmPorLado).toBeCloseTo(12.5, 1)
    expect(v.pierde).toBeCloseTo(0.111, 2)
  })
  it('un arte horizontal en un muro vertical es rojo: se pierde casi todo por los costados', () => {
    const v = valorarProporcion(MURO, 1920, 1080)
    expect(v.semaforo).toBe('rojo')
    expect(v.por).toBe('costados')
    expect(v.pierde).toBeGreaterThan(0.8)
  })
  it('sin recortar, dice cuánto queda en blanco por lado', () => {
    const v = valorarProporcion({ ancho: 4, alto: 2 }, 1600, 900)
    // Sin recortar: 3,56 × 2 m centrado → 22,2 cm en blanco por cada costado.
    expect(v.rellenoCmPorLado).toBeCloseTo(22.2, 1)
  })
})

describe('valorarResolucion', () => {
  it('px por metro a sangre: manda el lado que menos píxeles tiene por metro', () => {
    // 12 900 px a lo ancho de 12,9 m = 1000 px/m = 25,4 DPI.
    const v = valorarResolucion(ESPECTACULAR, 12900, 7200)
    expect(v.pxPorMetro).toBeCloseTo(1000)
    expect(v.dpi).toBeCloseTo(25.4, 1)
    expect(v.escala).toBe('gran')
    expect(v.semaforo).toBe('verde')
  })
  it('un 1920 × 1080 en un espectacular de 12,9 m es rojo: se verá pixelado', () => {
    const v = valorarResolucion(ESPECTACULAR, 1920, 1080)
    expect(v.dpi).toBeLessThan(UMBRALES_DPI.gran.ambar)
    expect(v.semaforo).toBe('rojo')
  })
  it('entre el mínimo aceptable y el recomendado es ámbar', () => {
    // 7 DPI ≈ 275,6 px/m → 12,9 m ≈ 3556 px.
    const v = valorarResolucion(ESPECTACULAR, 3556, 2000)
    expect(v.semaforo).toBe('ambar')
  })
  it('una lona chica (se ve de cerca) exige más DPI que un espectacular', () => {
    // 2 × 1 m con 1000 px/m = 25,4 DPI: verde en un espectacular, pero en una
    // lona de 2 m (vista a pocos metros) el umbral es más alto.
    const v = valorarResolucion({ ancho: 2, alto: 1 }, 2000, 1000)
    expect(v.escala).toBe('cercana')
    expect(UMBRALES_DPI.cercana.verde).toBeGreaterThan(UMBRALES_DPI.gran.verde)
    expect(v.semaforo).toBe('ambar')
  })
  it('dice los píxeles mínimos para llegar a verde', () => {
    const v = valorarResolucion(ESPECTACULAR, 1920, 1080)
    const pxm = UMBRALES_DPI.gran.verde / 0.0254
    expect(v.minimoPx.ancho).toBe(Math.ceil(12.9 * pxm))
    expect(v.minimoPx.alto).toBe(Math.ceil(7.2 * pxm))
  })
})

describe('valorarFormato y valorarPeso', () => {
  it('PNG, JPG y WebP sirven', () => {
    expect(valorarFormato('image/png')).toEqual({ semaforo: 'verde', nombre: 'PNG' })
    expect(valorarFormato('image/jpeg')).toEqual({ semaforo: 'verde', nombre: 'JPG' })
    expect(valorarFormato('image/webp')).toEqual({ semaforo: 'verde', nombre: 'WEBP' })
  })
  it('un PDF o un tipo desconocido es ámbar: no se puede valorar aquí', () => {
    expect(valorarFormato('application/pdf')).toEqual({ semaforo: 'ambar', nombre: 'PDF' })
    expect(valorarFormato('')?.semaforo).toBe('ambar')
    expect(valorarFormato(null)).toBeNull()
  })
  it('el peso: hasta el tope verde, por encima rojo (no se puede subir)', () => {
    expect(valorarPeso(3 * 1024 * 1024, 4)).toEqual({ semaforo: 'verde', mb: 3 })
    expect(valorarPeso(5 * 1024 * 1024, 4)?.semaforo).toBe('rojo')
    expect(valorarPeso(null, 4)).toBeNull()
  })
})

describe('valorarArte', () => {
  it('el semáforo general es el peor de los criterios medidos', () => {
    const v = valorarArte(ESPECTACULAR, { anchoPx: 1920, altoPx: 1080, tipo: 'image/png', bytes: 1024 })
    expect(v.proporcion?.semaforo).toBe('verde')
    expect(v.resolucion?.semaforo).toBe('rojo')
    expect(v.general).toBe('rojo')
  })
  it('sin medida de la lona no hay proporción ni resolución: no se inventan', () => {
    const v = valorarArte(null, { anchoPx: 1920, altoPx: 1080, tipo: 'image/png', bytes: 1024 })
    expect(v.proporcion).toBeNull()
    expect(v.resolucion).toBeNull()
    expect(v.general).toBe('verde')
  })
  it('sin dimensiones del archivo (HTML, PDF) la valoración es parcial', () => {
    const v = valorarArte(ESPECTACULAR, { anchoPx: null, altoPx: null, tipo: 'application/pdf', bytes: null })
    expect(v.proporcion).toBeNull()
    expect(v.resolucion).toBeNull()
    expect(v.parcial).toBe(true)
    expect(v.general).toBe('ambar')
  })
  it('sin ningún dato no hay semáforo', () => {
    expect(valorarArte(null, { anchoPx: null, altoPx: null }).general).toBeNull()
  })
})

describe('peorSemaforo y el margen', () => {
  it('rojo gana a ámbar y ámbar a verde', () => {
    expect(peorSemaforo(['verde', 'ambar'])).toBe('ambar')
    expect(peorSemaforo(['verde', 'rojo', 'ambar'])).toBe('rojo')
    expect(peorSemaforo([])).toBeNull()
  })
  it('el margen de seguridad orientativo es de 5 cm', () => {
    expect(MARGEN_SEGURIDAD_M).toBe(0.05)
  })
})
