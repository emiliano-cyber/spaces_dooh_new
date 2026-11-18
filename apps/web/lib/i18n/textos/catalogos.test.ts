import { describe, it, expect } from 'vitest'
import { ES_CATALOGOS, EN_CATALOGOS } from './catalogos'

// ============================================================================
//  EL DICCIONARIO DE CATALOGOS, CONGELADO.
// ----------------------------------------------------------------------------
//  Mismo patron que `propuestas.test.ts` y `finanzas.test.ts`: una
//  instantanea de los dos idiomas, para que ni el espanol (copia literal) ni el
//  ingles cambien sin que el diff de `__snapshots__/` lo enseñe, y las mismas
//  guardias de forma que los otros lotes.
// ============================================================================

const ES = ES_CATALOGOS as Record<string, string>
const EN = EN_CATALOGOS as Record<string, string>

describe('diccionario de CATALOGOS · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_CATALOGOS).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_CATALOGOS).toMatchSnapshot()
  })
})

describe('diccionario de CATALOGOS · el ingles no esta en espanol', () => {
  // Textos que se escriben igual en los dos idiomas, cada uno con su motivo.
  const IGUALES = new Set<string>([])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    expect(Object.keys(ES).filter((k) => ES[k] === EN[k] && !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(Object.entries(EN).filter(([, v]) => /\s%/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('apostrofo tipografico, comillas curvas y nunca «Tap» ni «press»', () => {
    expect(Object.entries(EN).filter(([, v]) => /[A-Za-z]'[A-Za-z]|(^|[\s(])"|\b(tap|press)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(Object.keys(ES).filter((k) => huecos(ES[k]) !== huecos(EN[k]))).toEqual([])
  })

  it('todo plural lleva sus dos formas', () => {
    const sueltas = Object.keys(ES).filter(
      (k) => (k.endsWith('.uno') && !(k.replace(/\.uno$/, '.otros') in ES)) || (k.endsWith('.otros') && !(k.replace(/\.otros$/, '.uno') in ES)),
    )
    expect(sueltas).toEqual([])
  })
})
