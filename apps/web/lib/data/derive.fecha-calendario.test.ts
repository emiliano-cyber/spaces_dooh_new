import { describe, it, expect } from 'vitest'
import { formatFecha, diasHasta } from './derive'

// ============================================================================
//  Fechas de CALENDARIO impresas en pantalla.
//
//  OJO: el fallo que cubre esto solo se manifiesta en una zona
//  con desplazamiento NEGATIVO respecto a UTC (México, UTC−6, que es donde corre
//  esto). En un CI en UTC, `new Date('2026-08-29')` ya cae en el día 29 y el
//  código viejo también pasaría. No se fuerza `process.env.TZ` a propósito:
//  cambiarlo en caliente no es fiable en Windows, que es donde se desarrolla.
//  La aserción sigue siendo la correcta —el día impreso es el que dice la
//  cadena, en cualquier zona— y en la máquina donde el bug existía, falla.
// ============================================================================

describe('formatFecha — fecha de calendario "YYYY-MM-DD"', () => {
  // `pagos_renta.periodo` es una columna `text` y viaja literal. Pasarla por
  // `new Date()` la leía como medianoche UTC y en México retrocedía un día: el
  // vencimiento del 29/08 se pintaba 28/08.
  it('imprime el mismo día que dice la cadena', () => {
    expect(formatFecha('2026-08-29')).toBe('29/08/2026')
    expect(formatFecha('2027-03-01')).toBe('01/03/2027')
    expect(formatFecha('2028-02-29')).toBe('29/02/2028')
  })

  it('no se corre en el primer día del mes ni del año', () => {
    expect(formatFecha('2027-01-01')).toBe('01/01/2027')
    expect(formatFecha('2026-12-01')).toBe('01/12/2026')
  })

  // El bug se veía porque estas dos funciones se contradecían en la MISMA celda
  // ("28/08/2026 en 29 días"): `diasHasta` ya resolvía la trampa y `formatFecha`
  // no. Que coincidan es la propiedad que hay que conservar.
  it('coincide con diasHasta sobre el mismo dato', () => {
    const hoy = new Date()
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    expect(diasHasta(iso)).toBe(0)
    expect(formatFecha(iso)).toBe(
      `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`,
    )
  })
})

describe('formatFecha — instantes con hora', () => {
  // `pausa_legal_en`, `recordatorio_en` y `fecha_programada` son `timestamptz`:
  // ahí el día correcto es el LOCAL, no el UTC, y esa rama no debe cambiar.
  it('usa el día local de un timestamp, no el UTC', () => {
    const d = new Date(2026, 7, 29, 15, 30) // 29/08/2026 15:30 hora local
    expect(formatFecha(d.toISOString())).toBe('29/08/2026')
  })

  it('una columna `date` que el driver resolvió a medianoche local se pinta igual', () => {
    const d = new Date(2028, 2, 1) // 01/03/2028 00:00 hora local
    expect(formatFecha(d.toISOString())).toBe('01/03/2028')
  })
})
