import { describe, it, expect, afterEach } from 'vitest'
import {
  CATALOGO_ERRORES,
  CATALOGO_ERRORES_IT,
  CATALOGO_LIB,
  CAMPO_IT,
  PATRONES_ERROR,
  traducirError,
  type PatronError,
} from './errores-servidor'

// ============================================================================
//  Ola 0 del italiano (2026-11-03) · los errores del servidor aceptan `it`.
//  Los catalogos italianos nacen VACIOS y los rellena el lote del servidor.
//  Mientras falte una entrada, el error sale en INGLES —igual que la interfaz
//  (`diccionario.ts`)— y nunca a medias: si una pieza de un mensaje compuesto
//  no tiene italiano, el mensaje entero va en ingles.
// ============================================================================

const limpiar: Array<() => void> = []
afterEach(() => {
  while (limpiar.length) limpiar.pop()!()
})
function ponerIt(tabla: Partial<Record<string, string>>, es: string, it: string) {
  tabla[es] = it
  limpiar.push(() => delete tabla[es])
}

describe('sin italiano escrito, cae al ingles', () => {
  it('todo el catalogo y el de lib: identico al ingles', () => {
    const distintos = [...Object.keys(CATALOGO_ERRORES), ...Object.keys(CATALOGO_LIB)].filter(
      (m) => CATALOGO_ERRORES_IT[m] === undefined && traducirError(m, 'it') !== traducirError(m, 'en'),
    )
    expect(distintos).toEqual([])
  })
  it('un patron y un compuesto «Campo: motivo», en ingles', () => {
    expect(traducirError('Debe tener al menos 3 caracteres', 'it')).toBe('Must be at least 3 characters')
    expect(traducirError('Correo: Este dato es obligatorio', 'it')).toBe(traducirError('Correo: Este dato es obligatorio', 'en'))
  })
  it('lo desconocido sale tal cual, como en ingles', () => {
    expect(traducirError('Algo que nadie tradujo', 'it')).toBe('Algo que nadie tradujo')
  })
})

describe('con italiano escrito, sale en italiano', () => {
  it('una frase exacta', () => {
    ponerIt(CATALOGO_ERRORES_IT, 'No encontrado', 'Non trovato')
    expect(traducirError('No encontrado', 'it')).toBe('Non trovato')
    expect(traducirError('No encontrado', 'en')).toBe(CATALOGO_ERRORES['No encontrado'])
    expect(traducirError('No encontrado', 'es')).toBe('No encontrado')
  })

  it('un patron con su plantilla `it`', () => {
    const p = PATRONES_ERROR.find((x) => x.re.source.startsWith('^Debe tener al menos')) as PatronError
    p.it = 'Deve avere almeno $1 caratteri'
    limpiar.push(() => delete p.it)
    expect(traducirError('Debe tener al menos 3 caracteres', 'it')).toBe('Deve avere almeno 3 caratteri')
    expect(traducirError('Debe tener al menos 3 caracteres', 'en')).toBe('Must be at least 3 characters')
  })

  it('«Campo: motivo» solo si las DOS piezas tienen italiano; si no, entero en ingles', () => {
    const msg = 'Correo: Este dato es obligatorio'
    const ingles = traducirError(msg, 'en')
    ponerIt(CAMPO_IT, 'Correo', 'Email')
    expect(traducirError(msg, 'it')).toBe(ingles)
    ponerIt(CATALOGO_ERRORES_IT, 'Este dato es obligatorio', 'Dato obbligatorio')
    expect(traducirError(msg, 'it')).toBe('Email: Dato obbligatorio')
  })

  it('un patron con un hueco que el ingles traduce y el italiano no: entero en ingles', () => {
    const msg =
      'No se puede quitar el paquete "P1": sin el paquete vuelve a aplicarse el descuento por volumen de las lineas. ' +
      'No encontrado Baja primero el descuento comercial y vuelve a quitar el paquete.'
    const p = PATRONES_ERROR.find((x) => x.re.test(msg)) as PatronError
    expect(p.huecos?.[2]).toBeTypeOf('function')
    p.it = 'Pacchetto $1: $2'
    limpiar.push(() => delete p.it)
    expect(traducirError(msg, 'it')).toBe(traducirError(msg, 'en'))
    // Con su funcion italiana para ese hueco, ya si.
    p.huecosIt = { 2: (v) => (v === 'No encontrado' ? 'Non trovato' : v) }
    limpiar.push(() => delete p.huecosIt)
    expect(traducirError(msg, 'it')).toBe('Pacchetto P1: Non trovato')
  })
})
