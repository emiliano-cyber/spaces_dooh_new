import { describe, it, expect, afterEach } from 'vitest'
import { IDIOMAS } from './idiomas'
import { FORMATO_IDIOMA, localeDe, numeroEnIdioma, porcentajeEnIdioma } from './formato-idioma'
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
import { formatFecha, formatFechaHora, formatMonto, formatMontoCorto } from '../data/derive'
import { formatNumero } from '../formato-numero'
import { comaDecimal } from '../captura-cifra'

// ============================================================================
//  Ola 0 del portugues (2026-11-05) · el formato pt-BR, y que es/en/it NO se
//  muevan. Decision del dueno: el peso «MX$ 1.160,00» (simbolo delante con
//  espacio, separadores brasilenos), como el italiano; no se anade el real.
//  Fechas, cifras y porcentaje: PROPUESTA de esta ola (D4 del tablero).
// ============================================================================

afterEach(() => fijarMonedaInstancia('MXN'))

describe('FORMATO_IDIOMA · la fila del portugues', () => {
  it('cubre el catalogo y el locale es pt-BR', () => {
    expect(Object.keys(FORMATO_IDIOMA).sort()).toEqual([...IDIOMAS].sort())
    expect(IDIOMAS.map(localeDe)).toEqual(['es-MX', 'en-US', 'it-IT', 'pt-BR'])
    expect(LOCALE_DE_IDIOMA.pt).toBe('pt-BR')
  })
})

describe('el dinero en portugues', () => {
  it('MXN: «MX$ 1.160,00», simbolo delante con un espacio normal', () => {
    expect(formatearDinero(1160, 'pt')).toBe('MX$ 1.160,00')
    expect(formatearDinero(1234567.5, 'pt')).toBe('MX$ 1.234.567,50')
    expect(formatearDinero(0, 'pt')).toBe('MX$ 0,00')
    // Un espacio de los de siempre, no el U+00A0 que pone `Intl` en pt-BR: la
    // guardia y las pruebas comparan con el del italiano.
    expect(formatearDinero(5, 'pt').charCodeAt(3)).toBe(32)
  })
  it('el signo va delante del simbolo, como en es, en e it', () => {
    expect(formatearDinero(-1160, 'pt')).toBe('-MX$ 1.160,00')
    expect(formatMonto(-1160, 'pt')).toBe('(MX$ 1.160,00)')
  })
  it('redondo y corto', () => {
    expect(formatearDineroRedondo(1160.4, 'pt')).toBe('MX$ 1.160')
    expect(formatMontoCorto(1234, 'pt')).toBe('MX$ 1,2k')
  })
  it('USD (PROVISIONAL, pendiente del dueno): «US$ 1.160,00»', () => {
    fijarMonedaInstancia('USD')
    expect(formatearDinero(1160, 'pt')).toBe('US$ 1.160,00')
    expect(simboloMoneda('pt')).toBe('US$')
  })
  it('sin numero, el guion de siempre', () => {
    expect(formatearDinero(Number.NaN, 'pt')).toBe('—')
  })
  it('el nombre de la moneda', () => {
    expect(nombreMoneda('pt', 'MXN')).toBe('Peso mexicano (MXN)')
    expect(nombreMoneda('pt', 'USD')).toBe('Dólar americano (USD)')
  })
  it('la guardia de simbolos de las pruebas de pantallas espera MX$ en portugues', () => {
    expect(leerDinero('<b>MX$ 1.160,00</b>', 'pt', 'MXN').ajenos).toEqual([])
    expect(leerDinero('<b>$ 1.160,00</b>', 'pt', 'MXN').ajenos).toHaveLength(1)
  })
})

describe('numeros, porcentajes y fechas en portugues', () => {
  it('punto de millar (tambien con cuatro cifras) y coma decimal', () => {
    expect(formatearNumero(1160, 'pt')).toBe('1.160')
    expect(formatearNumero(1160.5, 'pt')).toBe('1.160,5')
    expect(numeroEnIdioma(12345.67, 'pt', { maximumFractionDigits: 1 })).toBe('12.345,7')
    expect(formatNumero(1160, 0, 'pt')).toBe('1.160')
  })
  it('el porcentaje, pegado: «55,0%»', () => {
    expect(porcentajeEnIdioma('55,0', 'pt')).toBe('55,0%')
  })
  it('la fecha por omision: «1 de dez. de 2026», la forma corta de pt-BR', () => {
    expect(formatearFecha('2026-12-01T12:00:00Z', 'pt')).toBe('1 de dez. de 2026')
    expect(formatFecha('2026-12-01', 'pt')).toBe('1 de dez. de 2026')
    expect(formatFechaHora('2026-12-01T15:45:00', 'pt')).toMatch(/^1 de dez\. de 2026,? 15:45$/)
  })
  it('es, en e it con su forma de siempre', () => {
    expect(formatearFecha('2026-12-01T12:00:00Z', 'es')).toBe('01 dic 2026')
    expect(formatearFecha('2026-12-01T12:00:00Z', 'en')).toBe('Dec 01, 2026')
    expect(formatearFecha('2026-12-01T12:00:00Z', 'it')).toBe('1 dic 2026')
    expect(formatearDinero(1160, 'it')).toBe('MX$ 1.160,00')
  })
  it('el trimestre «T1 2026» (provisional, lo confirma el lote de reportes)', () => {
    expect(FORMATO_IDIOMA.pt.letraTrimestre).toBe('T')
  })
})

describe('la captura de cifras en portugues: a la mexicana por ahora (pendiente del dueno)', () => {
  // Teclear «1.500,50» es una decision de DINERO (zona roja) que el dueno tomo
  // para el italiano el 04/11 (P-L2-1) y NO ha tomado para el portugues.
  // Mientras tanto, lo que falta del portugues cae al ESPANOL, cuyos avisos
  // dicen «la coma separa miles»: teclear a la brasilena los haria mentir.
  it('el portugues teclea punto decimal, como el espanol', () => {
    expect(FORMATO_IDIOMA.pt.separadorDecimal).toBe('.')
    expect(comaDecimal('pt')).toBe(false)
    expect(comaDecimal('it')).toBe(true)
  })
})
