import { describe, it, expect } from 'vitest'
import { CLAVES, DICCIONARIOS, AMBITOS_ITALIANO, IT_PARCIAL } from './diccionario'
import { CATALOGO_ERRORES_IT } from './errores-servidor'
import { coberturaItaliano, problemasItaliano, tablaCobertura, clavesBase } from './cobertura-italiano'

// ============================================================================
//  Ola 0 del italiano · LA COBERTURA. No exige que este todo traducido —eso es
//  el trabajo de los lotes—; exige que lo que falta se CUENTE y que lo escrito
//  este bien formado. La tabla sale por consola en cada corrida.
// ============================================================================

describe('cobertura del italiano', () => {
  const filas = coberturaItaliano()

  it('informa, por ambito, cuantas claves faltan', () => {
    // eslint-disable-next-line no-console
    console.log(`\nCobertura del italiano\n${tablaCobertura(filas)}\n`)
    for (const f of filas) expect(f.traducidas + f.pendientes, f.ambito).toBe(f.claves)
  })

  it('las filas de la interfaz suman TODAS las claves del diccionario, sin repetir', () => {
    const interfaz = filas.filter((f) => !f.ambito.startsWith('errores'))
    expect(interfaz.reduce((a, f) => a + f.claves, 0)).toBe(CLAVES.length)
    expect(new Set(AMBITOS_ITALIANO.map((a) => a.ambito)).size).toBe(AMBITOS_ITALIANO.length)
    expect(clavesBase()).toContain('idioma.it')
  })

  it('lo minimo de la shell ya esta: el selector de idioma', () => {
    const base = filas[0]
    expect(base.traducidas).toBeGreaterThanOrEqual(5)
    expect(DICCIONARIOS.it['idioma.cambiar']).toBe('Cambia lingua')
    expect(DICCIONARIOS.it['idioma.it']).toBe('Italiano')
  })

  it('lo que falta se pinta en INGLES, no en espanol', () => {
    expect(DICCIONARIOS.it['login.titulo.login']).toBe(DICCIONARIOS.en['login.titulo.login'])
    expect(DICCIONARIOS.it['comun.cancelar']).toBe('Cancel')
  })

  it('el italiano escrito esta bien formado', () => {
    expect(problemasItaliano()).toEqual([])
  })

  it('y la comprobacion MUERDE: vacio, huecos perdidos y claves inventadas', () => {
    const it_ = IT_PARCIAL as Record<string, string>
    it_['login.error.demasiados'] = 'Troppi tentativi.'
    it_['comun.o'] = ''
    it_['no.existe'] = 'x'
    CATALOGO_ERRORES_IT['Frase que no existe'] = 'y'
    try {
      expect(problemasItaliano()).toEqual([
        'huecos distintos en login.error.demasiados: es {s} · it {}',
        'vacia: comun.o',
        'clave sin espanol: no.existe',
        'errores: entrada sin espanol canonico: Frase que no existe',
      ])
      // Y una vacia no cuenta como traducida.
      expect(coberturaItaliano()[0].traducidas).toBe(6)
    } finally {
      delete it_['login.error.demasiados']
      delete it_['comun.o']
      delete it_['no.existe']
      delete CATALOGO_ERRORES_IT['Frase que no existe']
    }
  })
})
