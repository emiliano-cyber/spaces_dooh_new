import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  IDIOMAS,
  italianoActivo,
  inglesActivo,
  idiomasActivos,
  normalizarIdioma,
  idiomaDeCabecera,
  resolverIdioma,
} from './idiomas'

// ============================================================================
//  Ola 0 del italiano (2026-11-03) · el tercer idioma, detras de SU PROPIO
//  interruptor. La regla es la del ingles del 2026-09-30, copiada tal cual:
//  apagado por omision, y apagado significa que NADIE lo ve aunque su cookie o
//  su navegador lo pidan. Cada idioma se enciende por separado: encender el
//  italiano no enciende el ingles, ni al reves.
// ============================================================================

describe('IDIOMAS · el catalogo con el italiano', () => {
  it('son tres, en este orden, y el italiano es el tercero', () => {
    expect(IDIOMAS).toEqual(['es', 'en', 'it'])
  })
})

describe('italianoActivo · el interruptor del italiano', () => {
  it('sin la variable, APAGADO', () => {
    expect(italianoActivo({})).toBe(false)
  })
  it('solo el valor exacto 1 lo enciende', () => {
    expect(italianoActivo({ IDIOMA_ITALIANO: '1' })).toBe(true)
    for (const v of ['0', 'true', 'si', ' 1', '1 ', '']) {
      expect(italianoActivo({ IDIOMA_ITALIANO: v }), JSON.stringify(v)).toBe(false)
    }
  })
  it('es SU interruptor: el del ingles no lo enciende, y el suyo no enciende el ingles', () => {
    expect(italianoActivo({ IDIOMA_INGLES: '1' })).toBe(false)
    expect(inglesActivo({ IDIOMA_ITALIANO: '1' })).toBe(false)
  })
})

describe('idiomasActivos · lo que se puede elegir', () => {
  it('apagado todo, solo espanol', () => {
    expect(idiomasActivos({})).toEqual(['es'])
  })
  it('cada interruptor anade SU idioma', () => {
    expect(idiomasActivos({ IDIOMA_INGLES: '1' })).toEqual(['es', 'en'])
    expect(idiomasActivos({ IDIOMA_ITALIANO: '1' })).toEqual(['es', 'it'])
    expect(idiomasActivos({ IDIOMA_INGLES: '1', IDIOMA_ITALIANO: '1' })).toEqual(['es', 'en', 'it'])
  })
})

describe('el italiano en la deteccion', () => {
  it('normalizarIdioma reconoce it e it-IT', () => {
    // Lote L5: con la lista explicita. Por omision ya no se acepta un
    // italiano apagado (ver abajo).
    expect(normalizarIdioma('it', IDIOMAS)).toBe('it')
    expect(normalizarIdioma('it-IT', IDIOMAS)).toBe('it')
    expect(normalizarIdioma('it', ['es', 'en'])).toBeNull()
  })

  it('con el italiano fuera de los permitidos, la cabecera se lo salta y toma el siguiente', () => {
    // Es lo que pasaba antes de existir el italiano: «it» era un idioma que no
    // hablabamos. Con el interruptor apagado tiene que seguir siendolo.
    expect(idiomaDeCabecera('it-IT,it;q=0.9,en;q=0.8', ['es', 'en'])).toBe('en')
    expect(idiomaDeCabecera('it-IT,it;q=0.9,en;q=0.8', ['es', 'en', 'it'])).toBe('it')
    expect(idiomaDeCabecera('it-IT', ['es'])).toBeNull()
  })

  it('una cookie que pide un idioma APAGADO se trata como si no hubiera cookie', () => {
    expect(resolverIdioma({ cookie: 'it', cabecera: 'en-US', permitidos: ['es', 'en'] })).toBe('en')
    expect(resolverIdioma({ cookie: 'it', cabecera: null, permitidos: ['es', 'en'] })).toBe('es')
    expect(resolverIdioma({ cookie: 'en', cabecera: 'it-IT', permitidos: ['es', 'it'] })).toBe('it')
  })

  it('encendido, la cookie italiana manda igual que cualquier otra', () => {
    expect(resolverIdioma({ cookie: 'it', cabecera: 'en-US', permitidos: ['es', 'en', 'it'] })).toBe('it')
    expect(resolverIdioma({ cookie: 'es', cabecera: 'it-IT', permitidos: ['es', 'it'] })).toBe('es')
  })

  it('el espanol nunca se puede apagar: es el destino de cualquier duda', () => {
    expect(resolverIdioma({ cookie: 'es', cabecera: null, permitidos: [] })).toBe('es')
  })
})

// ============================================================================
//  Lote L5 (2026-11-03) · el valor por omision de `permitidos`. Lo sugirio el
//  validador de la ola 0: un llamador que olvide pasar la lista no puede dejar
//  pasar un italiano APAGADO. El espanol y el ingles se comportan como antes
//  (el ingles lo filtra quien decide, que siempre pasa la lista).
// ============================================================================
describe('por omision, un italiano apagado no se acepta', () => {
  let antes: string | undefined
  beforeEach(() => {
    antes = process.env.IDIOMA_ITALIANO
    delete process.env.IDIOMA_ITALIANO
  })
  afterEach(() => {
    if (antes === undefined) delete process.env.IDIOMA_ITALIANO
    else process.env.IDIOMA_ITALIANO = antes
  })

  it('apagado: ni la cookie, ni la cabecera, ni normalizar', () => {
    expect(normalizarIdioma('it')).toBeNull()
    expect(idiomaDeCabecera('it-IT,it;q=0.9,en;q=0.8')).toBe('en')
    expect(resolverIdioma({ cookie: 'it', cabecera: null })).toBe('es')
  })

  it('encendido: si', () => {
    process.env.IDIOMA_ITALIANO = '1'
    expect(normalizarIdioma('it')).toBe('it')
    expect(idiomaDeCabecera('it-IT,en;q=0.8')).toBe('it')
    expect(resolverIdioma({ cookie: 'it', cabecera: null })).toBe('it')
  })

  it('el espanol y el ingles, como antes, aunque el ingles este apagado', () => {
    const ingles = process.env.IDIOMA_INGLES
    delete process.env.IDIOMA_INGLES
    try {
      expect(normalizarIdioma('en-US')).toBe('en')
      expect(normalizarIdioma('es-MX')).toBe('es')
      expect(idiomaDeCabecera('en-US,es;q=0.5')).toBe('en')
      expect(resolverIdioma({ cookie: 'en', cabecera: null })).toBe('en')
    } finally {
      if (ingles !== undefined) process.env.IDIOMA_INGLES = ingles
    }
  })
})
