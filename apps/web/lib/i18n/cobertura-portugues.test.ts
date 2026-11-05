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
    // Una clave sin portugues (cualquiera de otro lote) sale en espanol, nunca
    // en ingles; una de L5, en portugues.
    const pendiente = CLAVES.find((k) => !pt[k] && ES[k] !== DICCIONARIOS.en[k])
    if (pendiente) {
      expect(traducir('pt', pendiente)).toBe(ES[pendiente])
      expect(traducir('pt', pendiente)).not.toBe(DICCIONARIOS.en[pendiente])
    }
    expect(traducir('pt', 'login.titulo.login')).toBe('Entrar')
    expect(traducir('pt', 'comun.guardar')).toBe('Salvar')
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

  // La costura (05/11): con los cinco lotes integrados, NINGUNA fila tiene
  // pendientes. Sustituye a las pruebas de transicion (las once filas del L5
  // y «fuera del L5, solo lo de los papeles»). Es la medida que manda el
  // tablero antes de encender `IDIOMA_PORTUGUES`: con la caida al espanol,
  // una clave sin portugues no se nota en la pantalla, y solo esto la ve.
  it('COSTURA · los cinco lotes cerrados: 0 pendientes en TODAS las filas', () => {
    const conPendientes = filas.filter((f) => f.pendientes > 0).map((f) => `${f.ambito}: ${f.pendientes}`)
    expect(conPendientes).toEqual([])
    // Y que mire algo: las 21 filas de ambito, la base y las cuatro de errores.
    expect(filas.length).toBe(AMBITOS_PORTUGUES.length + 5)
    expect(filas.reduce((a, f) => a + f.traducidas, 0)).toBeGreaterThan(5900)
  })

  it('COSTURA · cada ambito se cubre con SU PT_<AMBITO>, no con lo escrito en otro sitio', () => {
    // Entre P3 y la costura, `papeles-portugues.ts` tapaba 151 claves de siete
    // ambitos: una fila podia salir completa sin que su lote las tuviera.
    for (const a of AMBITOS_PORTUGUES) {
      const faltan = Object.keys(a.es).filter((k) => !a.pt[k])
      expect(faltan, a.ambito).toEqual([])
    }
  })

  it('el portugues escrito esta bien formado', () => {
    expect(problemasPortugues()).toEqual([])
  })

  it('y la comprobacion MUERDE: vacio, huecos perdidos y claves inventadas', () => {
    // Desde el lote L5 las dos claves de la base YA tienen portugues: se
    // guardan y se RESTAURAN (borrarlas dejaria el modulo sin ellas para las
    // pruebas que corran despues en el mismo proceso).
    const pt = PT_PARCIAL as Record<string, string | undefined>
    const antes = { demasiados: pt['login.error.demasiados'], o: pt['comun.o'] }
    const traducidasAntes = coberturaPortugues()[0].traducidas
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
      expect(coberturaPortugues()[0].traducidas).toBe(traducidasAntes - 1)
    } finally {
      pt['login.error.demasiados'] = antes.demasiados
      pt['comun.o'] = antes.o
      delete pt['no.existe']
      delete CATALOGO_ERRORES_PT['Frase que no existe']
    }
    expect(problemasPortugues()).toEqual([])
  })

  it('la fila de patrones cuenta los que no tienen portugues (lote L5: ninguno)', () => {
    const fila = filas.find((f) => f.ambito === 'errores · patrones')!
    expect(fila.claves).toBe(PATRONES_ERROR.length)
    expect(fila.pendientes).toBe(PATRONES_ERROR.filter((p) => !p.pt).length)
    expect(fila.pendientes).toBe(0)
  })
})
