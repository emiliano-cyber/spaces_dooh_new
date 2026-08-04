import { describe, it, expect } from 'vitest'
import { UNIDADES, unidadCorta } from './periodos'

describe('unidadCorta', () => {
  it('pluraliza "mes" como meses, no como «mess»', () => {
    expect(unidadCorta('mensual', 1)).toBe('mes')
    expect(unidadCorta('mensual', 2)).toBe('meses')
  })

  it('cero va en plural', () => {
    expect(unidadCorta('mensual', 0)).toBe('meses')
  })

  it('mantiene el resto de unidades como estaban', () => {
    expect(unidadCorta('diaria', 1)).toBe('día')
    expect(unidadCorta('diaria', 3)).toBe('días')
    expect(unidadCorta('catorcenal', 2)).toBe('catorcenas')
    expect(unidadCorta('semanal', 2)).toBe('semanas')
    expect(unidadCorta('spot', 2)).toBe('spots')
    expect(unidadCorta('hora', 2)).toBe('horas')
  })

  it('una unidad terminada en -s pluraliza en -es', () => {
    // Guard para unidades futuras: si alguien añade una y le pone el plural con
    // la regla ingenua (+s), esto lo caza antes de que salga a pantalla.
    for (const u of UNIDADES) {
      if (u.corta.endsWith('s')) expect(u.plural).toBe(`${u.corta}es`)
    }
  })

  it('degrada a la propia clave si la unidad no existe', () => {
    expect(unidadCorta('quincenal', 2)).toBe('quincenal')
  })
})
