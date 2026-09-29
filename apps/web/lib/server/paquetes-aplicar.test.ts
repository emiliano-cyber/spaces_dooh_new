import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  APLICAR Y QUITAR UN PAQUETE — ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  Aplicar un paquete es lo único de las cuatro fases que SUSTITUYE el precio
//  de una venta entera, así que lo que se prueba aquí son sobre todo los
//  NEGATIVOS: qué se niega a hacer y por qué.
//
//  El más importante, y el que define la fase: **el precio se COPIA a la
//  propuesta**. A partir de ese instante la venta no depende del catálogo. Lo
//  que se congela son cinco cosas —nombre, precio, bandera, momento y
//  composición— y las cinco se escriben JUNTAS, porque el CHECK
//  `propuestas_paquete_pareja_ck` rechazaría dejar una sin las otras.
//
//  Se mockea `./db`: esto mira las sentencias que salen, no lo que Postgres
//  hace con ellas. La RLS y el aislamiento real están en las e2e.
// ============================================================================

const ejecutadas: { sql: string; params: unknown[] }[] = []
const filas: Record<string, any[]> = {}

function responder(sql: string): any[] {
  if (/from propuestas/.test(sql)) return filas.propuesta ?? []
  if (/from paquete_sitios/.test(sql)) return filas.paqueteSitios ?? []
  if (/from paquetes/.test(sql)) return filas.paquete ?? []
  if (/from propuesta_items/.test(sql)) return filas.items ?? []
  return []
}

const client = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    ejecutadas.push({ sql, params: params ?? [] })
    return { rows: responder(sql) }
  }),
  release: vi.fn(),
}

vi.mock('./db', () => ({
  q: vi.fn(async (sql: string, params?: unknown[]) => {
    ejecutadas.push({ sql, params: params ?? [] })
    return responder(sql)
  }),
  q1: vi.fn(async (sql: string, params?: unknown[]) => {
    ejecutadas.push({ sql, params: params ?? [] })
    return responder(sql)[0] ?? null
  }),
  pool: { connect: vi.fn(async () => client) },
  fijarTenant: vi.fn(),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./auth', () => ({ usuarioActual: vi.fn(async () => ({ id: 'U1' })) }))

const { aplicarPaquete, quitarPaquete, PaqueteImposible } = await import('./paquetes-repo')

const PAQUETE = {
  id: 'PK1',
  nombre: 'Periferico',
  precio_cerrado: '180000.00',
  admite_codigo: false,
  activo: true,
}

const SITIOS = ['S1', 'S2', 'S3']

beforeEach(() => {
  ejecutadas.length = 0
  client.query.mockClear()
  filas.propuesta = [{ id: 'P1', estatus: 'BORRADOR', codigo_texto: null, paquete_nombre: null }]
  filas.paquete = [{ ...PAQUETE }]
  filas.paqueteSitios = SITIOS.map((s) => ({ sitio_id: s }))
  filas.items = SITIOS.map((s, i) => ({ id: `I${i}`, sitio_id: s }))
})

const sql = () => ejecutadas.map((e) => e.sql).join('\n---\n')

describe('1 · el precio se COPIA a la propuesta', () => {
  it('escribe nombre, precio, bandera, momento y composición JUNTOS', async () => {
    await aplicarPaquete('P1', 'PK1')
    const upd = ejecutadas.find((e) => /update propuestas/.test(e.sql))
    expect(upd).toBeTruthy()
    expect(upd!.sql).toMatch(/paquete_nombre/)
    expect(upd!.sql).toMatch(/paquete_precio/)
    expect(upd!.sql).toMatch(/paquete_admite_codigo/)
    expect(upd!.sql).toMatch(/paquete_aplicado_en\s*=\s*now\(\)/)
    expect(upd!.sql).toMatch(/paquete_composicion/)
    // Y el precio que se copia es el del catálogo, no uno que llegue de fuera.
    expect(upd!.params).toContain('Periferico')
    expect(upd!.params).toContain(180000)
  })

  it('la COMPOSICIÓN que se congela son las pantallas del PAQUETE', async () => {
    const devuelto = await aplicarPaquete('P1', 'PK1')
    expect(devuelto.composicion).toEqual(SITIOS)
    const upd = ejecutadas.find((e) => /update propuestas/.test(e.sql))!
    // Viaja como texto JSON hacia la columna `jsonb`, no como arreglo de `pg`.
    expect(upd.params).toContain(JSON.stringify(SITIOS))
  })

  it('deja el ENLACE VIVO en `paquete_aplicaciones`, con quién lo aplicó', async () => {
    await aplicarPaquete('P1', 'PK1')
    const ins = ejecutadas.find((e) => /insert into paquete_aplicaciones/.test(e.sql))
    expect(ins).toBeTruthy()
    // El usuario sale de la SESIÓN, nunca del cuerpo. Mismo candado que el
    // vendedor de VEND-01 y el canje de COD-01.
    expect(ins!.params).toContain('U1')
  })

  it('todas las consultas llevan `tenant_id` como segunda capa sobre la RLS', async () => {
    await aplicarPaquete('P1', 'PK1')
    for (const e of ejecutadas) {
      if (/^\s*select|^\s*update|^\s*delete/i.test(e.sql.trim())) {
        expect(e.sql).toMatch(/tenant_id/)
      }
    }
  })
})

describe('2 · los NEGATIVOS, que son el corazón de la fase', () => {
  it('un paquete de OTRA organización NO EXISTE para ti', async () => {
    filas.paquete = []
    await expect(aplicarPaquete('P1', 'PK-AJENO')).rejects.toBeInstanceOf(PaqueteImposible)
    await expect(aplicarPaquete('P1', 'PK-AJENO')).rejects.toThrow(/no existe/i)
  })

  it('una propuesta APROBADA es inmutable', async () => {
    filas.propuesta = [{ id: 'P1', estatus: 'APROBADA', codigo_texto: null, paquete_nombre: null }]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/aprobada/i)
  })

  it('un paquete DESACTIVADO no se puede vender', async () => {
    filas.paquete = [{ ...PAQUETE, activo: false }]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/desactivado|no esta activo/i)
  })

  it('DOS paquetes en la misma propuesta, no', async () => {
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: null, paquete_nombre: 'Otro' },
    ]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/ya tiene/i)
  })

  it('las pantallas de la propuesta tienen que ser las del paquete', async () => {
    filas.items = [{ id: 'I0', sitio_id: 'S1' }, { id: 'I1', sitio_id: 'S9' }]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/pantalla/i)
  })

  it('un paquete que NO admite código se niega si la propuesta ya tiene uno', async () => {
    // Regla 2 del ADR: el paquete es precio final. Dejarlo pasar en silencio
    // retendría el uso del cupón sin descontarlo, que es peor que negarse.
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: 'VERANO20', paquete_nombre: null },
    ]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/codigo|código/i)
  })

  it('pero SÍ se aplica si el paquete admite código', async () => {
    filas.paquete = [{ ...PAQUETE, admite_codigo: true }]
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: 'VERANO20', paquete_nombre: null },
    ]
    await expect(aplicarPaquete('P1', 'PK1')).resolves.toBeTruthy()
  })

  it('una propuesta que no existe aquí, no', async () => {
    filas.propuesta = []
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/no existe/i)
  })
})

describe('3 · quitar el paquete DEVUELVE los precios de línea', () => {
  beforeEach(() => {
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: null, paquete_nombre: 'Periferico' },
    ]
  })

  it('limpia las cinco columnas JUNTAS', async () => {
    const ok = await quitarPaquete('P1')
    expect(ok).toBe(true)
    const upd = ejecutadas.find((e) => /update propuestas/.test(e.sql))!
    expect(upd.sql).toMatch(/paquete_nombre\s*=\s*null/)
    expect(upd.sql).toMatch(/paquete_precio\s*=\s*null/)
    expect(upd.sql).toMatch(/paquete_admite_codigo\s*=\s*false/)
    expect(upd.sql).toMatch(/paquete_aplicado_en\s*=\s*null/)
    expect(upd.sql).toMatch(/paquete_composicion\s*=\s*null/)
  })

  it('borra el enlace vivo', async () => {
    await quitarPaquete('P1')
    expect(sql()).toMatch(/delete from paquete_aplicaciones/)
  })

  it('NO toca el descuento por volumen de las líneas', async () => {
    // Quitar el paquete tiene que devolver la venta EXACTAMENTE a como estaba,
    // y el volumen de cada línea nunca se borró: solo se dejó de aplicar.
    await quitarPaquete('P1')
    expect(sql()).not.toMatch(/descuento_volumen_pct/)
  })

  it('una propuesta APROBADA no se puede desempaquetar', async () => {
    filas.propuesta = [
      { id: 'P1', estatus: 'APROBADA', codigo_texto: null, paquete_nombre: 'Periferico' },
    ]
    await expect(quitarPaquete('P1')).rejects.toThrow(/aprobada/i)
  })

  it('sin paquete puesto devuelve `false`, no revienta', async () => {
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: null, paquete_nombre: null },
    ]
    await expect(quitarPaquete('P1')).resolves.toBe(false)
  })

  it('una propuesta de otra organización devuelve `false`', async () => {
    filas.propuesta = []
    await expect(quitarPaquete('P1')).resolves.toBe(false)
  })
})
