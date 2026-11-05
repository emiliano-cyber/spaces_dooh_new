import { describe, it, expect, afterEach } from 'vitest'
import {
  CATALOGO_ERRORES,
  CATALOGO_ERRORES_PT,
  CATALOGO_LIB_PT,
  CAMPO_EN,
  CAMPO_PT,
  FALTA_FIRMA_PT,
  PATRONES_ERROR,
  patronesPtSinPatron,
  traducirError,
  type PatronError,
} from './errores-servidor'

// ============================================================================
//  Ola 0 del portugues (2026-11-05) · los errores del servidor.
//
//  Los catalogos aceptan `pt` y nacen VACIOS. Mientras falte una pieza, el
//  mensaje sale ENTERO en ESPANOL (decision del dueno del 05/11, la misma que
//  la interfaz) y nunca a medias: un «Campo: motivo» o un patron con huecos
//  solo va en portugues si TODAS sus piezas lo tienen.
// ============================================================================

const limpiar: Array<() => void> = []
afterEach(() => {
  while (limpiar.length) limpiar.pop()!()
})
function poner(tabla: Partial<Record<string, string>>, es: string, pt: string) {
  tabla[es] = pt
  limpiar.push(() => delete tabla[es])
}
function ponerPatron(p: PatronError, pt: string, huecosPt?: PatronError['huecosPt']) {
  p.pt = pt
  if (huecosPt) p.huecosPt = huecosPt
  limpiar.push(() => {
    delete p.pt
    delete p.huecosPt
  })
}
const patron = (msg: string) => PATRONES_ERROR.find((x) => x.re.test(msg)) as PatronError

describe('los catalogos del portugues nacen vacios', () => {
  it('ni catalogo, ni lib, ni campos, ni firma, ni patrones', () => {
    expect(Object.keys(CATALOGO_ERRORES_PT)).toEqual([])
    expect(Object.keys(CATALOGO_LIB_PT)).toEqual([])
    expect(Object.keys(CAMPO_PT)).toEqual([])
    expect(Object.keys(FALTA_FIRMA_PT)).toEqual([])
    expect(PATRONES_ERROR.filter((p) => p.pt !== undefined)).toEqual([])
    expect(patronesPtSinPatron()).toEqual([])
  })
})

describe('sin portugues, el mensaje sale ENTERO en espanol', () => {
  it('todo el catalogo, tal cual entro', () => {
    for (const es of Object.keys(CATALOGO_ERRORES)) expect(traducirError(es, 'pt'), es).toBe(es)
  })
  it('un «Campo: motivo» y un patron', () => {
    expect(traducirError('Correo: Este dato es obligatorio', 'pt')).toBe('Correo: Este dato es obligatorio')
    expect(traducirError('Debe tener al menos 3 caracteres', 'pt')).toBe('Debe tener al menos 3 caracteres')
  })
  it('NUNCA en ingles', () => {
    expect(traducirError('No encontrado', 'pt')).not.toBe(traducirError('No encontrado', 'en'))
    expect(traducirError('No encontrado', 'pt')).toBe('No encontrado')
  })
  it('lo desconocido, tal cual', () => {
    expect(traducirError('Algo que nadie tradujo', 'pt')).toBe('Algo que nadie tradujo')
  })
})

describe('con la pieza portuguesa, en portugues; con media, en espanol', () => {
  it('una frase del catalogo', () => {
    poner(CATALOGO_ERRORES_PT, 'No encontrado', 'Não encontrado')
    expect(traducirError('No encontrado', 'pt')).toBe('Não encontrado')
    // El italiano y el ingles no se enteran.
    expect(traducirError('No encontrado', 'en')).toBe('Not found')
  })

  it('«Campo: motivo» con las dos piezas', () => {
    poner(CAMPO_PT, 'Correo', 'E-mail')
    poner(CATALOGO_ERRORES_PT, 'Este dato es obligatorio', 'Este campo é obrigatório')
    expect(traducirError('Correo: Este dato es obligatorio', 'pt')).toBe('E-mail: Este campo é obrigatório')
  })

  it('NEGATIVO · el motivo en portugues y el campo sin el: ENTERO en espanol', () => {
    poner(CATALOGO_ERRORES_PT, 'Este dato es obligatorio', 'Este campo é obrigatório')
    expect(CAMPO_EN['Correo']).toBeDefined()
    expect(traducirError('Correo: Este dato es obligatorio', 'pt')).toBe('Correo: Este dato es obligatorio')
  })

  it('NEGATIVO · el campo en portugues y el motivo sin el: ENTERO en espanol', () => {
    poner(CAMPO_PT, 'Correo', 'E-mail')
    expect(traducirError('Correo: Este dato es obligatorio', 'pt')).toBe('Correo: Este dato es obligatorio')
  })

  it('un patron con su plantilla', () => {
    ponerPatron(patron('Debe tener al menos 3 caracteres'), 'Deve ter pelo menos $1 caracteres')
    expect(traducirError('Debe tener al menos 3 caracteres', 'pt')).toBe('Deve ter pelo menos 3 caracteres')
  })

  it('NEGATIVO · un patron con hueco traducido en ingles y sin su funcion portuguesa: en espanol', () => {
    const msg = 'No se puede editar un prospecto perdido'
    const p = patron(msg)
    expect(p.huecos).toBeDefined()
    ponerPatron(p, 'Não é possível editar um prospect $1')
    expect(traducirError(msg, 'pt')).toBe(msg)
  })

  it('el italiano sigue igual con el portugues a medio poner', () => {
    poner(CATALOGO_ERRORES_PT, 'No encontrado', 'Não encontrado')
    expect(traducirError('No encontrado', 'it')).toBe('Non trovato')
  })
})
