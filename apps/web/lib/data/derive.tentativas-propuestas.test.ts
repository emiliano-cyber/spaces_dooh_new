import { describe, it, expect } from 'vitest'
import { dashboardMetrics } from './derive'

// ============================================================================
//  Inicio · «Tentativas» son las PROPUESTAS QUE AÚN NO SE CIERRAN (08/10).
//
//  Pedido del dueño: en la tarjeta de Inicio, lo tentativo es lo que está en
//  negociación —propuestas en borrador o enviadas—, no las reservas TENTATIVA,
//  que solo existen un rato entre apartar y confirmar y casi siempre valen 0.
//
//  Se suma el NETO de cada propuesta (lo que recibe el medio, sin IVA), porque
//  la barra de al lado, «Confirmadas», suma `reservas.precio`, que es ese mismo
//  neto repartido por pantalla. Con `total` (con IVA) las dos barras medirían
//  cosas distintas y la tentativa saldría un 16 % inflada.
// ============================================================================

function baseState(over: Record<string, unknown>): any {
  const vacio = {
    sitios: [], reservas: [], contratos: [], arrendadores: [], campanas: [],
    clientes: [], propuestas: [], ordenesCompra: [], ordenesImpresion: [],
    ordenesTrabajo: [], cobranzas: [], facturas: [], incidencias: [],
    pagosRenta: [], creatividades: [], evidencias: [], notificaciones: [],
    acciones: [], reservasTentativas: [],
  }
  return { ...vacio, ...over }
}

const prop = (id: string, estatus: string, neto: number) => ({ id, estatus, neto, total: neto * 1.16 })

describe('Inicio · tentativas = propuestas abiertas', () => {
  it('suma el neto de las propuestas en BORRADOR y ENVIADA, y las cuenta', () => {
    const m = dashboardMetrics(baseState({
      propuestas: [
        prop('P1', 'BORRADOR', 10000),
        prop('P2', 'ENVIADA', 25000),
        prop('P3', 'APROBADA', 90000),
        prop('P4', 'RECHAZADA', 70000),
      ],
    }))
    expect(m.valorTentativo).toBe(35000)
    expect(m.propuestasAbiertas).toBe(2)
  })

  it('una reserva TENTATIVA ya no cuenta como tentativa', () => {
    const m = dashboardMetrics(baseState({
      reservas: [{ id: 'R1', sitioId: 'S1', campanaId: 'C1', estatus: 'TENTATIVA', precio: 5000, fechaInicio: '2020-01-01', fechaFin: '2999-12-31' }],
    }))
    expect(m.valorTentativo).toBe(0)
    expect(m.propuestasAbiertas).toBe(0)
  })

  it('confirmadas sigue siendo la suma de las reservas CONFIRMADA', () => {
    const m = dashboardMetrics(baseState({
      propuestas: [prop('P1', 'ENVIADA', 1000)],
      reservas: [{ id: 'R1', sitioId: 'S1', campanaId: 'C1', estatus: 'CONFIRMADA', precio: 8000, fechaInicio: '2020-01-01', fechaFin: '2999-12-31' }],
    }))
    expect(m.valorConfirmado).toBe(8000)
    expect(m.valorTentativo).toBe(1000)
  })
})
