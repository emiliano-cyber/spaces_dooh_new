import { describe, it, expect } from 'vitest'
import { disponibilidad } from './derive'
import type { DemoState } from './types'

// ============================================================================
//  Disponibilidad: cuántos slots le QUEDAN a una pantalla digital (06/10).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «en pantallas digitales, las que quedan disponibles». La
//  celda decía `3/10` (usados de total) y había que restar de cabeza. Y el
//  filtro «Solo con hueco libre» solo contaba los periodos LIBRES del todo: una
//  digital con 7 de 10 slots libres desaparecía, justo la que se puede vender.
// ============================================================================

const DESDE = '2026-11-01'

function estado(over: Partial<DemoState>): DemoState {
  return { sitios: [], reservas: [], campanas: [], ...over } as unknown as DemoState
}

const digital = (id: string, totalSpots: number | null) => ({
  id, nombre: id, claveInterna: id, tipoMedio: 'PANTALLA_DIGITAL', totalSpots,
})
const estatica = (id: string) => ({ id, nombre: id, claveInterna: id, tipoMedio: 'ESPECTACULAR', totalSpots: null })
const reserva = (sitioId: string, spots: number | null, estatus = 'CONFIRMADA') => ({
  id: `r-${sitioId}-${Math.random()}`, sitioId, campanaId: 'c1', estatus,
  fechaInicio: '2026-11-03T00:00:00', fechaFin: '2026-11-10T00:00:00', spotsReservados: spots,
})

const unMes = (s: DemoState) => disponibilidad(s, { desde: DESDE, periodos: 1, gran: 'mes' })

describe('disponibilidad — slots libres de las digitales', () => {
  it('una digital con 3 de 10 slots usados deja 7 libres', () => {
    const d = unMes(estado({ sitios: [digital('d1', 10)] as any, reservas: [reserva('d1', 3)] as any }))
    expect(d.filas[0].celdas[0]).toMatchObject({ estado: 'PARCIAL', spotsUsados: 3, spotsLibres: 7 })
  })

  it('una digital sin reservas tiene todos sus slots libres', () => {
    const d = unMes(estado({ sitios: [digital('d1', 10)] as any }))
    expect(d.filas[0].celdas[0]).toMatchObject({ estado: 'LIBRE', spotsLibres: 10 })
  })

  it('la reserva sin spots explícitos ocupa 1 slot; nunca queda en negativo', () => {
    const d = unMes(estado({
      sitios: [digital('d1', 2)] as any,
      reservas: [reserva('d1', null), reserva('d1', 5)] as any,
    }))
    expect(d.filas[0].celdas[0]).toMatchObject({ estado: 'OCUPADO', spotsUsados: 6, spotsLibres: 0 })
  })

  it('las canceladas no restan slots', () => {
    const d = unMes(estado({
      sitios: [digital('d1', 10)] as any,
      reservas: [reserva('d1', 4, 'CANCELADA'), reserva('d1', 1, 'TENTATIVA')] as any,
    }))
    expect(d.filas[0].celdas[0].spotsLibres).toBe(9)
  })

  it('sin capacidad declarada no se inventa cuántos quedan', () => {
    const d = unMes(estado({ sitios: [digital('d1', null)] as any, reservas: [reserva('d1', 2)] as any }))
    expect(d.filas[0].celdas[0].spotsLibres).toBeNull()
  })

  it('una estática no tiene slots', () => {
    const d = unMes(estado({ sitios: [estatica('e1')] as any }))
    expect(d.filas[0].celdas[0].spotsLibres).toBeNull()
  })
})

describe('disponibilidad — «Solo con hueco libre»', () => {
  const s = estado({
    sitios: [digital('parcial', 10), digital('llena', 2), estatica('ocupada'), estatica('libre')] as any,
    reservas: [reserva('parcial', 3), reserva('llena', 2), reserva('ocupada', null)] as any,
  })
  const ids = (soloDisponibles: boolean) =>
    disponibilidad(s, { desde: DESDE, periodos: 1, gran: 'mes', soloDisponibles }).filas.map((f) => f.sitioId)

  it('deja la digital con slots libres aunque no esté libre del todo', () => {
    expect(ids(true)).toEqual(['parcial', 'libre'])
  })

  it('sin el filtro salen todas', () => {
    expect(ids(false)).toHaveLength(4)
  })

  it('cada fila cuenta los periodos con hueco', () => {
    const f = disponibilidad(s, { desde: DESDE, periodos: 1, gran: 'mes' }).filas
    expect(Object.fromEntries(f.map((x) => [x.sitioId, x.conHueco]))).toEqual({ parcial: 1, llena: 0, ocupada: 0, libre: 1 })
  })
})
