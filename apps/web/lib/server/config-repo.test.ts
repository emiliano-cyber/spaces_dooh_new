import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  ADR 0011 · `config_negocio` es por tenant.
//
//  Lo que se ancla aquí es lo que se puede volver a romper en silencio:
//   · que la lectura lleve SIEMPRE el filtro por tenant. Sin él volvía el
//     `select ... limit 1` que hacía que las cinco organizaciones compartieran
//     moneda, IVA, loop y logo — y que la pantalla de Configuración de una
//     escribiera sobre los ajustes de todas.
//   · que el nombre de la organización salga de `tenants` y no de la config.
//     Cuando estaba en las dos, obtenerConfig() lo pisaba y obtenerConfigAdmin()
//     no: el sidebar decía «G500» y Configuración «RGB Catorce» (M5).
// ============================================================================

const sql: string[] = []
let filaConfig: Record<string, unknown> | null
let filaTenant: Record<string, unknown> | null

vi.mock('./db', () => ({
  q1: vi.fn(async (texto: string) => {
    sql.push(texto)
    if (texto.includes('from config_negocio')) return filaConfig
    if (texto.includes('from tenants')) return filaTenant
    return null
  }),
  q: vi.fn(async (texto: string) => {
    sql.push(texto)
    if (texto.includes('insert into config_negocio')) return [{ id: 'nueva', tenant_id: 't1' }]
    return []
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 't1') }))

const { obtenerConfig, obtenerConfigAdmin, obtenerConfigRow } = await import('./config-repo')

beforeEach(() => {
  sql.length = 0
  filaConfig = { id: 'c1', tenant_id: 't1', moneda: 'MXN', iva_tasas: [16], loop_seg: 60, spot_seg: 10 }
  filaTenant = { nombre: 'G500', razon_social: 'G500 SA de CV', nombre_comercial: 'G500' }
})

describe('obtenerConfigRow — aislamiento', () => {
  it('filtra por tenant_id, nunca lee «la primera fila»', async () => {
    await obtenerConfigRow()
    const lectura = sql.find((s) => s.includes('from config_negocio'))
    expect(lectura).toContain('tenant_id = $1')
    // `limit 1` a secas es exactamente el bug: devolvía la fila de otro.
    expect(lectura).not.toMatch(/from config_negocio\s+limit 1/)
  })

  it('si al tenant le falta su fila, la crea PARA ÉL', async () => {
    filaConfig = null
    await obtenerConfigRow()
    const insert = sql.find((s) => s.includes('insert into config_negocio'))
    expect(insert).toContain('tenant_id')
    // Antes sembraba el literal 'RGB Catorce' y una organización nueva nacía
    // llamándose como otra empresa.
    expect(insert).not.toMatch(/nombre_tenant/)
  })
})

describe('el nombre de la organización tiene UNA fuente', () => {
  it('obtenerConfig lo toma de tenants', async () => {
    const cfg = await obtenerConfig()
    expect(cfg.nombreTenant).toBe('G500')
  })

  it('obtenerConfigAdmin devuelve EL MISMO nombre', async () => {
    // La contradicción de M5 en una línea: si estas dos difieren, el sidebar y
    // la pantalla de Configuración vuelven a decir cosas distintas.
    const [app, admin] = [await obtenerConfig(), await obtenerConfigAdmin()]
    expect(admin.nombreTenant).toBe(app.nombreTenant)
  })

  it('sin tenant resuelto no se inventa un nombre', async () => {
    filaTenant = null
    expect((await obtenerConfig()).nombreTenant).toBe('')
  })

  it('los ajustes de negocio siguen saliendo de la fila del tenant', async () => {
    const cfg = await obtenerConfig()
    expect(cfg.moneda).toBe('MXN')
    expect(cfg.ivaTasas).toEqual([16])
    expect(cfg.loopSeg).toBe(60)
  })
})
