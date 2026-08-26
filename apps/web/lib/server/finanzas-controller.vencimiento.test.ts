import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  VAL-08 · el primer vencimiento del plan de parcialidades no era una fecha.
// ----------------------------------------------------------------------------
//  `facturaSchemaDe` valida con cuidado el plazo y la periodicidad, y hasta se
//  niega a aceptar el número de cuotas del cliente para que nadie facture
//  100 000 y programe cuotas por 10. Pero el primer vencimiento entraba como
//  `z.string().min(1, 'Falta la fecha del primer vencimiento')`.
//
//  Ese valor va a `($3::date + ($5::int * $4::interval))::date`
//  (`finanzas-repo.ts:238`), así que «mañana» no daba un 400: daba un error del
//  driver, o sea un 500 sin nada que le diga al usuario qué escribió mal. Es
//  literalmente el defecto de UX-01, en la ruta de facturar.
//
//  Y es cartera: de esa fecha salen los vencimientos de TODAS las cuotas.
// ============================================================================

let plazos: number[] = [60, 90, 120]
const facturado: { campanaId: string; plazoDias: number; plan: unknown }[] = []

vi.mock('./db', () => ({
  q1: vi.fn(async (texto: string, params: unknown[] = []) => {
    if (texto.includes('from config_negocio')) {
      return { id: 'cfg', tenant_id: params[0], moneda: 'MXN', iva_tasas: [16], plazos_cobranza: plazos }
    }
    return null
  }),
  q: vi.fn(async () => []),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 't1') }))
vi.mock('./finanzas-repo', () => ({
  generarFactura: vi.fn(async (campanaId: string, plazoDias: number, plan: unknown) => {
    facturado.push({ campanaId, plazoDias, plan })
    return { id: 'fac-1', folio: 'A-000001' }
  }),
  registrarPagoCobranza: vi.fn(async () => null),
  FacturaError: class FacturaError extends Error {},
}))

const { generarFacturaCtrl } = await import('./finanzas-controller')

beforeEach(() => {
  facturado.length = 0
  plazos = [60, 90, 120]
})

async function facturar(cuerpo: unknown) {
  try {
    await generarFacturaCtrl('cmp-1', cuerpo)
    return { ok: true as const, mensaje: '', status: 201 }
  } catch (e) {
    const err = e as Error & { status?: number }
    return { ok: false as const, mensaje: err.message, status: err.status ?? 500 }
  }
}

// Control positivo: sin él, un negativo podría estar pasando porque el schema
// ni se construye. Es el fallo que se repitió cinco veces el 26/08.
describe('control · el plan de parcialidades correcto sigue pasando', () => {
  it('una fecha de verdad llega al model tal cual', async () => {
    const r = await facturar({
      plazoDias: 60,
      plan: { periodicidad: 'MENSUAL', primerVencimiento: '2026-09-15' },
    })
    expect(r.ok, r.mensaje).toBe(true)
    expect(facturado[0].plan).toEqual({ periodicidad: 'MENSUAL', primerVencimiento: '2026-09-15' })
  })

  it('sin plan (cobro único) sigue funcionando', async () => {
    const r = await facturar({ plazoDias: 60 })
    expect(r.ok, r.mensaje).toBe(true)
    expect(facturado[0].plan).toBeNull()
  })
})

describe('VAL-08 · el primer vencimiento tiene que ser una fecha', () => {
  it('rechaza «mañana» con 400 y NO factura', async () => {
    const r = await facturar({
      plazoDias: 60,
      plan: { periodicidad: 'MENSUAL', primerVencimiento: 'mañana' },
    })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(facturado).toEqual([])
  })

  it('sigue exigiendo que venga', async () => {
    const r = await facturar({ plazoDias: 60, plan: { periodicidad: 'MENSUAL', primerVencimiento: '' } })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(facturado).toEqual([])
  })
})
