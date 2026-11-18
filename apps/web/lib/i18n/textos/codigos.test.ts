import { describe, it, expect } from 'vitest'
import { ES_CODIGOS, EN_CODIGOS } from './codigos'

// ============================================================================
//  EL DICCIONARIO DE LOS CODIGOS DE NEGOCIACION, CONGELADO.
// ----------------------------------------------------------------------------
//  Mismo patron que `propuestas.test.ts` y `comercial.test.ts`: una
//  instantanea de los dos idiomas, para que ni el espanol (copia literal) ni el
//  ingles cambien sin que el diff de `__snapshots__/` lo enseñe.
// ============================================================================

describe('diccionario de codigos · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_CODIGOS).toMatchSnapshot()
  })

  it('el INGLES tampoco', () => {
    expect(EN_CODIGOS).toMatchSnapshot()
  })
})

describe('diccionario de codigos · el ingles no esta en espanol', () => {
  it('ninguna entrada inglesa es igual a la espanola', () => {
    const iguales = Object.keys(ES_CODIGOS).filter(
      (k) => ES_CODIGOS[k as keyof typeof ES_CODIGOS] === EN_CODIGOS[k as keyof typeof EN_CODIGOS],
    )
    expect(iguales).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    const malas = Object.entries(EN_CODIGOS)
      .filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v))
      .map(([k]) => k)
    expect(malas).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const distintos = Object.keys(ES_CODIGOS).filter(
      (k) =>
        huecos(ES_CODIGOS[k as keyof typeof ES_CODIGOS]).join() !==
        huecos(EN_CODIGOS[k as keyof typeof EN_CODIGOS]).join(),
    )
    expect(distintos).toEqual([])
  })

  it('ningun porcentaje ingles lleva espacio antes del «%»', () => {
    expect(Object.entries(EN_CODIGOS).filter(([, v]) => /\S %/.test(v)).map(([k]) => k)).toEqual([])
  })
})
