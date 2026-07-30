import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'
import { AppError } from './errores'

// ============================================================================
//  editarContrato: aislamiento por tenant de las referencias del patch.
//
//  Es la ruta por la que se COMPLETA un contrato INCOMPLETO (ADR 0001), y la
//  única que deja reasignar `arrendador_id` y `razon_social_id`. Ambos llegan
//  del cliente como uuid suelto, y NINGUNA capa de la BD los ata a la
//  organización:
//
//   · La FK solo exige que la fila exista. Su comprobación corre como dueño de
//     la tabla, así que ELUDE la política `tenant_isolation`.
//   · Esa política lleva `with check (true)`: filtra lecturas, no escrituras.
//
//  El fallo concreto que esto evita: un contrato de la organización A apuntando
//  al arrendador de la B, con la renta de esa pantalla atribuida —y facturada—
//  a un propietario ajeno. El alta ya lo guardaba (`exigirArrendador`); la
//  edición no, porque `arrendadorId` se añadió a su esquema para esta función y
//  ninguna pantalla lo enviaba todavía.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'tenant-A'
const ARR_PROPIO = '11111111-1111-1111-1111-111111111111'
const ARR_AJENO = '22222222-2222-2222-2222-222222222222'
const RS_AJENA = '33333333-3333-3333-3333-333333333333'
const CONTRATO = '44444444-4444-4444-4444-444444444444'

// Consultas ejecutadas dentro de la transacción, para poder afirmar qué se
// comprobó ANTES de escribir.
let queries: { sql: string; params: unknown[] }[] = []
// Respuesta por consulta: se elige según lo que pregunte el SQL, no por orden,
// para que el test no se rompa al insertar una comprobación nueva en medio.
let arrendadorExiste = true
let razonSocialValida = true

const filaContrato = {
  id: CONTRATO, tenant_id: TENANT, sitio_id: 'S1', arrendador_id: ARR_PROPIO,
  fecha_inicio: '2026-01-01', fecha_fin: null, monto_renta: null,
  periodicidad: null, moneda: 'MXN', auto_renovable: false, estatus: 'INCOMPLETO',
  creado_en: '2026-01-01',
}

const client = {
  query: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (/from arrendadores\b/.test(sql)) {
      return { rows: arrendadorExiste ? [{ id: params[0] }] : [] }
    }
    if (/arrendador_razon_social/.test(sql)) {
      return { rows: razonSocialValida ? [{ id: params[0] }] : [] }
    }
    if (/^\s*select \* from contratos_arrendamiento/.test(sql)) {
      return { rows: [filaContrato] }
    }
    if (/^\s*update contratos_arrendamiento/.test(sql)) {
      return { rows: [{ ...filaContrato, estatus: 'VIGENTE' }] }
    }
    return { rows: [] }
  },
} as unknown as PoolClient

vi.mock('./db', () => ({
  q: vi.fn(async () => []),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
  withTenantTx: async (fn: (c: PoolClient) => Promise<unknown>) => fn(client),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => TENANT, tenantDeRequest: async () => TENANT }))
vi.mock('./sitios-repo', () => ({ insertarSitio: vi.fn(), rowToSitio: (r: unknown) => r }))

const { editarContrato } = await import('./arrendadores-repo')

const sqlDe = () => queries.map((q) => q.sql).join('\n---\n')
const huboUpdate = () => queries.some((q) => /^\s*update contratos_arrendamiento/.test(q.sql))

beforeEach(() => {
  queries = []
  arrendadorExiste = true
  razonSocialValida = true
})

describe('arrendador del patch', () => {
  it('se valida contra el tenant antes de escribirlo', async () => {
    await editarContrato(CONTRATO, { arrendadorId: ARR_PROPIO, montoRenta: 5000 })
    const check = queries.find((q) => /from arrendadores\b/.test(q.sql))
    expect(check, `no se validó el arrendador. SQL ejecutado:\n${sqlDe()}`).toBeDefined()
    // El tenant tiene que ir EN la consulta: comprobar solo la existencia del
    // uuid es exactamente el agujero que esto cierra.
    expect(check!.params).toContain(TENANT)
    expect(check!.sql).toMatch(/tenant_id/)
  })

  it('rechaza el arrendador de otra organización y NO escribe nada', async () => {
    arrendadorExiste = false
    await expect(
      editarContrato(CONTRATO, { arrendadorId: ARR_AJENO, montoRenta: 5000 }),
    ).rejects.toBeInstanceOf(AppError)
    expect(huboUpdate(), 'se escribió el contrato pese a rechazar el arrendador').toBe(false)
  })

  it('no consulta arrendadores cuando el patch no lo trae', async () => {
    // Completar solo el importe no debe costar una consulta de más.
    await editarContrato(CONTRATO, { montoRenta: 5000 })
    expect(queries.some((q) => /from arrendadores\b/.test(q.sql))).toBe(false)
  })
})

describe('razón social del patch', () => {
  it('se valida contra el tenant Y contra el arrendador', async () => {
    await editarContrato(CONTRATO, { razonSocialId: RS_AJENA })
    const check = queries.find((q) => /arrendador_razon_social/.test(q.sql))
    expect(check).toBeDefined()
    // Las dos ataduras: sin la del arrendador se podría facturar la renta a
    // nombre de otro propietario del mismo tenant.
    expect(check!.sql).toMatch(/tenant_id/)
    expect(check!.sql).toMatch(/arrendador_id/)
  })

  it('rechaza una razón social ajena y NO escribe nada', async () => {
    razonSocialValida = false
    await expect(
      editarContrato(CONTRATO, { razonSocialId: RS_AJENA }),
    ).rejects.toBeInstanceOf(AppError)
    expect(huboUpdate()).toBe(false)
  })

  it('un null explícito desliga la razón social sin validar nada', async () => {
    // Quitarla es siempre seguro; exigir que "exista" impediría desligarla.
    await editarContrato(CONTRATO, { razonSocialId: null })
    expect(queries.some((q) => /arrendador_razon_social/.test(q.sql))).toBe(false)
    expect(huboUpdate()).toBe(true)
  })
})
