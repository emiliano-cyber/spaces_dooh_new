import { describe, it, expect } from 'vitest'
import { CLAVES, DICCIONARIOS, AMBITOS_ITALIANO, IT_PARCIAL, conCaidaAlIngles } from './diccionario'
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

  it('la caida: lo escrito gana, lo vacio no cuenta', () => {
    const it_ = conCaidaAlIngles(DICCIONARIOS.en, { 'comun.o': '', 'comun.cancelar': 'Annulla' })
    expect(it_['comun.cancelar']).toBe('Annulla')
    expect(it_['comun.o']).toBe('or')
    expect(it_['comun.guardar']).toBe('Save')
  })

  it('lo que falta se pinta en INGLES, no en espanol', () => {
    // Lote L5: la base ya tiene italiano, asi que la caida se mira con una
    // tabla vacia y, sobre el diccionario real, clave por clave.
    const sinNada = conCaidaAlIngles(DICCIONARIOS.en, {})
    expect(sinNada['login.titulo.login']).toBe('Sign in')
    expect(sinNada['comun.cancelar']).toBe('Cancel')
    const it_ = IT_PARCIAL as Record<string, string | undefined>
    const mal = CLAVES.filter((k) => DICCIONARIOS.it[k] !== (it_[k] ? it_[k] : DICCIONARIOS.en[k]))
    expect(mal).toEqual([])
  })

  it('el italiano escrito esta bien formado', () => {
    expect(problemasItaliano()).toEqual([])
  })

  it('y la comprobacion MUERDE: vacio, huecos perdidos y claves inventadas', () => {
    const it_ = IT_PARCIAL as Record<string, string>
    // Lote L5: las dos claves ya tienen italiano; se guardan y se restauran.
    const antes = { demasiados: it_['login.error.demasiados'], o: it_['comun.o'] }
    const traducidasAntes = coberturaItaliano()[0].traducidas
    it_['login.error.demasiados'] = 'Troppi tentativi.'
    it_['comun.o'] = ''
    it_['no.existe'] = 'x'
    CATALOGO_ERRORES_IT['Frase que no existe'] = 'y'
    try {
      expect(problemasItaliano().sort()).toEqual(
        [
          'huecos distintos en login.error.demasiados: es {s} · it {}',
          'vacia: comun.o',
          'clave sin espanol: no.existe',
          'errores: entrada sin espanol canonico: Frase que no existe',
        ].sort(),
      )
      // Y una vacia no cuenta como traducida (`comun.o` tenia italiano).
      expect(coberturaItaliano()[0].traducidas).toBe(traducidasAntes - (antes.o ? 1 : 0))
    } finally {
      for (const [k, v] of [
        ['login.error.demasiados', antes.demasiados],
        ['comun.o', antes.o],
      ] as const) {
        if (v === undefined) delete it_[k]
        else it_[k] = v
      }
      delete it_['no.existe']
      delete CATALOGO_ERRORES_IT['Frase que no existe']
    }
  })
})

// ============================================================================
//  LOTE L5 (armazon, cuenta, administracion, compartidos y servidor) · sus
//  filas, COMPLETAS. Una por ambito para que el rojo diga cual falta.
// ============================================================================
const AMBITOS_L5 = ['base (diccionario.ts)', 'compartidos', 'shell', 'cuenta', 'admin', 'notificaciones', 'servidor']

describe('lote L5 · sus ambitos sin pendientes', () => {
  const filas = coberturaItaliano()
  for (const ambito of AMBITOS_L5) {
    it(ambito, () => {
      const f = filas.find((x) => x.ambito === ambito)
      expect(f, ambito).toBeDefined()
      expect(f!.pendientes).toBe(0)
    })
  }
})
