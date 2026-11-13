import { describe, it, expect } from 'vitest'
import { METRICAS_DASHBOARD, leerOcultas, alternarOculta, anchoDeFila, columnasIndicadores } from './metricas-visibles'

// ============================================================================
//  DASH-METRICAS (12/11) · del Dashboard se eligen las metricas a ver.
// ============================================================================

describe('METRICAS_DASHBOARD', () => {
  it('cada bloque del tablero tiene su id, sin repetidos', () => {
    const ids = METRICAS_DASHBOARD.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ['ingreso', 'margen', 'ganado', 'ocupacion-red', 'costos', 'grafica-ocupacion', 'pipeline', 'alertas', 'huecos', 'cobranza', 'mapa']) {
      expect(ids).toContain(id)
    }
  })
})

describe('leerOcultas', () => {
  it('sin nada guardado no oculta nada: el tablero sale completo, como hoy', () => {
    expect(leerOcultas(null)).toEqual(new Set())
  })
  it('lee lo guardado', () => {
    expect(leerOcultas('["mapa","huecos"]')).toEqual(new Set(['mapa', 'huecos']))
  })
  it('ignora ids que ya no existen y basura', () => {
    expect(leerOcultas('["mapa","no-existe",3,null]')).toEqual(new Set(['mapa']))
    expect(leerOcultas('{roto')).toEqual(new Set())
    expect(leerOcultas('"mapa"')).toEqual(new Set())
  })
})

describe('alternarOculta', () => {
  it('oculta y vuelve a mostrar, sin tocar el conjunto original', () => {
    const a = new Set<string>()
    const b = alternarOculta(a, 'mapa')
    expect([...b]).toEqual(['mapa'])
    expect(a.size).toBe(0)
    expect([...alternarOculta(b, 'mapa')]).toEqual([])
  })
})

describe('anchoDeFila', () => {
  it('con las dos tarjetas, cada una su ancho de siempre', () => {
    expect(anchoDeFila(true, true).ancha).toBe('lg:col-span-2')
  })
  it('si falta una, la otra ocupa la fila entera: sin hueco al lado', () => {
    expect(anchoDeFila(true, false).ancha).toBe('lg:col-span-3')
    expect(anchoDeFila(false, true).angosta).toBe('lg:col-span-3')
  })
})

// DASH-ALINEADO (13/11) · pedido del dueno: «que todo este alineado para dejar
// el menor espacio desperdiciado pero manteniendo la separacion entre cada
// renglon».
describe('anchoDeFila · la costura de las columnas', () => {
  it('la angosta va a la IZQUIERDA en escritorio en TODAS las filas: el corte cae en el mismo tercio', () => {
    // Antes: Ocupacion (ancha) a la izquierda y Pipeline a la derecha, y en las
    // dos filas de abajo al reves; la linea entre columnas saltaba de 2/3 a 1/3.
    expect(anchoDeFila(true, true).angosta).toBe('lg:order-first')
  })
  it('sola, la que queda no cambia de orden: ocupa la fila', () => {
    expect(anchoDeFila(false, true).angosta).toBe('lg:col-span-3')
  })
})

describe('columnasIndicadores', () => {
  it('con los cuatro, como siempre: 2 columnas y 4 desde xl', () => {
    expect(columnasIndicadores(4)).toBe('grid-cols-1 sm:grid-cols-2 xl:grid-cols-4')
  })
  it('con tres, tres columnas: con 4 quedaba una casilla vacia a la derecha', () => {
    expect(columnasIndicadores(3)).toBe('grid-cols-1 lg:grid-cols-3')
  })
  it('con dos, mitad y mitad', () => {
    expect(columnasIndicadores(2)).toBe('grid-cols-1 sm:grid-cols-2')
  })
  it('con uno, a todo el ancho', () => {
    expect(columnasIndicadores(1)).toBe('grid-cols-1')
  })
})
