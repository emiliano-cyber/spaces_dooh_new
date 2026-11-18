import { describe, it, expect, afterEach } from 'vitest'
import {
  CATALOGO_ERRORES,
  CATALOGO_ERRORES_PT,
  CATALOGO_LIB_PT,
  CAMPO_EN,
  CAMPO_PT,
  FALTA_FIRMA_EN,
  FALTA_FIRMA_PT,
  PATRONES_ERROR,
  patronesPtSinPatron,
  traducirError,
  type PatronError,
} from './errores-servidor'
import { ES_SERVIDOR } from './textos/servidor'

// ============================================================================
//  Portugues · los errores del servidor.
//
//  Ola 0 (2026-11-05): los catalogos aceptan `pt` y la regla de la caida.
//  Lote L5 (2026-11-05): los catalogos, COMPLETOS. Lo que esta prueba fija:
//
//    · todo el catalogo, los campos, la firma y los patrones tienen portugues;
//    · mientras falte UNA pieza, el mensaje sale ENTERO en ESPANOL (decision
//      del dueno del 05/11), nunca a medias ni en ingles. Como el portugues ya
//      esta escrito, la caida se ve QUITANDO a mano la pieza (y devolviendola).
// ============================================================================

const limpiar: Array<() => void> = []
afterEach(() => {
  while (limpiar.length) limpiar.pop()!()
})
function quitar(tabla: Partial<Record<string, string>>, es: string) {
  const antes = tabla[es]
  delete tabla[es]
  limpiar.push(() => {
    tabla[es] = antes
  })
}
function quitarPatron(p: PatronError, que: 'pt' | 'huecosPt') {
  const antes = { pt: p.pt, huecosPt: p.huecosPt }
  delete p[que]
  limpiar.push(() => {
    p.pt = antes.pt
    p.huecosPt = antes.huecosPt
  })
}
const patron = (msg: string) => PATRONES_ERROR.find((x) => x.re.test(msg)) as PatronError

describe('los catalogos del portugues, completos (lote L5)', () => {
  it('catalogo, lib, campos, firma y patrones', () => {
    expect(Object.keys(CATALOGO_ERRORES).filter((k) => !CATALOGO_ERRORES_PT[k])).toEqual([])
    expect(Object.keys(CAMPO_EN).filter((k) => !CAMPO_PT[k])).toEqual([])
    expect(Object.keys(FALTA_FIRMA_EN).filter((k) => !FALTA_FIRMA_PT[k])).toEqual([])
    expect(PATRONES_ERROR.filter((p) => p.pt === undefined).map((p) => p.en)).toEqual([])
    expect(patronesPtSinPatron()).toEqual([])
    // `lib` sale del diccionario (`textos/servidor.ts`): todo lo que no lleva huecos.
    const sinHuecos = Object.values(ES_SERVIDOR).filter((v) => !v.includes('{'))
    expect(Object.keys(CATALOGO_LIB_PT).sort()).toEqual([...sinHuecos].sort())
  })

  it('todo el catalogo sale en portugues, ninguno en espanol ni en ingles', () => {
    for (const es of Object.keys(CATALOGO_ERRORES)) {
      const pt = traducirError(es, 'pt')
      expect(pt, es).toBe(CATALOGO_ERRORES_PT[es])
    }
  })

  it('un «Campo: motivo» y un patron', () => {
    expect(traducirError('Correo: Este dato es obligatorio', 'pt')).toBe('E-mail: Este dado é obrigatório')
    expect(traducirError('Debe tener al menos 3 caracteres', 'pt')).toBe('Deve ter pelo menos 3 caracteres')
    expect(traducirError('Fecha de inicio: Debe ser mayor que 2.5', 'pt')).toBe('Data de início: Deve ser maior que 2,5')
  })

  it('el italiano y el ingles no se enteran', () => {
    expect(traducirError('No encontrado', 'pt')).toBe('Não encontrado')
    expect(traducirError('No encontrado', 'en')).toBe('Not found')
    expect(traducirError('No encontrado', 'it')).toBe('Non trovato')
  })
})

describe('sin una pieza portuguesa, el mensaje sale ENTERO en espanol', () => {
  it('una frase del catalogo', () => {
    quitar(CATALOGO_ERRORES_PT, 'No encontrado')
    expect(traducirError('No encontrado', 'pt')).toBe('No encontrado')
  })

  it('NUNCA en ingles', () => {
    quitar(CATALOGO_ERRORES_PT, 'No encontrado')
    expect(traducirError('No encontrado', 'pt')).not.toBe(traducirError('No encontrado', 'en'))
  })

  it('lo desconocido, tal cual', () => {
    expect(traducirError('Algo que nadie tradujo', 'pt')).toBe('Algo que nadie tradujo')
  })

  it('NEGATIVO · el motivo en portugues y el campo sin el: ENTERO en espanol', () => {
    quitar(CAMPO_PT, 'Correo')
    expect(CAMPO_EN['Correo']).toBeDefined()
    expect(traducirError('Correo: Este dato es obligatorio', 'pt')).toBe('Correo: Este dato es obligatorio')
  })

  it('NEGATIVO · el campo en portugues y el motivo sin el: ENTERO en espanol', () => {
    quitar(CATALOGO_ERRORES_PT, 'Este dato es obligatorio')
    expect(traducirError('Correo: Este dato es obligatorio', 'pt')).toBe('Correo: Este dato es obligatorio')
  })

  it('NEGATIVO · un patron sin su plantilla: en espanol', () => {
    quitarPatron(patron('Debe tener al menos 3 caracteres'), 'pt')
    expect(traducirError('Debe tener al menos 3 caracteres', 'pt')).toBe('Debe tener al menos 3 caracteres')
  })

  it('NEGATIVO · un patron con hueco traducido en ingles y sin su funcion portuguesa: en espanol', () => {
    const msg = 'No se puede editar un prospecto perdido'
    const p = patron(msg)
    expect(p.huecos).toBeDefined()
    expect(traducirError(msg, 'pt')).toBe('Não é possível editar este prospect: ele foi perdido')
    quitarPatron(p, 'huecosPt')
    expect(traducirError(msg, 'pt')).toBe(msg)
  })

  it('NEGATIVO · un hueco que su tabla no conoce: en espanol, nunca «ele inventada»', () => {
    expect(traducirError('No se puede editar un prospecto inventada', 'pt')).toBe(
      'No se puede editar un prospecto inventada',
    )
  })
})
