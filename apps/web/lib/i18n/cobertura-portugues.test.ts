import { PT_PAPELES } from './textos/papeles-portugues'
import { describe, it, expect } from 'vitest'
import { CLAVES, DICCIONARIOS, AMBITOS_PORTUGUES, PT_PARCIAL, conCaidaAlEspanol, traducir } from './diccionario'
import { CATALOGO_ERRORES_PT, PATRONES_ERROR } from './errores-servidor'
import { coberturaPortugues, problemasPortugues, tablaCoberturaPortugues, clavesBasePortugues } from './cobertura-portugues'

// ============================================================================
//  Ola 0 del portugues (2026-11-05) · LA CAIDA AL ESPANOL Y LA COBERTURA.
//
//  Decision del dueno (05/11): mientras falte una clave en portugues, se pinta
//  en ESPANOL —no en ingles, como el italiano—. La caida vive en un solo sitio
//  (`conCaidaAlEspanol`, `diccionario.ts`); esta prueba la fija y cuenta lo que
//  falta por ambito. No exige que este traducido: eso es de los lotes.
// ============================================================================

const ES = DICCIONARIOS.es as Record<string, string>
const PT = DICCIONARIOS.pt as Record<string, string>

describe('DICCIONARIOS.pt · la caida al ESPANOL', () => {
  it('tiene exactamente las claves del espanol', () => {
    expect(Object.keys(PT).sort()).toEqual([...CLAVES].sort())
  })

  it('lo que falta sale en ESPANOL, nunca en ingles ni como clave cruda', () => {
    const pt = PT_PARCIAL as Record<string, string | undefined>
    const mal = CLAVES.filter((k) => PT[k] !== (pt[k] ? pt[k] : ES[k]))
    expect(mal).toEqual([])
    expect(traducir('pt', 'login.titulo.login')).toBe(ES['login.titulo.login'])
    expect(traducir('pt', 'comun.cancelar')).toBe('Cancelar')
    expect(traducir('pt', 'comun.cancelar')).not.toBe(DICCIONARIOS.en['comun.cancelar'])
  })

  it('la caida: lo escrito gana, lo vacio no cuenta', () => {
    const pt = conCaidaAlEspanol(DICCIONARIOS.es, { 'comun.o': '', 'comun.cancelar': 'Cancelar!' })
    expect(pt['comun.cancelar']).toBe('Cancelar!')
    expect(pt['comun.o']).toBe(ES['comun.o'])
    expect(pt['comun.guardar']).toBe(ES['comun.guardar'])
  })

  it('el selector se nombra a si mismo en portugues, en los cuatro idiomas', () => {
    for (const i of ['es', 'en', 'it', 'pt'] as const) expect(DICCIONARIOS[i]['idioma.pt']).toBe('Português')
    expect(PT['idioma.etiqueta']).toBe('Idioma')
    expect(PT['idioma.cambiar']).toBe('Mudar idioma')
  })
})

describe('cobertura del portugues', () => {
  const filas = coberturaPortugues()

  it('informa, por ambito, cuantas claves faltan', () => {
    // eslint-disable-next-line no-console
    console.log(`\nCobertura del portugues\n${tablaCoberturaPortugues(filas)}\n`)
    for (const f of filas) expect(f.traducidas + f.pendientes, f.ambito).toBe(f.claves)
  })

  it('las filas de la interfaz suman TODAS las claves del diccionario, sin repetir', () => {
    const interfaz = filas.filter((f) => !f.ambito.startsWith('errores'))
    expect(interfaz.reduce((a, f) => a + f.claves, 0)).toBe(CLAVES.length)
    expect(new Set(AMBITOS_PORTUGUES.map((a) => a.ambito)).size).toBe(AMBITOS_PORTUGUES.length)
    expect(clavesBasePortugues()).toContain('idioma.pt')
  })

  it('ola 0: el selector; P3 (05/11): las claves de los PAPELES, y nada mas', () => {
    expect(filas[0].traducidas).toBe(6)
    // Lo traducido de cada ambito es exactamente lo que P3 escribio para los
    // papeles (`textos/papeles-portugues.ts`); el resto lo traducen los lotes.
    const dePapel = (ambito: string) => Object.keys(PT_PAPELES).filter((k) => k.split('.')[0] === ambito).length
    for (const f of filas.slice(1)) {
      if (f.ambito.startsWith('errores')) expect(f.traducidas, f.ambito).toBe(0)
      else expect(f.traducidas, f.ambito).toBe(dePapel(f.ambito))
    }
    expect(Object.keys(PT_PAPELES).length).toBeGreaterThan(150)
  })

  it('el portugues escrito esta bien formado', () => {
    expect(problemasPortugues()).toEqual([])
  })

  it('y la comprobacion MUERDE: vacio, huecos perdidos y claves inventadas', () => {
    const pt = PT_PARCIAL as Record<string, string | undefined>
    pt['login.error.demasiados'] = 'Muitas tentativas.'
    pt['comun.o'] = ''
    pt['no.existe'] = 'x'
    CATALOGO_ERRORES_PT['Frase que no existe'] = 'y'
    try {
      expect(problemasPortugues().sort()).toEqual(
        [
          'huecos distintos en login.error.demasiados: es {s} · pt {}',
          'vacia: comun.o',
          'clave sin espanol: no.existe',
          'errores: entrada sin espanol canonico: Frase que no existe',
        ].sort(),
      )
      // Y una vacia no cuenta como traducida; una escrita si.
      expect(coberturaPortugues()[0].traducidas).toBe(7)
    } finally {
      delete pt['login.error.demasiados']
      delete pt['comun.o']
      delete pt['no.existe']
      delete CATALOGO_ERRORES_PT['Frase que no existe']
    }
  })

  it('la fila de patrones cuenta los que no tienen portugues', () => {
    const fila = filas.find((f) => f.ambito === 'errores · patrones')!
    expect(fila.claves).toBe(PATRONES_ERROR.length)
    expect(fila.pendientes).toBe(PATRONES_ERROR.length)
  })
})
