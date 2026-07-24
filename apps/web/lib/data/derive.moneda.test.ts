import { describe, it, expect } from 'vitest'
import { totalizarMoneda, dashboardMetrics } from './derive'

// ============================================================================
//  A-3 · Moneda del tenant. `totalizarMoneda` NO suma 1:1 cuando hay más de una
//  divisa (eso mezclaría soles con pesos): devuelve el desglose por moneda y
//  marca el caso. `dashboardMetrics` expone `moneda`/`monedasMixtas` + desgloses.
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
const MANANA = '2999-12-31'
const cob = (id: string, facturaId: string, montoPagado = 0) => ({
  id, facturaId, plazoDias: 60, fechaVencimiento: MANANA, estatus: 'AL_CORRIENTE',
  montoPagado, recordatorioEn: null, recordatoriosEnviados: 0, creadoEn: '2026-01-01',
})

describe('A-3 · totalizarMoneda', () => {
  it('moneda única → total escalar', () => {
    const r = totalizarMoneda([{ monto: 100, moneda: 'MXN' }, { monto: 50, moneda: 'MXN' }])
    expect(r.mixto).toBe(false)
    expect(r.moneda).toBe('MXN')
    expect(r.total).toBe(150)
    expect(r.porMoneda).toEqual({ MXN: 150 })
  })

  it('monedas mixtas → NO suma 1:1 (total null + desglose por moneda)', () => {
    const r = totalizarMoneda([{ monto: 1160, moneda: 'MXN' }, { monto: 580, moneda: 'USD' }])
    expect(r.mixto).toBe(true)
    expect(r.moneda).toBeNull()
    expect(r.total).toBeNull() // clave: NO es 1740 (no se suman divisas distintas)
    expect(r.porMoneda).toEqual({ MXN: 1160, USD: 580 })
  })
})

describe('A-3 · dashboardMetrics moneda', () => {
  it('detecta monedas mixtas y separa P&L / por-cobrar por moneda', () => {
    const st = baseState({
      campanas: [{ id: 'cA', moneda: 'MXN' }, { id: 'cB', moneda: 'USD' }],
      reservas: [
        { id: 'rA', campanaId: 'cA', sitioId: 's', precio: 1000, estatus: 'CONFIRMADA' },
        { id: 'rB', campanaId: 'cB', sitioId: 's', precio: 500, estatus: 'CONFIRMADA' },
      ],
      facturas: [
        { id: 'fA', moneda: 'MXN', monto: 1160 },
        { id: 'fB', moneda: 'USD', monto: 580 },
      ],
      cobranzas: [cob('coA', 'fA'), cob('coB', 'fB')],
    })
    const m = dashboardMetrics(st)
    expect(m.monedasMixtas).toBe(true)
    expect(m.moneda).toBeNull()
    expect(m.ingresoPorMoneda).toEqual({ MXN: 1000, USD: 500 })
    expect(m.porCobrarPorMoneda).toEqual({ MXN: 1160, USD: 580 })
  })

  it('moneda única → no mixto, moneda definida', () => {
    const st = baseState({
      campanas: [{ id: 'cA', moneda: 'MXN' }],
      reservas: [{ id: 'rA', campanaId: 'cA', sitioId: 's', precio: 1000, estatus: 'CONFIRMADA' }],
      facturas: [{ id: 'fA', moneda: 'MXN', monto: 1160 }],
      cobranzas: [cob('coA', 'fA')],
    })
    const m = dashboardMetrics(st)
    expect(m.monedasMixtas).toBe(false)
    expect(m.moneda).toBe('MXN')
    expect(m.porCobrarPorMoneda).toEqual({ MXN: 1160 })
  })
})
