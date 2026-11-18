import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatMonto, formatMontoCorto, formatFecha, formatFechaHora, etiquetaBucket } from '../data/derive'
import { formatNumero } from '../formato-numero'
import { etiquetaPeriodo } from '../finanzas-periodo'
import { etiquetaCantidad } from '../periodos'
import { formatoPorcentaje, formatoCelda } from '../../components/demo/reportes/tabla'
import { etiquetaDeMes } from '../../components/demo/energia/captura'
import { haceSinPrefijo } from '../../components/demo/space-eyes/piezas'

// ============================================================================
//  Ola 0 del italiano (2026-11-03) · LOS SITIOS QUE ERAN BINARIOS.
// ----------------------------------------------------------------------------
//  Antes de hoy, estas funciones decidian con `idioma === 'en'` (y el italiano
//  caia en la rama ESPANOLA: «01/12/2026») o con `'es-MX'` fijo (y el
//  italiano salia «1,160.00»). Cada una se fija aqui en italiano; que es y en
//  no se movieron lo mide el volcado completo (`lib/test/volcado-html.ts`) y
//  sus propias pruebas de siempre.
// ============================================================================

describe('dinero y cifras', () => {
  it('formatMonto: «MX$ 1.160,00», y los negativos entre parentesis como siempre', () => {
    expect(formatMonto(1160, 'it')).toBe('MX$ 1.160,00')
    expect(formatMonto(-1160, 'it')).toBe('(MX$ 1.160,00)')
    expect(formatMonto(1160, 'en')).toBe('MX$ 1,160.00')
    expect(formatMonto(1160)).toBe('$ 1,160.00')
  })
  it('formatMontoCorto', () => {
    expect(formatMontoCorto(4_897_500, 'it')).toBe('MX$ 4,9M')
    expect(formatMontoCorto(1_234_567_890, 'it')).toBe('MX$ 1.234,6M')
  })
  it('formatNumero con idioma, y sin el las cifras de siempre', () => {
    expect(formatNumero(6000, 0, 'it')).toBe('6.000')
    expect(formatNumero(6000)).toBe('6,000')
    expect(etiquetaCantidad('spot', 1500, 'it')).toMatch(/^1\.500 /)
  })
  it('porcentajes y celdas de reportes', () => {
    expect(formatoPorcentaje(55, 'it')).toBe('55,0%')
    expect(formatoPorcentaje(55, 'en')).toBe('55.0%')
    expect(formatoPorcentaje(55, 'es')).toBe('55.0 %')
    expect(formatoCelda(12345, 'entero', 'it')).toBe('12.345')
    expect(formatoCelda(1.5, 'horas', 'it')).toBe('1,5 h')
    expect(formatoCelda(1500, 'kwh', 'it')).toBe('1.500 kWh')
  })
})

describe('fechas', () => {
  it('formatFecha: «1 dic 2026», no «01/12/2026»', () => {
    expect(formatFecha('2026-12-01', 'it')).toBe('1 dic 2026')
    expect(formatFecha('2026-12-01', 'en')).toBe('Dec 1, 2026')
    expect(formatFecha('2026-12-01')).toBe('01/12/2026')
  })
  it('formatFechaHora en 24 horas', () => {
    expect(formatFechaHora('2026-12-01T15:45:00', 'it')).toBe('1 dic 2026, 15:45')
  })
  it('etiquetaBucket: trimestre, mes y semana', () => {
    const d = new Date(2026, 11, 7)
    expect(etiquetaBucket(d, 'trimestre', 'it')).toBe('T4 2026')
    expect(etiquetaBucket(d, 'trimestre', 'en')).toBe('Q4 2026')
    expect(etiquetaBucket(d, 'mes', 'it')).toBe('dic')
    expect(etiquetaBucket(d, 'semana', 'it')).toBe('7 dic')
  })
  it('etiquetaPeriodo: el mes en italiano, no en ingles', () => {
    expect(etiquetaPeriodo({ etiqueta: 'Noviembre 2026' }, 'it')).toBe('novembre 2026')
    expect(etiquetaPeriodo({ etiqueta: 'Noviembre 2026' }, 'en')).toBe('November 2026')
  })
  it('etiquetaDeMes (consumo de luz)', () => {
    expect(etiquetaDeMes('2026-12', 'it')).toBe('dic 2026')
  })
})

describe('Space Eyes · «hace»', () => {
  afterEach(() => vi.useRealTimers())
  it('haceSinPrefijo quita el « fa» italiano y, mientras caiga al ingles, el « ago»', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-01T12:30:00Z'))
    const t = haceSinPrefijo('2026-12-01T12:00:00Z', 'it')
    expect(t).not.toMatch(/ago|fa$|hace/)
    expect(t).toMatch(/30/)
  })
})
