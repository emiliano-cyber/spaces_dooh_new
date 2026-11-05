import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  IDIOMAS,
  portuguesActivo,
  italianoActivo,
  inglesActivo,
  idiomasActivos,
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
//  La ola 0 metio el portugues en la INTERFAZ antes que en la BASE (CHECK
//  es/en/it). La tarea ROJA P3 (05/11, `20261105_idioma_portugues.sql`) abrio
//  los dos CHECK: desde ahi «Mi cuenta» y el alta aceptan `pt` como los demas,
//  y el bloque del final lo fija.
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

// ─── P3 (05/11) · LA BASE YA SABE PORTUGUES ─────────────────────────────────
// `20261105_idioma_portugues.sql` abre los dos CHECK a `pt`, y la lista
// temporal `IDIOMAS_EN_LA_BASE` desaparece: lo que se escribe en la base se
// valida contra `IDIOMAS`, como antes de la ola 0. El interruptor sigue
// mandando sobre la INTERFAZ: apagado, la cuenta no ofrece ni guarda `pt`.
describe('P3 · el portugues llega a la base como los demas idiomas', () => {
  it('la lista temporal de la ola 0 ya no existe', async () => {
    const mod = (await import('./idiomas')) as Record<string, unknown>
    expect(mod.IDIOMAS_EN_LA_BASE).toBeUndefined()
    expect(mod.esIdiomaEnLaBase).toBeUndefined()
    expect(mod.idiomasDeCuenta).toBeUndefined()
  })

  it('encendido, «Mi cuenta» puede guardar pt; apagado, no (preferenciaDeIdioma con los activos)', () => {
    const encendido = idiomasActivos({ IDIOMA_INGLES: '1', IDIOMA_PORTUGUES: '1' })
    expect(preferenciaDeIdioma('pt', encendido)).toEqual({ ok: true, idioma: 'pt' })
    const apagado = idiomasActivos({ IDIOMA_INGLES: '1', IDIOMA_ITALIANO: '1' })
    expect(preferenciaDeIdioma('pt', apagado)).toEqual({ ok: false })
    expect(preferenciaDeIdioma('en', apagado)).toEqual({ ok: true, idioma: 'en' })
    expect(preferenciaDeIdioma('navegador', apagado)).toEqual({ ok: true, idioma: null })
  })

  it('H1 cerrado · con pt encendido y guardado en la cuenta, la cuenta lo impone (gana a la cookie)', () => {
    const permitidos = idiomasActivos({ IDIOMA_PORTUGUES: '1' })
    expect(resolverIdioma({ cuenta: 'pt', cookie: 'es', cabecera: 'es-MX', permitidos })).toBe('pt')
  })

  it('NEGATIVO · apagado, una cuenta con pt guardado NO ve portugues (se ignora sin error)', () => {
    const permitidos = idiomasActivos({})
    expect(resolverIdioma({ cuenta: 'pt', cookie: null, cabecera: 'pt-BR', permitidos })).toBe('es')
  })

  it('el alta acepta documentos en pt, sea cual sea el interruptor de la interfaz', () => {
    expect(idiomaDocumentosPedido('pt')).toBe('pt')
  })

  it.each(['pt-BR', 'PT', 'pt_BR', 'br', 'fr', ''])(
    'NEGATIVO · el alta rechaza %j con el 400 legible (no un 500 de la base)',
    (valor) => {
      let error: unknown = null
      try {
        idiomaDocumentosPedido(valor)
      } catch (e) {
        error = e
      }
      expect(error).toMatchObject({ status: 400, message: 'El idioma de los documentos debe ser es, en, it o pt' })
    },
  )
})
