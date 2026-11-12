import { describe, it, expect } from 'vitest'
import { METRICAS_DASHBOARD, leerOcultas, alternarOculta, anchoDeFila } from './metricas-visibles'

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
    expect(anchoDeFila(true, true)).toEqual({ ancha: 'lg:col-span-2', angosta: undefined })
  })
  it('si falta una, la otra ocupa la fila entera: sin hueco al lado', () => {
    expect(anchoDeFila(true, false).ancha).toBe('lg:col-span-3')
    expect(anchoDeFila(false, true).angosta).toBe('lg:col-span-3')
  })
})
