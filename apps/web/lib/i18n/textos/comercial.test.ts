import { describe, it, expect } from 'vitest'
import { ES_COMERCIAL, EN_COMERCIAL } from './comercial'

// ============================================================================
//  EL DICCIONARIO DE COMERCIAL ENTERO, CONGELADO.
// ----------------------------------------------------------------------------
//  Mismo motivo que `propuestas.test.ts` (validacion del piloto, §5): muchas
//  claves no salen en ningun estado rendido por `pantallas-comercial.test.ts`
//  (avisos emergentes, `window.confirm`, estados de carga, singulares). Para
//  esas, nada impediria cambiar una letra del espanol —que es una copia
//  literal del texto de antes— o dejar el ingles en espanol. La INSTANTANEA de
//  los dos idiomas lo impide: cambiar una entrada a proposito obliga a
//  regenerarla (`npx vitest run -u`) y el diff de `__snapshots__/` lo enseña.
// ============================================================================

describe('diccionario de comercial · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_COMERCIAL).toMatchSnapshot()
  })

  it('el INGLES tampoco', () => {
    expect(EN_COMERCIAL).toMatchSnapshot()
  })
})

describe('diccionario de comercial · el ingles no esta en espanol', () => {
  // Las que coinciden A PROPOSITO en los dos idiomas: palabras iguales, marcas,
  // nombres propios de ejemplo o plantillas sin texto que traducir.
  const IGUALES = new Set([
    'comercial.comun.no', // «No»
    'comercial.comun.video', // «Video»
    'comercial.pagina.leyenda.digital', // «Digital»
    'comercial.reserva.tipo.dooh', // «Digital»
    'comercial.ficha.exhibicion.digital', // «digital»
    'comercial.ficha.renovacion.manual', // «Manual»
    'comercial.reserva.slots', // « · {n} slots»: «slots» no se traduce
    'comercial.editar.cupo.global-ph', // «Global: {n}»
    'comercial.reserva.cliente-ej', // «Seguros Andinos», nombre propio de ejemplo
    'comercial.negociacion.canal.whatsapp', // marca
    'comercial.tipo-medio.mural', // «Mural» tambien es ingles (decision del orquestador, 2026-11-02)
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    const iguales = Object.keys(ES_COMERCIAL).filter(
      (k) => ES_COMERCIAL[k as keyof typeof ES_COMERCIAL] === EN_COMERCIAL[k as keyof typeof EN_COMERCIAL],
    )
    expect(iguales.filter((k) => !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    const malas = Object.entries(EN_COMERCIAL)
      .filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v))
      .map(([k]) => k)
    expect(malas).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const distintos = Object.keys(ES_COMERCIAL).filter(
      (k) =>
        huecos(ES_COMERCIAL[k as keyof typeof ES_COMERCIAL]).join() !==
        huecos(EN_COMERCIAL[k as keyof typeof EN_COMERCIAL]).join(),
    )
    expect(distintos).toEqual([])
  })

  it('ningun porcentaje ingles lleva espacio antes del «%»', () => {
    expect(Object.entries(EN_COMERCIAL).filter(([, v]) => /\S %/.test(v)).map(([k]) => k)).toEqual([])
  })
})
