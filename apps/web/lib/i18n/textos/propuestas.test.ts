import { describe, it, expect } from 'vitest'
import { ES_PROPUESTAS, EN_PROPUESTAS } from './propuestas'

// ============================================================================
//  EL DICCIONARIO DE PROPUESTAS ENTERO, CONGELADO.
// ----------------------------------------------------------------------------
//  `pantallas-propuestas.test.ts` rinde 20 estados de pantalla, y aun asi el
//  validador del lote (docs/i18n/validacion-propuestas.md §5) midio que 121 de
//  las 437 claves NO salen en ninguno: avisos emergentes, `window.confirm`, el
//  Roadblock, los singulares, los estados de carga. Para esas, nada impedia
//  cambiar una letra del espanol —que es una copia literal del texto de
//  antes— o dejar el ingles en espanol. Tres de ocho mutantes sobrevivieron.
//
//  Esto cierra el hueco sin rendir nada: una INSTANTANEA de los dos idiomas.
//  Cambiar una letra de cualquier entrada pone la prueba en rojo, y quien la
//  cambie a proposito tiene que regenerarla (`npx vitest run -u`) y el diff de
//  `__snapshots__/` enseña en la revision exactamente que texto cambio.
// ============================================================================

describe('diccionario de propuestas · instantanea', () => {
  it('el ESPANOL de las 437+ entradas no cambia sin que se vea', () => {
    expect(ES_PROPUESTAS).toMatchSnapshot()
  })

  it('el INGLES tampoco', () => {
    expect(EN_PROPUESTAS).toMatchSnapshot()
  })
})

describe('diccionario de propuestas · el ingles no esta en espanol', () => {
  // Las que coinciden A PROPOSITO en los dos idiomas: palabras iguales,
  // nombres de metodo o plantillas sin texto. Cualquier otra igualdad es un
  // texto que se quedo sin traducir.
  const IGUALES = new Set([
    'propuestas.comun.error',
    'propuestas.comun.total',
    'propuestas.comun.digital',
    'propuestas.alta.divisor',
    'propuestas.ficha.aprobado.total',
    'propuestas.lista.resumen',
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    const iguales = Object.keys(ES_PROPUESTAS).filter(
      (k) => ES_PROPUESTAS[k as keyof typeof ES_PROPUESTAS] === EN_PROPUESTAS[k as keyof typeof EN_PROPUESTAS],
    )
    expect(iguales.filter((k) => !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    const malas = Object.entries(EN_PROPUESTAS)
      .filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v))
      .map(([k]) => k)
    expect(malas).toEqual([])
  })
})
