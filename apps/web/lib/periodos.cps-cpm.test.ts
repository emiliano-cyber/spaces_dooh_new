import { describe, it, expect } from 'vitest'
import {
  UNIDADES,
  UNIDAD_LABEL,
  cantidadEfectiva,
  esCantidadManual,
  etiquetaCantidad,
  fechaFinDesde,
  periodosEnRango,
  precioItem,
  resumenContratacion,
} from './periodos'

// ============================================================================
//  CPS-CPM (07/10) · cómo se llaman y cómo se cuentan las dos unidades que pidió
//  ventas: CPS (costo por salida) y CPM (costo por millar).
// ----------------------------------------------------------------------------
//  CPS NO es una unidad nueva: es «Por spot» con el nombre que usa el equipo
//  comercial. La clave en la base sigue siendo `spot`, así que ninguna
//  propuesta, reserva ni tarifa capturada cambia de significado.
//
//  CPM sí es nueva, y su cantidad son MILLARES de impactos, no impactos. Así el
//  importe sigue siendo `tarifa × cantidad` —la regla que asumen el volumen, el
//  snapshot, el PDF y la reserva— sin una división escondida en un solo sitio:
//  85 por millar × 2 500 millares (2.5 millones de impactos) = 212 500.
// ============================================================================

describe('CPS · «Por spot» con el nombre de ventas', () => {
  it('se llama CPS y sus unidades son salidas', () => {
    expect(UNIDAD_LABEL.spot).toBe('CPS · costo por salida')
    expect(etiquetaCantidad('spot', 1)).toBe('1 salida')
    expect(etiquetaCantidad('spot', 50)).toBe('50 salidas')
  })

  it('el precio no cambia: tarifa por salida × salidas', () => {
    expect(resumenContratacion({ unidad: 'spot', cantidad: 50, tarifaUnitaria: 1200 })).toBe('50 salidas × $ 1,200.00')
    expect(precioItem(1200, 50)).toBe(60000)
  })

  it('la clave sigue siendo `spot`: no aparece una unidad «cps»', () => {
    expect(UNIDADES.some((u) => (u.unidad as string) === 'cps')).toBe(false)
    expect(UNIDADES.some((u) => u.unidad === 'spot')).toBe(true)
  })
})

describe('CPM · costo por millar', () => {
  it('existe y se llama CPM', () => {
    expect(UNIDAD_LABEL.cpm).toBe('CPM · costo por millar')
  })

  it('su cantidad son millares, en singular y plural', () => {
    expect(etiquetaCantidad('cpm', 1)).toBe('1 millar')
    expect(etiquetaCantidad('cpm', 2500)).toBe('2,500 millares')
  })

  it('el importe es tarifa CPM × millares', () => {
    expect(precioItem(85, 2500)).toBe(212500)
    expect(resumenContratacion({ unidad: 'cpm', cantidad: 2500, tarifaUnitaria: 85 })).toBe('2,500 millares × $ 85.00')
  })

  it('NO se deriva de las fechas: la cantidad la captura quien vende', () => {
    // Si se derivara del rango, un mes de campaña valdría «30 millares» y el
    // importe saldría de los días y no de la audiencia contratada.
    expect(periodosEnRango('cpm', '2026-11-01', '2026-11-30')).toBeNull()
    expect(cantidadEfectiva('cpm', '2026-11-01', '2026-11-30', 2500)).toBe(2500)
    expect(fechaFinDesde('2026-11-01', 'cpm', 3)).toBe('')
  })

  it('sin cantidad capturada vale 1 millar, igual que spot y hora', () => {
    expect(cantidadEfectiva('cpm', '2026-11-01', '2026-11-30', null)).toBe(1)
  })
})

describe('qué unidades llevan cantidad capturada a mano', () => {
  it('spot, hora y cpm; las de tiempo no', () => {
    expect(['spot', 'hora', 'cpm'].every((u) => esCantidadManual(u))).toBe(true)
    expect(['mensual', 'catorcenal', 'semanal', 'diaria'].some((u) => esCantidadManual(u))).toBe(false)
  })
})
