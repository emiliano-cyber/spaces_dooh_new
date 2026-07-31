import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  Corregir la renta de un contrato pone al día su calendario.
//
//  El calendario se generaba con `on conflict (contrato_id, periodo) do
//  nothing`, que por definición no toca lo que ya existe. Al corregir el
//  importe, solo los periodos NUEVOS nacían con el precio nuevo: el contrato
//  acababa con dos precios mezclados —en la base de demo, una cuota de 45 000 y
//  diecinueve de 66 000— y Finanzas seguía programando la salida de dinero
//  vieja. Y como no hay forma de editar una cuota suelta, tampoco se podía
//  arreglar a mano.
//
//  Las dos reglas que se fijan aquí:
//   · PAGADO no se toca NUNCA — hubo una transferencia real, es un hecho.
//   · Todo lo demás sigue al contrato, incluido lo VENCIDO, porque editar el
//     importe es una corrección: un contrato firmado no se puede editar, así
//     que lo que llega aquí es un acuerdo que todavía no obliga a nadie, y un
//     aumento de renta real se modela con un contrato nuevo.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'tenant-A'
const CONTRATO = '44444444-4444-4444-4444-444444444444'

let queries: { sql: string; params: unknown[] }[] = []
let filaContrato: Record<string, unknown> = {}
let firmasFirmadas = 0

const client = {
  query: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (/^\s*select \* from contratos_arrendamiento/.test(sql)) return { rows: [filaContrato] }
    if (/^\s*update contratos_arrendamiento/.test(sql)) return { rows: [filaContrato] }
    if (/from contrato_firmas/.test(sql)) return { rows: [{ n: firmasFirmadas }] }
    return { rows: [], rowCount: 0 }
  },
} as unknown as PoolClient

vi.mock('./db', () => ({
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
  withTenantTx: async (fn: (c: PoolClient) => Promise<unknown>) => fn(client),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => TENANT, tenantDeRequest: async () => TENANT }))
vi.mock('./sitios-repo', () => ({ insertarSitio: vi.fn(), rowToSitio: (r: unknown) => r }))

const { editarContrato } = await import('./arrendadores-repo')

const contratoCompleto = (over: Record<string, unknown> = {}) => ({
  id: CONTRATO, tenant_id: TENANT, sitio_id: 'S1', arrendador_id: 'A1',
  fecha_inicio: '2026-01-01', fecha_fin: '2026-06-01', monto_renta: 66000,
  periodicidad: 'MENSUAL', moneda: 'MXN', auto_renovable: false,
  estatus: 'VIGENTE', creado_en: '2026-01-01', ...over,
})

// El reajuste de importe, distinguido del `insert ... on conflict`.
const reajuste = () =>
  queries.find((q) => /^\s*update pagos_renta/.test(q.sql) && /set monto/.test(q.sql))

beforeEach(() => {
  queries = []
  filaContrato = contratoCompleto()
  firmasFirmadas = 0
})

describe('reajuste del importe de las cuotas', () => {
  it('pone las cuotas no pagadas al importe del contrato', async () => {
    await editarContrato(CONTRATO, { montoRenta: 66000 })
    const u = reajuste()
    expect(u).toBeDefined()
    expect(u!.params).toEqual([CONTRATO, 66000])
  })

  it('nunca toca una cuota PAGADA', async () => {
    await editarContrato(CONTRATO, { montoRenta: 66000 })
    expect(reajuste()!.sql).toMatch(/estatus\s*<>\s*'PAGADO'/)
  })

  // Con `<>` una cuota de importe NULL nunca entraría en el WHERE (NULL <> x es
  // NULL) y se quedaría sin importe para siempre.
  it('usa `is distinct from` para alcanzar las cuotas con importe NULL', async () => {
    await editarContrato(CONTRATO, { montoRenta: 66000 })
    expect(reajuste()!.sql).toMatch(/monto is distinct from/)
  })

  it('va acotado al contrato editado', async () => {
    await editarContrato(CONTRATO, { montoRenta: 66000 })
    expect(reajuste()!.sql).toMatch(/where contrato_id = \$1/)
  })

  it('corre dentro de la misma transacción que el UPDATE del contrato', async () => {
    await editarContrato(CONTRATO, { montoRenta: 66000 })
    const iUpdate = queries.findIndex((q) => /^\s*update contratos_arrendamiento/.test(q.sql))
    const iReajuste = queries.findIndex((q) => q === reajuste())
    expect(iUpdate).toBeGreaterThanOrEqual(0)
    expect(iReajuste).toBeGreaterThan(iUpdate)
  })
})

describe('cuándo NO se reajusta', () => {
  // Un contrato INCOMPLETO (ADR 0001) todavía no tiene importe. Reajustar a
  // NULL borraría el importe de cuotas que sí lo tenían.
  it('un contrato sin importe no borra el de las cuotas', async () => {
    filaContrato = contratoCompleto({ monto_renta: null, fecha_fin: null, periodicidad: null })
    await editarContrato(CONTRATO, { documentoUrl: 'x' })
    expect(reajuste()).toBeUndefined()
  })

  it('un contrato sin periodicidad tampoco', async () => {
    filaContrato = contratoCompleto({ periodicidad: null })
    await editarContrato(CONTRATO, { documentoUrl: 'x' })
    expect(reajuste()).toBeUndefined()
  })

  // Un contrato ya firmado no se edita: lo que se firmó es un texto concreto.
  it('un contrato firmado se rechaza antes de tocar el calendario', async () => {
    firmasFirmadas = 1
    const r = await editarContrato(CONTRATO, { montoRenta: 99000 })
    expect(r).toEqual({ firmado: true })
    expect(reajuste()).toBeUndefined()
  })
})
