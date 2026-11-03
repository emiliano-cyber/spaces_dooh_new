import { describe, it, expect } from 'vitest'
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
    expect(normalizarIdioma('it')).toBe('it')
    expect(normalizarIdioma('it-IT')).toBe('it')
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
