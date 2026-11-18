import { describe, it, expect, afterEach } from 'vitest'
import { IDIOMAS } from './idiomas'
import { FORMATO_IDIOMA, localeDe, numeroEnIdioma, opcionesNumero, porcentajeEnIdioma } from './formato-idioma'
import {
  formatearDinero,
  formatearDineroRedondo,
  formatearNumero,
  formatearFecha,
  simboloMoneda,
  nombreMoneda,
  fijarMonedaInstancia,
  LOCALE_DE_IDIOMA,
} from './dinero'
import { leerDinero } from './simbolo-en-pantalla'

// ============================================================================
//  Ola 0 del italiano (2026-11-03) · el formato italiano, y que es y en NO se
//  muevan. Decision del dueno: «MX$ 1.160,00» y «1 dic 2026».
// ============================================================================

afterEach(() => fijarMonedaInstancia('MXN'))

describe('FORMATO_IDIOMA · una fila por idioma', () => {
  it('cubre exactamente el catalogo', () => {
    expect(Object.keys(FORMATO_IDIOMA).sort()).toEqual([...IDIOMAS].sort())
  })
  it('los locales: es-MX, en-US, it-IT, pt-BR, y LOCALE_DE_IDIOMA sale de aqui', () => {
    expect(IDIOMAS.map(localeDe)).toEqual(['es-MX', 'en-US', 'it-IT', 'pt-BR'])
    for (const i of IDIOMAS) expect(LOCALE_DE_IDIOMA[i]).toBe(localeDe(i))
  })
})

describe('el dinero en italiano', () => {
  it('MXN: el simbolo delante, con espacio, y separadores italianos', () => {
    expect(formatearDinero(1160, 'it')).toBe('MX$ 1.160,00')
    expect(formatearDinero(1234567.5, 'it')).toBe('MX$ 1.234.567,50')
    expect(formatearDinero(0, 'it')).toBe('MX$ 0,00')
    expect(formatearDinero(5, 'it')).toBe('MX$ 5,00')
  })
  it('el signo va delante del simbolo, como en es y en', () => {
    expect(formatearDinero(-1160, 'it')).toBe('-MX$ 1.160,00')
    expect(formatearDinero(-1160, 'en')).toBe('-MX$1,160.00')
    expect(formatearDinero(-1160, 'es')).toBe('-$1,160.00')
  })
  it('redondo: sin decimales', () => {
    expect(formatearDineroRedondo(1160.4, 'it')).toBe('MX$ 1.160')
  })
  it('USD (provisional, pendiente del dueno): US$ delante', () => {
    fijarMonedaInstancia('USD')
    expect(formatearDinero(1160, 'it')).toBe('US$ 1.160,00')
    expect(simboloMoneda('it')).toBe('US$')
  })
  it('sin numero, el guion de siempre', () => {
    expect(formatearDinero(Number.NaN, 'it')).toBe('—')
  })
  it('el nombre de la moneda', () => {
    expect(nombreMoneda('it', 'MXN')).toBe('Peso messicano (MXN)')
    expect(nombreMoneda('it', 'USD')).toBe('Dollaro statunitense (USD)')
  })
  it('la guardia de simbolos de las pruebas de pantallas espera MX$ en italiano', () => {
    expect(leerDinero('<b>MX$ 1.160,00</b>', 'it', 'MXN').ajenos).toEqual([])
    expect(leerDinero('<b>$ 1.160,00</b>', 'it', 'MXN').ajenos).toHaveLength(1)
  })
})

describe('numeros, porcentajes y fechas en italiano', () => {
  it('agrupa tambien los de cuatro cifras (CLDR no lo hace en it-IT)', () => {
    expect(formatearNumero(1160, 'it')).toBe('1.160')
    expect(formatearNumero(1160.5, 'it')).toBe('1.160,5')
    expect(numeroEnIdioma(12345.67, 'it', { maximumFractionDigits: 1 })).toBe('12.345,7')
  })
  it('opcionesNumero no toca es ni en (el mismo objeto)', () => {
    const o = { maximumFractionDigits: 2 }
    expect(opcionesNumero('es', o)).toBe(o)
    expect(opcionesNumero('en', o)).toBe(o)
    expect(opcionesNumero('it', { useGrouping: false }).useGrouping).toBe(false)
  })
  it('el porcentaje', () => {
    expect(porcentajeEnIdioma('12.5', 'es')).toBe('12.5 %')
    expect(porcentajeEnIdioma('12.5', 'en')).toBe('12.5%')
    expect(porcentajeEnIdioma('12,5', 'it')).toBe('12,5%')
  })
  it('la fecha por omision: «1 dic 2026», sin cero delante', () => {
    expect(formatearFecha('2026-12-01T12:00:00Z', 'it')).toBe('1 dic 2026')
    // es y en con su forma de siempre
    expect(formatearFecha('2026-12-01T12:00:00Z', 'es')).toBe('01 dic 2026')
    expect(formatearFecha('2026-12-01T12:00:00Z', 'en')).toBe('Dec 01, 2026')
  })
})
