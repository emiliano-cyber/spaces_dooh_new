import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  Las modalidades heredan el tenant de SU sitio, explícitamente.
//
//  `sitio_modalidades.tenant_id` es NOT NULL y arrastra un DEFAULT con un uuid
//  de tenant FIJO (deriva de esquema: la columna se añadió fuera de
//  db/schema.sql y de db/migrations). El INSERT omitía la columna, así que la
//  fila no salía con tenant NULL —salía con el tenant del default—:
//
//   · Si el que importaba era ese tenant, colaba y nadie lo notaba.
//   · Para cualquier OTRO tenant, la política `tenant_isolation` (fail-closed y
//     FORCE, ver 20260720_hard1_rls_todas_tablas.sql) rechazaba el INSERT por
//     WITH CHECK con SQLSTATE 42501, que `errores.ts` traduce a 403
//     «Sin acceso a ese registro». Ese era el error al subir inventario masivo
//     en producción.
//
//  Por eso lo que se fija aquí no es "manda tenant_id" sino "manda EL del sitio
//  padre": es el invariante que hace imposible que una modalidad quede colgada
//  de un tenant distinto al de su pantalla, y no depende de que el default siga
//  existiendo ni de a quién apunte.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT_ACTIVO = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const SITIO = 'ssssssss-ssss-ssss-ssss-ssssssssssss'

let queries: { sql: string; params: unknown[] }[] = []

const client = {
  query: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (/insert into sitios/.test(sql)) {
      return { rows: [{ id: SITIO, tenant_id: TENANT_ACTIVO, nombre: 'Pantalla' }], rowCount: 1 }
    }
    if (/^\s*update sitios/.test(sql)) {
      return { rows: [{ tenant_id: TENANT_ACTIVO }], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  },
} as unknown as PoolClient

vi.mock('./db', () => ({
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
}))
vi.mock('./tenant', () => ({
  tenantActual: async () => TENANT_ACTIVO,
  tenantDeRequest: async () => TENANT_ACTIVO,
}))
vi.mock('./contratos-sitio', () => ({
  exigirArrendador: vi.fn(),
  asignarArrendadorYAbrirContrato: vi.fn(),
  resolverPredio: vi.fn(),
  ligarSitioAPredio: vi.fn(),
  abrirContratoDePredio: vi.fn(),
  exigirSitioEnElPredio: vi.fn(),
}))

const { insertarSitio } = await import('./sitios-repo')

const insertModalidad = () =>
  queries.find((q) => /insert into sitio_modalidades/.test(q.sql))

beforeEach(() => {
  queries = []
})

describe('sitio_modalidades hereda el tenant del sitio padre', () => {
  it('el INSERT nombra la columna tenant_id en vez de dejarla al DEFAULT', async () => {
    await insertarSitio(client, {
      nombre: 'Pantalla',
      modalidadesDetalle: [{ unidad: 'mensual', tarifaPublicada: 100, costoCompra: 50 }],
    })

    const ins = insertModalidad()
    expect(ins, 'debe insertarse la modalidad').toBeDefined()
    // Sin esto la fila cae en el tenant del DEFAULT y la RLS la rechaza con 42501.
    expect(ins!.sql).toMatch(/tenant_id/)
  })

  it('el valor enviado es el tenant de la fila del sitio, no otro', async () => {
    await insertarSitio(client, {
      nombre: 'Pantalla',
      modalidadesDetalle: [{ unidad: 'mensual', tarifaPublicada: 100, costoCompra: 50 }],
    })

    expect(insertModalidad()!.params).toContain(TENANT_ACTIVO)
  })

  it('cada modalidad del lote lleva el tenant, no solo la primera', async () => {
    await insertarSitio(client, {
      nombre: 'Pantalla',
      modalidadesDetalle: [
        { unidad: 'mensual', tarifaPublicada: 100, costoCompra: 50 },
        { unidad: 'catorcenal', tarifaPublicada: 60, costoCompra: 30 },
        { unidad: 'spot', tarifaPublicada: 5, costoCompra: 2 },
      ],
    })

    const inserts = queries.filter((q) => /insert into sitio_modalidades/.test(q.sql))
    expect(inserts).toHaveLength(3)
    for (const ins of inserts) expect(ins.params).toContain(TENANT_ACTIVO)
  })
})
