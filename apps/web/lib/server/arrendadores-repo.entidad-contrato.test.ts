import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'
import { AppError } from './errores'

// ============================================================================
//  editarContrato: QUÉ RAZÓN SOCIAL PROPIA paga esta renta (`entidad_id`).
// ----------------------------------------------------------------------------
//  La columna existe desde el 2026-09-17 y hasta hoy NINGÚN endpoint la
//  escribía. Éste es el primero, y por eso las dos comprobaciones de abajo son
//  nuevas y no heredadas.
//
//  ─── No confundir las dos razones sociales ────────────────────────────────
//  `razon_social_id` es la del ARRENDADOR —quien me COBRA la renta— y ya tenía
//  su validación. `entidad_id` es la del OWNER —quien la PAGA—. Son columnas
//  distintas, tablas distintas y validaciones distintas; una no cubre a la otra.
//
//  ─── Por qué se valida contra el tenant AUNQUE la FK ya sea compuesta ─────
//  Desde `20260918_entidad_tenant_compuesto.sql` la FK va contra
//  `(id, tenant_id)`, así que la base RECHAZA la entidad ajena. Eso es la red,
//  no la puerta: lo que llega por ahí es un error del driver (23503) que el
//  usuario ve como un 500 sin nada que corregir. La validación explícita
//  convierte ese fallo en un 404 con mensaje — y sigue haciendo falta el día
//  que alguien añada otra ruta que escriba esta columna.
//
//  `entidad_id` NO ES UNA FRONTERA DE SEGURIDAD. La única es `tenant_id`.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'tenant-A'
const ARR_PROPIO = '11111111-1111-1111-1111-111111111111'
const ENT_PROPIA = '55555555-5555-5555-5555-555555555555'
const ENT_AJENA = '66666666-6666-6666-6666-666666666666'
const CONTRATO = '44444444-4444-4444-4444-444444444444'

let queries: { sql: string; params: unknown[] }[] = []
let entidadValida = true

const filaContrato = {
  id: CONTRATO, tenant_id: TENANT, sitio_id: 'S1', arrendador_id: ARR_PROPIO,
  fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', monto_renta: 20000,
  periodicidad: 'MENSUAL', moneda: 'MXN', auto_renovable: false, estatus: 'VIGENTE',
  entidad_id: null, creado_en: '2026-01-01',
}

const client = {
  query: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (/from arrendadores\b/.test(sql)) return { rows: [{ id: params[0] }] }
    if (/arrendador_razon_social/.test(sql)) return { rows: [{ id: params[0] }] }
    // La consulta que valida la entidad del OWNER. Se distingue por su tabla.
    if (/from entidades_fiscales\b/.test(sql)) {
      return { rows: entidadValida ? [{ id: params[0] }] : [] }
    }
    if (/^\s*select \* from contratos_arrendamiento/.test(sql)) return { rows: [filaContrato] }
    if (/^\s*update contratos_arrendamiento/.test(sql)) {
      return { rows: [{ ...filaContrato, entidad_id: ENT_PROPIA }] }
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
const elUpdate = () => queries.find((q) => /^\s*update contratos_arrendamiento/.test(q.sql))
const laValidacion = () => queries.find((q) => /from entidades_fiscales\b/.test(q.sql))

beforeEach(() => {
  queries = []
  entidadValida = true
})

describe('la entidad que PAGA la renta', () => {
  it('se escribe en entidad_id cuando viene en el patch', async () => {
    await editarContrato(CONTRATO, { entidadId: ENT_PROPIA })
    const upd = elUpdate()
    expect(upd, `no hubo UPDATE. SQL ejecutado:\n${sqlDe()}`).toBeDefined()
    expect(upd!.sql).toMatch(/entidad_id\s*=\s*\$\d+/)
    expect(upd!.params).toContain(ENT_PROPIA)
  })

  it('se valida contra el TENANT antes de escribirla', async () => {
    await editarContrato(CONTRATO, { entidadId: ENT_PROPIA })
    const check = laValidacion()
    expect(check, `no se validó la entidad. SQL ejecutado:\n${sqlDe()}`).toBeDefined()
    // El tenant tiene que ir EN la consulta: comprobar solo que el uuid existe
    // es exactamente el agujero que la migración del 18/09 cerró en la base, y
    // aquí se cierra además con un mensaje que se puede leer.
    expect(check!.sql).toMatch(/tenant_id/)
    expect(check!.params).toContain(TENANT)
  })

  it('NEGATIVO CLAVE · rechaza la entidad de otra organizacion y NO escribe nada', async () => {
    entidadValida = false
    await expect(editarContrato(CONTRATO, { entidadId: ENT_AJENA })).rejects.toBeInstanceOf(AppError)
    expect(elUpdate(), `escribió pese al rechazo. SQL:\n${sqlDe()}`).toBeUndefined()
  })

  it('la validacion va ANTES del UPDATE, no despues', async () => {
    // Validar después es no validar: la fila ya estaría escrita cuando salte el
    // error, y la transacción es lo único que lo desharía. Con el orden puesto
    // no hace falta confiar en eso.
    await editarContrato(CONTRATO, { entidadId: ENT_PROPIA })
    const iCheck = queries.findIndex((q) => /from entidades_fiscales\b/.test(q.sql))
    const iUpd = queries.findIndex((q) => /^\s*update contratos_arrendamiento/.test(q.sql))
    expect(iCheck).toBeGreaterThanOrEqual(0)
    expect(iCheck).toBeLessThan(iUpd)
  })

  it('«sin asignar» se puede QUITAR: null explicito escribe null y no se valida nada', async () => {
    // `null` es un estado legítimo —todas las filas anteriores al 17/09 están
    // así— y tiene que poder volver a ponerse. Validarlo buscaría la entidad
    // `null` en la base y la quitaría por «no existe», que convertiría
    // desasignar en un error.
    await editarContrato(CONTRATO, { entidadId: null })
    const upd = elUpdate()
    expect(upd!.sql).toMatch(/entidad_id\s*=\s*\$\d+/)
    expect(upd!.params).toContain(null)
    expect(laValidacion(), `validó una entidad nula. SQL:\n${sqlDe()}`).toBeUndefined()
  })

  it('sin entidadId en el patch, entidad_id NO se toca', async () => {
    // `undefined` es «no lo toques». Si entrara en el UPDATE, editar el importe
    // de la renta borraría la razón social que paga, en silencio.
    await editarContrato(CONTRATO, { montoRenta: 30000 })
    const upd = elUpdate()
    expect(upd!.sql).not.toMatch(/entidad_id/)
  })

  it('el contrato devuelto trae entidadId, para que la pantalla lo pueda pintar', async () => {
    const r = await editarContrato(CONTRATO, { entidadId: ENT_PROPIA })
    expect(r).toHaveProperty('contrato')
    expect((r as any).contrato.entidadId).toBe(ENT_PROPIA)
  })
})
