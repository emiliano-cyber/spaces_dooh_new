import { describe, it, expect } from 'vitest'
import { dashboardMetrics, saldoCobranza } from './derive'
import { repartirCuotas, INTERVALO_PERIODO, PERIODICIDAD_LABEL } from '../finanzas-calculo'

// ============================================================================
//  Cobro en parcialidades. Dos invariantes que sostienen la cartera:
//
//   1. Las cuotas SUMAN el total de la factura, al centavo. Si no, se cobra de
//      menos (o de más) sin que nadie lo note.
//   2. Lo "por cobrar" usa el importe de CADA CUOTA, no el de la factura. Con
//      12 mensualidades, usar el total multiplicaría la cartera por 12.
//
//  Ver docs/diseno-cobro-en-parcialidades.md
// ============================================================================

function baseState(over: Record<string, unknown>): any {
  const vacio = {
    sitios: [], reservas: [], contratos: [], arrendadores: [], campanas: [],
    clientes: [], propuestas: [], ordenesCompra: [], ordenesImpresion: [],
    ordenesTrabajo: [], cobranzas: [], facturas: [], incidencias: [],
    pagosRenta: [], creatividades: [], evidencias: [], notificaciones: [],
    acciones: [], reservasTentativas: [], predios: [], sitiosRed: [],
  }
  return { ...vacio, ...over }
}

const MANANA = '2999-12-31'

describe('repartirCuotas — las cuotas cuadran al centavo', () => {
  it('divide exacto cuando el total es divisible', () => {
    const c = repartirCuotas(120000, 12)
    expect(c).toHaveLength(12)
    expect(c.every((x) => x === 10000)).toBe(true)
  })

  it('mete el residuo en la última cuota, sin perder centavos', () => {
    const c = repartirCuotas(100, 3)
    // 33.33 × 3 = 99.99: el centavo que falta va a la última.
    expect(c.slice(0, 2)).toEqual([33.33, 33.33])
    expect(Math.round(c.reduce((a, x) => a + x, 0) * 100) / 100).toBe(100)
  })

  it('cuadra con importes reales de campaña y varios repartos', () => {
    for (const total of [835200, 720000, 420000, 99999.99, 1234.56, 0.03]) {
      for (const n of [2, 3, 6, 7, 12, 24]) {
        const suma = Math.round(repartirCuotas(total, n).reduce((a, x) => a + x, 0) * 100) / 100
        expect(suma, `total ${total} en ${n} cuotas`).toBe(total)
      }
    }
  })

  it('nunca genera una cuota negativa', () => {
    for (const n of [2, 5, 12]) {
      expect(repartirCuotas(1000, n).every((x) => x > 0)).toBe(true)
    }
  })
})

describe('saldoCobranza — de dónde sale el importe a cobrar', () => {
  const factura = { monto: 120000 }

  it('una parcialidad usa SU importe, no el de la factura', () => {
    expect(saldoCobranza({ monto: 10000, montoPagado: 0 }, factura)).toBe(10000)
  })

  it('descuenta lo ya abonado en esa parcialidad', () => {
    expect(saldoCobranza({ monto: 10000, montoPagado: 4000 }, factura)).toBe(6000)
  })

  it('cobro único (histórico, sin monto) sigue usando el total de la factura', () => {
    expect(saldoCobranza({ monto: null, montoPagado: 0 }, factura)).toBe(120000)
  })
})

describe('cartera del dashboard con parcialidades', () => {
  const factura = { id: 'F1', campanaId: 'C1', monto: 120000, moneda: 'MXN', estatus: 'EMITIDA' }
  const cuota = (n: number) => ({
    id: `CO${n}`, facturaId: 'F1', plazoDias: 30, fechaVencimiento: MANANA,
    estatus: 'AL_CORRIENTE', montoPagado: 0, numero: n, totalCuotas: 12, monto: 10000,
  })

  it('12 mensualidades de 10 000 suman 120 000 por cobrar, NO 1 440 000', () => {
    const cobranzas = Array.from({ length: 12 }, (_, i) => cuota(i + 1))
    const m = dashboardMetrics(baseState({ facturas: [factura], cobranzas }))
    expect(m.porCobrar).toBe(120000)
  })

  it('al liquidar una cuota, la cartera baja solo esa cuota', () => {
    const cobranzas = Array.from({ length: 12 }, (_, i) => cuota(i + 1))
    cobranzas[0] = { ...cobranzas[0], montoPagado: 10000, estatus: 'PAGADA' }
    const m = dashboardMetrics(baseState({ facturas: [factura], cobranzas }))
    expect(m.porCobrar).toBe(110000)
  })

  it('el cobro único de siempre no cambia de comportamiento', () => {
    const unica = {
      id: 'CO', facturaId: 'F1', plazoDias: 90, fechaVencimiento: MANANA,
      estatus: 'AL_CORRIENTE', montoPagado: 0, numero: null, totalCuotas: null, monto: null,
    }
    const m = dashboardMetrics(baseState({ facturas: [factura], cobranzas: [unica] }))
    expect(m.porCobrar).toBe(120000)
  })
})

describe('periodicidades de las cuotas', () => {
  it('incluye anual y semestral, para campañas de 12 y 24 meses', () => {
    expect(Object.keys(INTERVALO_PERIODO)).toContain('ANUAL')
    expect(Object.keys(INTERVALO_PERIODO)).toContain('SEMESTRAL')
  })

  it('avanza por MESES reales, no por 30 días fijos', () => {
    // Con "30 days" doce cuotas mensuales se desplazaban: 1 sep, 1 oct, 31 oct,
    // 30 nov… Postgres con `1 month` respeta el día y ajusta los meses cortos.
    expect(INTERVALO_PERIODO.MENSUAL).toBe('1 month')
    expect(INTERVALO_PERIODO.ANUAL).toBe('1 year')
    expect(INTERVALO_PERIODO.MENSUAL).not.toMatch(/day/)
  })

  it('toda periodicidad tiene etiqueta: el desplegable se genera de aquí', () => {
    for (const k of Object.keys(INTERVALO_PERIODO)) {
      expect(PERIODICIDAD_LABEL[k as keyof typeof PERIODICIDAD_LABEL]).toBeTruthy()
    }
  })
})
