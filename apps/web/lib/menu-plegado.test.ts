import { describe, it, expect } from 'vitest'
import { leerPlegadas, alternarPlegada, plegarTodas, hayDesplegadas, CLAVE_MENU_PLEGADO } from './menu-plegado'

// ============================================================================
//  MENU-CASCADA (12/11) · cada seccion del menu se pliega a su titulo, y lo
//  plegado se recuerda en el navegador (localStorage).
// ============================================================================

const GRUPOS = ['patrimonio', 'ojos', 'vender', 'entregar', 'cobrar', 'sistema']

describe('leerPlegadas', () => {
  it('sin nada guardado todo va DESPLEGADO, como hoy', () => {
    expect(leerPlegadas(null, GRUPOS)).toEqual(new Set())
  })
  it('lee lo guardado', () => {
    expect(leerPlegadas('["vender","sistema"]', GRUPOS)).toEqual(new Set(['vender', 'sistema']))
  })
  it('un grupo que ya no existe, o basura, se ignora', () => {
    expect(leerPlegadas('["vender","viejo",1]', GRUPOS)).toEqual(new Set(['vender']))
    expect(leerPlegadas('no es json', GRUPOS)).toEqual(new Set())
    expect(leerPlegadas('{"vender":true}', GRUPOS)).toEqual(new Set())
  })
})

describe('alternarPlegada', () => {
  it('pliega y despliega sin mutar el original', () => {
    const a = new Set<string>()
    const b = alternarPlegada(a, 'vender')
    expect([...b]).toEqual(['vender'])
    expect(a.size).toBe(0)
    expect([...alternarPlegada(b, 'vender')]).toEqual([])
  })
})

describe('la clave de localStorage', () => {
  it('lleva el prefijo de la app, como las demas preferencias', () => {
    expect(CLAVE_MENU_PLEGADO).toBe('spaces:menu-plegado')
  })
})

describe('plegar y desplegar todas', () => {
  it('plegarTodas deja plegadas exactamente las que se le dan', () => {
    expect([...plegarTodas(['vender', 'cobrar'])].sort()).toEqual(['cobrar', 'vender'])
  })
  it('hayDesplegadas dice si queda alguna abierta (decide el boton del pie)', () => {
    expect(hayDesplegadas(new Set(['vender']), ['vender', 'cobrar'])).toBe(true)
    expect(hayDesplegadas(new Set(['vender', 'cobrar']), ['vender', 'cobrar'])).toBe(false)
    expect(hayDesplegadas(new Set(), [])).toBe(false)
  })
})
