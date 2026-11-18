import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  18/11 · una sola oportunidad ABIERTA por prospecto (pedido del dueño).
// ----------------------------------------------------------------------------
//  Lo que se fija aquí es la FORMA de la comprobación, que las e2e no ven:
//   · va por organización (`tenant_id`) y NO por vendedor: la abierta de otro
//     vendedor que quien crea no ve también cuenta;
//   · solo cuentan las abiertas (no GANADA ni PERDIDA);
//   · corre DESPUÉS de leer el prospecto con la regla de Captación (un
//     prospecto que no se ve sigue siendo 404 y no revela nada) y ANTES del
//     insert, con el prospecto bloqueado para que dos altas a la vez se pongan
//     en fila.
//  Que la regla se cumpla contra Postgres de verdad lo demuestra
//  `oportunidades.e2e.test.ts` § 9.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'tenant-A'
const PROSPECTO = '11111111-1111-1111-1111-111111111111'
const VENDEDOR = '22222222-2222-2222-2222-222222222222'

let queries: { sql: string; params: unknown[] }[] = []
let hayAbierta = false
let prospectoVisible = true

const client = {
  query: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (/from prospectos/.test(sql)) return { rows: prospectoVisible ? [{ tipo: 'CLIENTE', registro_id: null }] : [] }
    if (/from oportunidades/.test(sql)) return { rows: hayAbierta ? [{ '?column?': 1 }] : [] }
    if (/insert into oportunidades/.test(sql)) return { rows: [{ id: 'op-nueva' }] }
    return { rows: [] }
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

const { crearOportunidad } = await import('./oportunidades-repo')

const datos = {
  nombre: 'Verano', presupuestoMin: null, presupuestoMax: null, fechaInicioDeseada: null, fechaFinDeseada: null,
  fechaDecision: null, plazas: null, tiposMedio: [], objetivo: null, prospectoId: PROSPECTO, clienteId: null, nota: null,
}
const autor = { id: VENDEDOR, nombre: 'Mariana' }

beforeEach(() => {
  queries = []
  hayAbierta = false
  prospectoVisible = true
})

const consultaAbierta = () => queries.find((x) => /from oportunidades/.test(x.sql) && !/insert/.test(x.sql))

describe('crearOportunidad · una sola abierta por prospecto', () => {
  it('con una abierta: 409 con el motivo, y no hay insert', async () => {
    hayAbierta = true
    await expect(crearOportunidad(datos as never, autor, VENDEDOR)).rejects.toMatchObject({
      status: 409,
      message: 'Ese prospecto ya tiene una oportunidad abierta. Se puede abrir otra cuando esa se gane o se pierda',
    })
    expect(queries.some((x) => /insert into oportunidades/.test(x.sql))).toBe(false)
  })

  it('sin abierta: se da de alta', async () => {
    await expect(crearOportunidad(datos as never, autor, VENDEDOR)).resolves.toBe('op-nueva')
  })

  it('la comprobación es por organización y prospecto, SIN el filtro de vendedor, y solo cuenta las abiertas', async () => {
    await crearOportunidad(datos as never, autor, VENDEDOR)
    const c = consultaAbierta()!
    expect(c).toBeDefined()
    expect(c.sql).toMatch(/tenant_id = \$\d/)
    expect(c.sql).toMatch(/prospecto_id = \$\d/)
    expect(c.sql).not.toMatch(/usuario_id/)
    expect(c.sql).toMatch(/not in \('GANADA', ?'PERDIDA'\)/)
    expect(c.params).toEqual([PROSPECTO, TENANT])
    expect(c.params).not.toContain(VENDEDOR)
  })

  it('va DESPUÉS de leer (y bloquear) el prospecto, y antes del insert', async () => {
    await crearOportunidad(datos as never, autor, VENDEDOR)
    const i = (re: RegExp) => queries.findIndex((x) => re.test(x.sql))
    const lectura = queries[i(/from prospectos/)]
    expect(lectura.sql).toMatch(/for no key update/)
    expect(i(/from prospectos/)).toBeLessThan(queries.indexOf(consultaAbierta()!))
    expect(queries.indexOf(consultaAbierta()!)).toBeLessThan(i(/insert into oportunidades/))
  })

  it('un prospecto que quien crea no ve sigue siendo 404, sin mirar sus oportunidades', async () => {
    prospectoVisible = false
    hayAbierta = true
    await expect(crearOportunidad(datos as never, autor, VENDEDOR)).rejects.toMatchObject({ status: 404 })
    expect(consultaAbierta()).toBeUndefined()
  })

  it('un alta sobre un cliente (sin prospecto) no comprueba nada de esto', async () => {
    hayAbierta = true
    await expect(
      crearOportunidad({ ...datos, prospectoId: null, clienteId: '33333333-3333-3333-3333-333333333333' } as never, autor, null),
    ).rejects.toMatchObject({ status: 404 }) // el cliente simulado no existe; lo que importa es que no da 409
    expect(consultaAbierta()).toBeUndefined()
  })
})
