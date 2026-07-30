import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  Alta de razón social: adopción de contratos que no tenían ninguna.
//
//  La herencia de razón social solo ocurría al CREAR el contrato y nunca se
//  ponía al corriente. Cuando las pantallas entran por importación masiva y el
//  arrendador todavía no tiene razón social capturada, sus contratos nacen con
//  `razon_social_id` NULL — y capturarla después NO los alcanzaba: se quedaban
//  huérfanos para siempre, sin que nada los reclamara (la razón social no es de
//  los cuatro datos que exige `contrato_completo_ck`). Solo se veían agrupados
//  bajo «Sin razón social» en Finanzas, que es dato fiscal faltante: sin ella no
//  hay a quién emitirle el pago de la renta.
//
//  Lo que estas pruebas fijan son las tres condiciones del UPDATE, porque cada
//  una evita un daño distinto:
//
//   · SIN FIRMAR  — el documento firmado nombra a las partes. Cambiarle la razón
//                   social después dejaría la firma respaldando otra cosa.
//   · ÚNICA       — con varias razones sociales no se puede adivinar cuál
//                   factura cada contrato; elegir la recién creada sería
//                   arbitrario.
//   · SIN NINGUNA — no se pisa una razón social ya asignada a mano.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'tenant-A'
const ARR = '11111111-1111-1111-1111-111111111111'
const RS_NUEVA = '99999999-9999-9999-9999-999999999999'

let queries: { sql: string; params: unknown[] }[] = []
let adoptados = 0

const client = {
  query: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (/insert into arrendador_razon_social/.test(sql)) {
      return { rows: [{ id: RS_NUEVA, arrendador_id: ARR, razon_social: 'ACME SA', rfc: null, regimen: null, creado_en: '2026-07-30' }], rowCount: 1 }
    }
    if (/^\s*update contratos_arrendamiento/.test(sql)) return { rows: [], rowCount: adoptados }
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

const { crearRazonSocial } = await import('./arrendadores-repo')

const updateSql = () => queries.find((q) => /^\s*update contratos_arrendamiento/.test(q.sql))?.sql ?? ''

beforeEach(() => {
  queries = []
  adoptados = 0
})

describe('la razón social se inserta y adopta en la MISMA transacción', () => {
  it('inserta primero y luego actualiza los contratos', async () => {
    adoptados = 8
    const r = await crearRazonSocial({ arrendadorId: ARR, razonSocial: 'ACME SA' })
    const orden = queries.map((q) => (/insert/.test(q.sql) ? 'insert' : /update/.test(q.sql) ? 'update' : 'otro'))
    expect(orden).toEqual(['insert', 'update'])
    expect(r.razonSocial.id).toBe(RS_NUEVA)
  })

  it('devuelve cuántos contratos adoptó, para poder decirlo', async () => {
    // Reatribuir contratos en silencio es un cambio de dato fiscal que el
    // usuario no pidió explícitamente: la UI necesita el número para avisarlo.
    adoptados = 8
    expect((await crearRazonSocial({ arrendadorId: ARR, razonSocial: 'ACME SA' })).contratosAdoptados).toBe(8)
  })

  it('devuelve 0 cuando no había ninguno huérfano', async () => {
    adoptados = 0
    expect((await crearRazonSocial({ arrendadorId: ARR, razonSocial: 'ACME SA' })).contratosAdoptados).toBe(0)
  })

  it('adopta con el id de la razón social RECIÉN creada', async () => {
    await crearRazonSocial({ arrendadorId: ARR, razonSocial: 'ACME SA' })
    const upd = queries.find((q) => /^\s*update contratos_arrendamiento/.test(q.sql))!
    expect(upd.params[0]).toBe(RS_NUEVA)
    expect(upd.params).toContain(TENANT)
    expect(upd.params).toContain(ARR)
  })
})

describe('las tres condiciones del UPDATE', () => {
  beforeEach(async () => {
    await crearRazonSocial({ arrendadorId: ARR, razonSocial: 'ACME SA' })
  })

  it('excluye los contratos FIRMADOS', () => {
    const sql = updateSql()
    expect(sql).toMatch(/contrato_firmas/)
    expect(sql).toMatch(/FIRMADA/)
    expect(sql).toMatch(/not exists/)
  })

  it('solo adopta si esta queda como la ÚNICA razón social del arrendador', () => {
    // Con varias, cuál factura cada contrato es decisión de quien captura.
    expect(updateSql()).toMatch(/count\(\*\)\s*from\s*arrendador_razon_social[\s\S]*?=\s*1/)
  })

  it('no pisa una razón social ya asignada', () => {
    expect(updateSql()).toMatch(/razon_social_id is null/)
  })

  it('excluye los contratos CANCELADOS', () => {
    // Un acuerdo roto no se factura a nadie.
    expect(updateSql()).toMatch(/estatus <> 'CANCELADO'/)
  })

  it('queda acotado al tenant y al arrendador del alta', () => {
    const sql = updateSql()
    expect(sql).toMatch(/c\.tenant_id = \$2/)
    expect(sql).toMatch(/c\.arrendador_id = \$3/)
  })
})
