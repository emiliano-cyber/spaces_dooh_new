import { describe, it, expect } from 'vitest'
import type { Campana, Propuesta } from '@/lib/data/types'
import {
  propuestasDelCliente,
  campanasDelCliente,
  etapaDeCampana,
  pipelineCliente,
} from './cliente-pipeline'

// Solo los campos que miran estas funciones; el resto da igual y se rellena
// con un cast para no arrastrar los cuarenta campos de la propuesta.
function prop(p: Partial<Propuesta> & { id: string }): Propuesta {
  return { clienteId: null, agenciaId: null, estatus: 'BORRADOR', total: 0, fecha: '2026-10-01', ...p } as Propuesta
}
function camp(c: Partial<Campana> & { id: string }): Campana {
  return {
    clienteId: 'cli-a',
    propuestaId: null,
    estadoComercial: 'ACTIVA',
    presupuestoBruto: null,
    fechaInicio: '2026-10-01',
    fechaFin: '2026-10-31',
    ...c,
  } as Campana
}

describe('propuestasDelCliente', () => {
  it('toma las del cliente y las que arma como agencia, y NINGUNA de otro', () => {
    const props = [
      prop({ id: 'p1', clienteId: 'cli-a' }),
      prop({ id: 'p2', clienteId: 'cli-b', agenciaId: 'cli-a' }),
      prop({ id: 'p3', clienteId: 'cli-b' }),
      prop({ id: 'p4', clienteId: null, agenciaId: null }),
    ]
    expect(propuestasDelCliente(props, 'cli-a').map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(propuestasDelCliente(props, 'cli-b').map((p) => p.id)).toEqual(['p2', 'p3'])
  })
})

describe('campanasDelCliente', () => {
  it('filtra por cliente y ordena de la mas reciente a la mas vieja', () => {
    const cs = [
      camp({ id: 'c1', fechaInicio: '2026-01-01' }),
      camp({ id: 'c2', clienteId: 'cli-b' }),
      camp({ id: 'c3', fechaInicio: '2026-09-01' }),
    ]
    expect(campanasDelCliente(cs, 'cli-a').map((c) => c.id)).toEqual(['c3', 'c1'])
  })

  it('incluye la campana de otro cliente si nacio de una propuesta que la agencia armo', () => {
    const props = [prop({ id: 'p2', clienteId: 'cli-b', agenciaId: 'cli-a' })]
    const cs = [camp({ id: 'c9', clienteId: 'cli-b', propuestaId: 'p2' }), camp({ id: 'c8', clienteId: 'cli-b' })]
    expect(campanasDelCliente(cs, 'cli-a', props).map((c) => c.id)).toEqual(['c9'])
  })
})

describe('etapaDeCampana', () => {
  it('reparte los siete estados comerciales en en curso, terminada y cancelada', () => {
    expect(etapaDeCampana(camp({ id: 'x', estadoComercial: 'DRAFT' }))).toBe('EN_CURSO')
    expect(etapaDeCampana(camp({ id: 'x', estadoComercial: 'COTIZACION' }))).toBe('EN_CURSO')
    expect(etapaDeCampana(camp({ id: 'x', estadoComercial: 'CONFIRMADA' }))).toBe('EN_CURSO')
    expect(etapaDeCampana(camp({ id: 'x', estadoComercial: 'ACTIVA' }))).toBe('EN_CURSO')
    expect(etapaDeCampana(camp({ id: 'x', estadoComercial: 'COMPLETADA' }))).toBe('TERMINADA')
    expect(etapaDeCampana(camp({ id: 'x', estadoComercial: 'LISTA_FACTURAR' }))).toBe('TERMINADA')
    expect(etapaDeCampana(camp({ id: 'x', estadoComercial: 'CANCELADA' }))).toBe('CANCELADA')
  })
})

describe('pipelineCliente', () => {
  const props = [
    prop({ id: 'b1', clienteId: 'cli-a', estatus: 'BORRADOR', total: 100 }),
    prop({ id: 'e1', clienteId: 'cli-a', estatus: 'ENVIADA', total: 200 }),
    prop({ id: 'e2', clienteId: 'cli-a', estatus: 'ENVIADA', total: 50 }),
    // Aprobada que YA es campana: no debe contarse dos veces.
    prop({ id: 'a1', clienteId: 'cli-a', estatus: 'APROBADA', total: 1000 }),
    // Aprobada que todavia no genera su campana.
    prop({ id: 'a2', clienteId: 'cli-a', estatus: 'APROBADA', total: 300 }),
    prop({ id: 'r1', clienteId: 'cli-a', estatus: 'RECHAZADA', total: 70 }),
    // De otro cliente: no debe aparecer en ninguna cifra.
    prop({ id: 'z1', clienteId: 'cli-z', estatus: 'ENVIADA', total: 99999 }),
  ]
  const cs = [
    camp({ id: 'c1', propuestaId: 'a1', estadoComercial: 'ACTIVA', presupuestoBruto: 1160 }),
    camp({ id: 'c2', estadoComercial: 'COMPLETADA', presupuestoBruto: 500 }),
    camp({ id: 'c3', estadoComercial: 'LISTA_FACTURAR', presupuestoBruto: null }),
    camp({ id: 'c4', estadoComercial: 'CANCELADA', presupuestoBruto: 40 }),
    camp({ id: 'c5', clienteId: 'cli-z', estadoComercial: 'ACTIVA', presupuestoBruto: 88888 }),
  ]
  const p = pipelineCliente('cli-a', props, cs)

  it('pone las cinco columnas en el orden del embudo', () => {
    expect(p.columnas.map((c) => c.etapa)).toEqual(['BORRADOR', 'ENVIADA', 'APROBADA', 'EN_CURSO', 'TERMINADA'])
  })

  it('cuenta y suma cada columna sin mezclar clientes', () => {
    const por = Object.fromEntries(p.columnas.map((c) => [c.etapa, [c.n, c.monto]]))
    expect(por.BORRADOR).toEqual([1, 100])
    expect(por.ENVIADA).toEqual([2, 250])
    // Solo a2: a1 ya es la campana c1 y se cuenta alli.
    expect(por.APROBADA).toEqual([1, 300])
    expect(por.EN_CURSO).toEqual([1, 1160])
    // Una campana sin presupuesto cuenta como una, y suma cero.
    expect(por.TERMINADA).toEqual([2, 500])
  })

  it('aparta lo que salio del embudo: rechazadas y canceladas', () => {
    expect(p.rechazadas).toEqual({ n: 1, monto: 70 })
    expect(p.canceladas).toEqual({ n: 1, monto: 40 })
  })

  it('el valor abierto es borrador + enviada, igual que el funnel de Propuestas', () => {
    expect(p.valorAbierto).toBe(350)
  })

  it('win rate sobre las propuestas cerradas; null si no hay ninguna cerrada', () => {
    // 2 aprobadas / (2 aprobadas + 1 rechazada)
    expect(p.winRate).toBeCloseTo(2 / 3)
    expect(pipelineCliente('cli-a', [prop({ id: 'b', clienteId: 'cli-a' })], []).winRate).toBeNull()
  })

  it('un cliente sin nada da todas las columnas en cero, no una lista vacia', () => {
    const vacio = pipelineCliente('cli-nadie', props, cs)
    expect(vacio.columnas).toHaveLength(5)
    expect(vacio.columnas.every((c) => c.n === 0 && c.monto === 0)).toBe(true)
    expect(vacio.total).toBe(0)
  })

  it('total cuenta propuestas + campanas del cliente', () => {
    expect(p.total).toBe(6 + 4)
  })
})
