import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  `actualizarModalidades` NO PISA lo que no viene — el SQL, no el controller.
// ----------------------------------------------------------------------------
//  LA TRAMPA QUE ESTO VIGILA, y es la que tenía nombre desde el principio:
//  `actualizarSitioCompleto` (el camino de la IMPORTACIÓN) hace
//
//      delete from sitio_modalidades where sitio_id = $1
//
//  y reinserta lo que trae el archivo. Para una re-importación es lo correcto:
//  el archivo ES la verdad completa de esa pantalla.
//
//  Para una EDICIÓN desde la ficha es destructivo. Quien cambia la tarifa de
//  spot no está diciendo nada sobre la mensual, y con esa semántica se la
//  llevaría por delante. Y el fallo NO DARÍA ERROR: la pantalla simplemente
//  dejaría de venderse por mensual, que es el mismo modo de fallo silencioso que
//  R2 documenta para `qRaw` en `vault/06-Operacion/zonas-de-riesgo.md`.
//
//  Las pruebas del controller mockean el repo entero, así que no ven una línea
//  de este SQL. Aquí se mockea `./db` y se MIRAN LAS CONSULTAS que salen.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []

const clienteFalso = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return { rows: [] }
  }),
} as unknown as PoolClient

const db = {
  pool: { connect: vi.fn(async () => clienteFalso) },
  q: vi.fn(async () => []),
  q1: vi.fn(async () => ({ id: 'S1', tenant_id: 'T1' })),
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
  withTenantTx: vi.fn(async (fn: (c: PoolClient) => Promise<unknown>) => fn(clienteFalso)),
}
vi.mock('./db', () => db)
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))

const { actualizarModalidades } = await import('./sitios-repo')

beforeEach(() => {
  consultas.length = 0
  vi.clearAllMocks()
  db.q1.mockResolvedValue({ id: 'S1', tenant_id: 'T1' })
  db.q.mockResolvedValue([])
  db.withTenantTx.mockImplementation(async (fn: (c: PoolClient) => Promise<unknown>) => fn(clienteFalso))
})

const sql = () => consultas.map((c) => c.sql.replace(/\s+/g, ' ').trim())

describe('1 · NO hay borrado en bloque', () => {
  it('guardar una unidad no borra NINGUNA otra', async () => {
    await actualizarModalidades('S1', {
      guardar: [{ unidad: 'spot', tarifaPublicada: 250, costoCompra: 0 }],
      quitar: [],
    })
    const borrados = sql().filter((s) => /delete\s+from\s+sitio_modalidades/i.test(s))
    expect(borrados).toEqual([])
  })

  it('ni siquiera cuando también se quita una: el delete lleva SIEMPRE la unidad', async () => {
    // Lo que se prohíbe es el `delete ... where sitio_id = $1` a secas. Un
    // delete acotado a las unidades pedidas es justo lo que tiene que haber.
    await actualizarModalidades('S1', {
      guardar: [{ unidad: 'spot', tarifaPublicada: 250, costoCompra: 0 }],
      quitar: ['hora'],
    })
    const borrados = sql().filter((s) => /delete\s+from\s+sitio_modalidades/i.test(s))
    expect(borrados).toHaveLength(1)
    expect(borrados[0]).toMatch(/unidad\s*=\s*any/i)
  })

  it('sin bajas no sale NI UN delete', async () => {
    await actualizarModalidades('S1', {
      guardar: [
        { unidad: 'spot', tarifaPublicada: 250, costoCompra: 0 },
        { unidad: 'hora', tarifaPublicada: 900, costoCompra: 0 },
      ],
      quitar: [],
    })
    expect(sql().filter((s) => /delete/i.test(s))).toEqual([])
    expect(sql().filter((s) => /insert into sitio_modalidades/i.test(s))).toHaveLength(2)
  })
})

describe('2 · el aislamiento entre organizaciones (R2)', () => {
  it('el tenant se toma de la FILA DE LA PANTALLA, no de la sesión', async () => {
    // Mismo invariante que documenta `insertarSitio`: una modalidad no puede
    // acabar en otro tenant que su pantalla. Con el `tenant_id` omitido, el
    // DEFAULT de la columna escribía un tenant fijo y la RLS rechazaba el
    // INSERT con 42501 en cualquier otra organización.
    db.q1.mockResolvedValue({ id: 'S1', tenant_id: 'T-DEL-SITIO' })
    await actualizarModalidades('S1', {
      guardar: [{ unidad: 'spot', tarifaPublicada: 250, costoCompra: 0 }],
      quitar: [],
    })
    const ins = consultas.find((c) => /insert into sitio_modalidades/i.test(c.sql))
    expect(ins?.params).toContain('T-DEL-SITIO')
  })

  it('la BAJA lleva `tenant_id` como segunda capa sobre la RLS', async () => {
    // Las convenciones lo exigen para toda operación por id. Es lo que queda en
    // pie el día que alguien conecte con un rol que se salte la RLS.
    await actualizarModalidades('S1', { guardar: [], quitar: ['spot'] })
    const del = consultas.find((c) => /delete from sitio_modalidades/i.test(c.sql))
    expect(del?.sql.replace(/\s+/g, ' ')).toMatch(/and tenant_id = \$3/)
    expect(del?.params).toContain('T1')
  })

  it('una pantalla que la RLS no deja ver devuelve null y no escribe nada', async () => {
    db.q1.mockResolvedValue(null as never)
    const r = await actualizarModalidades('DE-OTRA-ORG', {
      guardar: [{ unidad: 'spot', tarifaPublicada: 250, costoCompra: 0 }],
      quitar: [],
    })
    expect(r).toBeNull()
    expect(consultas).toEqual([])
  })
})

describe('3 · todo o nada', () => {
  it('las escrituras van dentro de UNA transacción con el tenant fijado', async () => {
    // `withTenantTx` abre el `begin` Y fija el GUC dentro de él —
    // `set_config(..., true)` es transaction-local, así que fijarlo fuera no
    // serviría de nada. Si esto dejara de pasar por ahí, un alta aplicada con
    // su baja hermana sin aplicar dejaría tarifas que nadie decidió.
    await actualizarModalidades('S1', {
      guardar: [{ unidad: 'spot', tarifaPublicada: 250, costoCompra: 0 }],
      quitar: ['hora'],
    })
    expect(db.withTenantTx).toHaveBeenCalledTimes(1)
  })

  it('el alta usa `on conflict (sitio_id, unidad)`: repetir una unidad es cambiarle el precio', async () => {
    await actualizarModalidades('S1', {
      guardar: [{ unidad: 'spot', tarifaPublicada: 250, costoCompra: 0 }],
      quitar: [],
    })
    const ins = sql().find((s) => /insert into sitio_modalidades/i.test(s))
    expect(ins).toMatch(/on conflict \(sitio_id, unidad\)/i)
    expect(ins).toMatch(/do update set tarifa_publicada = excluded\.tarifa_publicada/i)
  })

  it('el SQL va parametrizado: ni una unidad interpolada en el texto', async () => {
    await actualizarModalidades('S1', {
      guardar: [{ unidad: 'spot', tarifaPublicada: 250, costoCompra: 0 }],
      quitar: ['hora'],
    })
    for (const s of sql()) {
      expect(s, s).not.toMatch(/'spot'|'hora'/)
    }
  })
})
