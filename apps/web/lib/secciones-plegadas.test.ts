import { describe, it, expect } from 'vitest'
import { leerPlegadas, conPlegada } from './secciones-plegadas'

// ============================================================================
//  PLEG-01 · qué secciones dejó plegadas cada persona, en su navegador.
//
//  Pedido del dueño el 20/10: «así como Arrendadores, todos los módulos deben
//  poderse colapsar para cambiar la vista». En Arrendadores la tarjeta se
//  pliega, pero al recargar vuelve a abrirse: para cambiar la vista de verdad
//  hay que recordarlo. Es preferencia de pantalla —como la vista compacta de
//  Campañas (`lib/campanas-vista.ts`)— y vive en localStorage.
//
//  Lo que se lee de localStorage puede traer basura: nunca tumba la pantalla.
// ============================================================================

describe('leerPlegadas', () => {
  it('sin nada guardado, ninguna plegada', () => {
    expect(leerPlegadas(null)).toEqual([])
    expect(leerPlegadas('')).toEqual([])
  })

  it('lee la lista guardada, sin repetidos', () => {
    expect(leerPlegadas('["finanzas.cobranza","finanzas.cobranza","clientes.lista"]')).toEqual([
      'finanzas.cobranza',
      'clientes.lista',
    ])
  })

  it('basura o un formato viejo vuelven a «ninguna», sin lanzar', () => {
    for (const raw of ['{', 'null', '42', '{"a":1}', '[1,2,null]']) {
      expect(() => leerPlegadas(raw), raw).not.toThrow()
    }
    expect(leerPlegadas('{')).toEqual([])
    expect(leerPlegadas('[1,"ok",null]')).toEqual(['ok'])
  })
})

describe('conPlegada', () => {
  it('plegar añade la sección una sola vez', () => {
    expect(conPlegada(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(conPlegada(['a', 'b'], 'b', true)).toEqual(['a', 'b'])
  })

  it('desplegar la quita', () => {
    expect(conPlegada(['a', 'b'], 'a', false)).toEqual(['b'])
    expect(conPlegada(['b'], 'a', false)).toEqual(['b'])
  })

  it('no muta la lista que recibe', () => {
    const antes = ['a']
    conPlegada(antes, 'b', true)
    expect(antes).toEqual(['a'])
  })
})
