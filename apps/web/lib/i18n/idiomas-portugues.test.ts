import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  IDIOMAS,
  IDIOMAS_EN_LA_BASE,
  portuguesActivo,
  italianoActivo,
  inglesActivo,
  idiomasActivos,
  idiomasDeCuenta,
  normalizarIdioma,
  idiomaDeCabecera,
  resolverIdioma,
  preferenciaDeIdioma,
} from './idiomas'
import { idiomaDocumentosPedido } from '../server/idioma-alta'

// ============================================================================
//  Ola 0 del portugues (2026-11-05) · el cuarto idioma, detras de SU PROPIO
//  interruptor. La regla es la del ingles (30/09) y la del italiano (03/11):
//  apagado por omision, y apagado significa que NADIE lo ve aunque su cookie o
//  su navegador lo pidan. pt-BR (Brasil), decision del dueno del 05/11.
//
//  Y una regla NUEVA de esta ola: el portugues entra en la INTERFAZ antes que
//  en la BASE. `usuarios.idioma_preferido` y `tenants.idioma_documentos` tienen
//  un CHECK es/en/it (migraciones `20261103_*`); abrirlo es una tarea ROJA
//  aparte. Hasta entonces, ni «Mi cuenta» ni el alta pueden mandar `pt` a la
//  base: lo rechazarian con un 500 en vez de un mensaje.
// ============================================================================

describe('IDIOMAS · el catalogo con el portugues', () => {
  it('son cuatro, en este orden: el portugues el cuarto, los otros no se mueven', () => {
    expect(IDIOMAS).toEqual(['es', 'en', 'it', 'pt'])
  })
})

describe('portuguesActivo · el interruptor del portugues', () => {
  it('sin la variable, APAGADO', () => {
    expect(portuguesActivo({})).toBe(false)
  })
  it('solo el valor exacto 1 lo enciende', () => {
    expect(portuguesActivo({ IDIOMA_PORTUGUES: '1' })).toBe(true)
    for (const v of ['0', 'true', 'si', 'sim', ' 1', '1 ', '']) {
      expect(portuguesActivo({ IDIOMA_PORTUGUES: v }), JSON.stringify(v)).toBe(false)
    }
  })
  it('es SU interruptor: ni el ingles ni el italiano lo encienden, ni el lo enciende a ellos', () => {
    expect(portuguesActivo({ IDIOMA_INGLES: '1', IDIOMA_ITALIANO: '1' })).toBe(false)
    expect(inglesActivo({ IDIOMA_PORTUGUES: '1' })).toBe(false)
    expect(italianoActivo({ IDIOMA_PORTUGUES: '1' })).toBe(false)
  })
})

describe('idiomasActivos · con el portugues', () => {
  it('apagado, como antes', () => {
    expect(idiomasActivos({})).toEqual(['es'])
    expect(idiomasActivos({ IDIOMA_INGLES: '1', IDIOMA_ITALIANO: '1' })).toEqual(['es', 'en', 'it'])
  })
  it('encendido, anade SU idioma al final', () => {
    expect(idiomasActivos({ IDIOMA_PORTUGUES: '1' })).toEqual(['es', 'pt'])
    expect(idiomasActivos({ IDIOMA_INGLES: '1', IDIOMA_ITALIANO: '1', IDIOMA_PORTUGUES: '1' })).toEqual([
      'es',
      'en',
      'it',
      'pt',
    ])
  })
})

describe('el portugues en la deteccion', () => {
  it('normalizarIdioma reconoce pt, pt-BR y pt-PT', () => {
    expect(normalizarIdioma('pt', IDIOMAS)).toBe('pt')
    expect(normalizarIdioma('pt-BR', IDIOMAS)).toBe('pt')
    expect(normalizarIdioma('pt-PT', IDIOMAS)).toBe('pt')
    expect(normalizarIdioma('pt-BR', ['es', 'en', 'it'])).toBeNull()
  })

  it('apagado, la cabecera se lo salta y toma el siguiente', () => {
    expect(idiomaDeCabecera('pt-BR,pt;q=0.9,es;q=0.8', ['es', 'en', 'it'])).toBe('es')
    expect(idiomaDeCabecera('pt-BR,pt;q=0.9,es;q=0.8', ['es', 'pt'])).toBe('pt')
  })

  it('una cookie que pide el portugues APAGADO se trata como si no hubiera cookie', () => {
    expect(resolverIdioma({ cookie: 'pt', cabecera: 'en-US', permitidos: ['es', 'en'] })).toBe('en')
    expect(resolverIdioma({ cookie: 'pt', cabecera: null, permitidos: ['es', 'en', 'it'] })).toBe('es')
    expect(resolverIdioma({ cookie: 'pt', cabecera: 'it-IT', permitidos: ['es', 'it', 'pt'] })).toBe('pt')
  })
})

describe('por omision, un portugues apagado no se acepta', () => {
  let antes: string | undefined
  beforeEach(() => {
    antes = process.env.IDIOMA_PORTUGUES
    delete process.env.IDIOMA_PORTUGUES
  })
  afterEach(() => {
    if (antes === undefined) delete process.env.IDIOMA_PORTUGUES
    else process.env.IDIOMA_PORTUGUES = antes
  })

  it('apagado: ni la cookie, ni la cabecera, ni normalizar', () => {
    expect(normalizarIdioma('pt-BR')).toBeNull()
    expect(idiomaDeCabecera('pt-BR,pt;q=0.9,en;q=0.8')).toBe('en')
    expect(resolverIdioma({ cookie: 'pt', cabecera: null })).toBe('es')
  })

  it('encendido: si', () => {
    process.env.IDIOMA_PORTUGUES = '1'
    expect(normalizarIdioma('pt-BR')).toBe('pt')
    expect(resolverIdioma({ cookie: 'pt', cabecera: null })).toBe('pt')
  })

  for (const v of ['0', 'true', ' 1', '']) {
    it(`IDIOMA_PORTUGUES=${JSON.stringify(v)} lo deja apagado`, () => {
      process.env.IDIOMA_PORTUGUES = v
      expect(normalizarIdioma('pt')).toBeNull()
    })
  }
})

// ─── LA BASE TODAVIA NO SABE PORTUGUES ──────────────────────────────────────
describe('el portugues NO llega a la base (CHECK es/en/it, tarea roja aparte)', () => {
  it('IDIOMAS_EN_LA_BASE son exactamente los del CHECK de las migraciones del 03/11', () => {
    expect(IDIOMAS_EN_LA_BASE).toEqual(['es', 'en', 'it'])
  })

  it('«Mi cuenta» no ofrece guardar el portugues aunque este encendido', () => {
    expect(idiomasDeCuenta({ IDIOMA_PORTUGUES: '1' })).toEqual(['es'])
    expect(idiomasDeCuenta({ IDIOMA_INGLES: '1', IDIOMA_ITALIANO: '1', IDIOMA_PORTUGUES: '1' })).toEqual([
      'es',
      'en',
      'it',
    ])
    // Y sin el portugues, lo mismo que `idiomasActivos`: nada cambia para es/en/it.
    expect(idiomasDeCuenta({ IDIOMA_INGLES: '1', IDIOMA_ITALIANO: '1' })).toEqual(
      idiomasActivos({ IDIOMA_INGLES: '1', IDIOMA_ITALIANO: '1' }),
    )
  })

  it('NEGATIVO · preferenciaDeIdioma rechaza pt con la lista de la cuenta, y lo demas como antes', () => {
    const cuenta = idiomasDeCuenta({ IDIOMA_INGLES: '1', IDIOMA_PORTUGUES: '1' })
    expect(preferenciaDeIdioma('pt', cuenta)).toEqual({ ok: false })
    expect(preferenciaDeIdioma('en', cuenta)).toEqual({ ok: true, idioma: 'en' })
    expect(preferenciaDeIdioma('navegador', cuenta)).toEqual({ ok: true, idioma: null })
  })

  it('NEGATIVO · el alta rechaza documentos en pt con el mensaje de siempre (400, no un 500 de la base)', () => {
    let error: unknown = null
    try {
      idiomaDocumentosPedido('pt')
    } catch (e) {
      error = e
    }
    expect(error).toMatchObject({ status: 400, message: 'El idioma de los documentos debe ser es, en o it' })
  })
})
