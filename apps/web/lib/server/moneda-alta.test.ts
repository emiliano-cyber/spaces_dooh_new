import { describe, it, expect } from 'vitest'
import { monedaPedida, resolverMonedaDeAlta } from './moneda-alta'

// ============================================================================
//  ADR 0048 · con que moneda nace una organizacion.
//
//  La primera de la instancia la ELIGE (MXN por omision). Las siguientes
//  heredan la de la instancia; pedir otra es un error y no se ignora. Los
//  casos negativos son el corazon: lo que se protege es lo que se impide.
// ============================================================================

describe('monedaPedida · lo que llega en el cuerpo del alta', () => {
  it('sin moneda, no se pidio ninguna', () => {
    expect(monedaPedida(undefined)).toBeUndefined()
  })

  it.each(['MXN', 'USD'])('%s se acepta tal cual', (m) => {
    expect(monedaPedida(m)).toBe(m)
  })

  it.each(['EUR', 'PEN', 'usd', 'mxn', ' USD', '', null, 840, {}, ['USD']])(
    'NEGATIVO · %j se rechaza con 400 y el mensaje dice cuales valen',
    (mala) => {
      let error: unknown
      try {
        monedaPedida(mala)
      } catch (e) {
        error = e
      }
      expect(error).toMatchObject({ status: 400, message: 'La moneda debe ser MXN o USD' })
    },
  )
})

describe('resolverMonedaDeAlta · la primera elige, las demas heredan', () => {
  it('instancia vacia y nadie elige: MXN, que es en lo que estan todas las de antes', () => {
    expect(resolverMonedaDeAlta(undefined, null)).toBe('MXN')
  })

  it('instancia vacia y se pide USD: nace en USD', () => {
    expect(resolverMonedaDeAlta('USD', null)).toBe('USD')
  })

  it('instancia en USD y nadie pide: la nueva HEREDA USD (no cae a MXN)', () => {
    // El fallo que esto evita no daria error: una segunda organizacion en MXN
    // dentro de una instancia en dolares. La base tambien lo impide.
    expect(resolverMonedaDeAlta(undefined, 'USD')).toBe('USD')
  })

  it('instancia en MXN y se pide MXN: vale, es la misma', () => {
    expect(resolverMonedaDeAlta('MXN', 'MXN')).toBe('MXN')
  })

  it.each([
    ['USD', 'MXN'],
    ['MXN', 'USD'],
  ] as const)('NEGATIVO · pedir %s en una instancia %s es un 400, no se ignora', (pedida, instancia) => {
    expect(() => resolverMonedaDeAlta(pedida, instancia)).toThrow(
      'La moneda de la instancia ya está fijada: una organización nueva nace en la misma que las demás',
    )
  })

  it('NEGATIVO · una instancia con una moneda que no es MXN ni USD en la base LANZA', () => {
    // El CHECK de la migracion lo impide; si aun asi apareciera, heredar 'PEN'
    // a ciegas seria crear otra organizacion con el dato roto.
    expect(() => resolverMonedaDeAlta(undefined, 'PEN')).toThrow(/no soportada/)
  })
})
