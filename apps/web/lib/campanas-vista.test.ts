import { describe, it, expect } from 'vitest'
import { VISTA_VACIA, alternarEn, leerVista, serializarVista } from './campanas-vista'

// ============================================================================
//  La vista de Campañas que recuerda cada navegador: compacta o no, qué
//  tarjetas están minimizadas y cuáles ocultas. Pedido del dueño el 2026-09-30:
//  «que se pueda minimizar la vista» del pipeline para ver el resto.
//
//  Lo que se fija aquí es que la preferencia NUNCA rompa la pantalla: viene de
//  localStorage, y localStorage puede traer cualquier cosa — basura, una versión
//  vieja, o nada.
// ============================================================================

describe('leer la preferencia guardada', () => {
  it('sin nada guardado: vista completa, nada minimizado ni oculto', () => {
    expect(leerVista(null)).toEqual(VISTA_VACIA)
    expect(VISTA_VACIA).toEqual({ compacta: false, minimizadas: [], ocultas: [] })
  })

  it('lo que se guardó vuelve igual', () => {
    const v = { compacta: true, minimizadas: ['a'], ocultas: ['b', 'c'] }
    expect(leerVista(serializarVista(v))).toEqual(v)
  })

  it('basura no rompe nada: vuelve a la vista vacía', () => {
    expect(leerVista('{no es json')).toEqual(VISTA_VACIA)
    expect(leerVista('42')).toEqual(VISTA_VACIA)
    expect(leerVista('null')).toEqual(VISTA_VACIA)
    expect(leerVista('[]')).toEqual(VISTA_VACIA)
  })

  it('campos de tipo equivocado se descartan uno por uno, no todo', () => {
    expect(
      leerVista(JSON.stringify({ compacta: 'si', minimizadas: ['a', 3, null], ocultas: 'b' })),
    ).toEqual({ compacta: false, minimizadas: ['a'], ocultas: [] })
  })

  it('los ids repetidos se guardan una vez', () => {
    expect(leerVista(JSON.stringify({ ocultas: ['a', 'a'] })).ocultas).toEqual(['a'])
  })
})

describe('minimizar u ocultar una campaña', () => {
  it('alternar la añade si no está y la quita si está', () => {
    expect(alternarEn([], 'x')).toEqual(['x'])
    expect(alternarEn(['x', 'y'], 'x')).toEqual(['y'])
  })

  it('no muta la lista original: React necesita una nueva', () => {
    const antes = ['x']
    alternarEn(antes, 'y')
    expect(antes).toEqual(['x'])
  })
})
