import { describe, it, expect } from 'vitest'
import { disponibilidad } from './derive'
import type { DemoState } from './types'

// ============================================================================
//  TENT-PROP (26/10) · La rejilla de Disponibilidad avisa qué está «en veremos»
//  en una propuesta abierta, SIN cambiar si la celda está libre u ocupada:
//  regla del dueño, lo tentativo solo avisa (ver `lib/data/en-propuesta.ts`).
// ============================================================================

const fija = (id: string) => ({ id, nombre: id, claveInterna: id, tipoMedio: 'ESPECTACULAR', totalSpots: null })
const prop = (id: string, estatus: string, sitioId: string, fi: string, ff: string) => ({
  id, folio: `PR-${id}`, estatus, clienteId: 'K1',
  items: [{ sitioId, fechaInicio: fi, fechaFin: ff, spotsPorDia: null }],
})
const estado = (over: Partial<DemoState>): DemoState =>
  ({ sitios: [], reservas: [], campanas: [], propuestas: [], clientes: [{ id: 'K1', nombre: 'Refrescos SA' }], ...over }) as unknown as DemoState
const unMes = (s: DemoState) => disponibilidad(s, { desde: '2026-11-01', periodos: 1, gran: 'mes' })

describe('disponibilidad — lo que está en propuesta', () => {
  it('una fija libre que está en una propuesta ENVIADA sigue LIBRE, con el aviso de quién la pide', () => {
    const d = unMes(estado({ sitios: [fija('S1')] as any, propuestas: [prop('1', 'ENVIADA', 'S1', '2026-11-05', '2026-11-20')] as any }))
    const c = d.filas[0].celdas[0]
    expect(c.estado).toBe('LIBRE')
    expect(c.enPropuesta.map((x) => [x.folio, x.clienteNombre])).toEqual([['PR-1', 'Refrescos SA']])
    expect(d.filas[0].libres).toBe(1)
  })

  it('NEGATIVO · una propuesta APROBADA no es tentativa (ya es campaña)', () => {
    const d = unMes(estado({ sitios: [fija('S1')] as any, propuestas: [prop('1', 'APROBADA', 'S1', '2026-11-05', '2026-11-20')] as any }))
    expect(d.filas[0].celdas[0].enPropuesta).toEqual([])
  })

  it('una ocupada por una campaña confirmada que además está en propuesta: OCUPADO y con el aviso', () => {
    const d = unMes(
      estado({
        sitios: [fija('S1')] as any,
        reservas: [{ id: 'r1', sitioId: 'S1', campanaId: 'c1', estatus: 'CONFIRMADA', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', spotsReservados: null }] as any,
        propuestas: [prop('2', 'BORRADOR', 'S1', '2026-11-10', '2026-11-12')] as any,
      }),
    )
    const c = d.filas[0].celdas[0]
    expect(c.estado).toBe('OCUPADO')
    expect(c.enPropuesta.map((x) => x.folio)).toEqual(['PR-2'])
  })

  it('sin propuestas cargadas (rol sin comercial) no truena: lista vacía', () => {
    const d = unMes({ sitios: [fija('S1')], reservas: [], campanas: [] } as unknown as DemoState)
    expect(d.filas[0].celdas[0].enPropuesta).toEqual([])
  })
})
