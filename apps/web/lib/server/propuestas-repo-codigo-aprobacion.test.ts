import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  COD-03 · lo que el CLIENTE ve y firma con un cupón PENDIENTE.
// ----------------------------------------------------------------------------
//  Las tres reglas que deciden si el dinero cuadra, con la base simulada:
//
//   1. `obtenerPropuestaPublica` con PENDIENTE no lleva el código NI el total
//      con él. Se filtra en el SERVIDOR: esconderlo en la pantalla dejaría el
//      `codigoTexto` viajando en el JSON, a una pestaña de las herramientas
//      del navegador.
//   2. Si el cliente acepta con PENDIENTE, el cupón se quita y su uso se
//      devuelve DENTRO de la transacción de la aceptación — antes del commit,
//      y por tanto antes de congelar el snapshot, que se congela después.
//   3. Aprobar por dentro con PENDIENTE es un 409 con la frase del dueño.
//
//  La demostración contra Postgres —JSON real, cuenta de canjes, snapshot— es
//  `lib/test/codigo-aprobacion.e2e.test.ts`.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []
const respuestas: Record<string, any[]> = {}

// Mismo orden que `propuestas-repo-paquete.test.ts`, y por el mismo motivo: la
// lectura de la propuesta lleva `(select iva_pct from clientes …)` dentro.
function responder(sql: string): any[] {
  if (/propuesta_items/.test(sql)) return respuestas.items ?? []
  if (/^\s*select[\s\S]*from propuestas/i.test(sql)) return respuestas.propuesta ?? []
  if (/^\s*update propuestas/i.test(sql)) return respuestas.update ?? respuestas.propuesta ?? []
  if (/from clientes/.test(sql)) return respuestas.cliente ?? []
  return []
}

const clienteFalso = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return { rows: responder(sql) }
  }),
  release: vi.fn(),
} as unknown as PoolClient

const db = {
  pool: { connect: vi.fn(async () => clienteFalso) },
  q: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql)
  }),
  q1: vi.fn(async (sql: string, params?: unknown[]): Promise<any> => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql)[0] ?? null
  }),
  qConTenant: vi.fn(async (_t: string, sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql)
  }),
  qRaw1: vi.fn(async () => ({ tenant: 'T1' })),
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
}
vi.mock('./db', () => db)
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./auth', () => ({ usuarioActual: vi.fn(async () => ({ id: 'U1' })) }))
vi.mock('./folios', () => ({ folioDocumento: vi.fn(async () => 'PR-2026-0001') }))
vi.mock('./config-repo', () => ({ topeDescuentoDelTenant: vi.fn(async () => 100) }))

const {
  obtenerPropuestaPublica,
  aceptarPropuestaPublica,
  cambiarEstatusPropuesta,
  listarPropuestas,
  CodigoPendienteError,
} = await import('./propuestas-repo')

const PROP = {
  id: 'P1',
  tenant_id: 'T1',
  folio: 'PR-2026-0001',
  token_publico: 'tok',
  nombre: 'Con cupon',
  estatus: 'ENVIADA',
  comision_pct: 0,
  descuento_pct: 0,
  cliente_iva: 16,
  version: 1,
  codigo_texto: 'VERANO20',
  codigo_descuento_pct: '20.00',
  codigo_canjeado_en: new Date('2026-09-30T10:00:00Z'),
  codigo_estado: 'PENDIENTE',
  codigo_aprobado_por: null,
  codigo_aprobado_en: null,
  paquete_nombre: null,
  paquete_precio: null,
  aceptado_en: null,
  aceptado_por: null,
}

const ITEM = {
  id: 'I1',
  propuesta_id: 'P1',
  sitio_id: 'S1',
  precio: 100_000,
  tarifa_unitaria: 100_000,
  cantidad: 1,
  unidad: 'spot',
  fecha_inicio: '2026-10-05',
  fecha_fin: '2026-11-04',
  aprobado: true,
  franja_id: null,
  descuento_volumen_pct: 0,
  volumen_desde: null,
}

beforeEach(() => {
  consultas.length = 0
  respuestas.propuesta = [{ ...PROP }]
  respuestas.items = [{ ...ITEM }]
  respuestas.update = undefined as any
  respuestas.cliente = []
})

describe('1 · la liga pública con el cupón PENDIENTE', () => {
  it('NO lleva el código, ni su porcentaje, ni su monto', async () => {
    const pub: any = await obtenerPropuestaPublica('tok')
    expect(pub.codigoTexto).toBeNull()
    expect(pub.codigoDescuentoPct).toBe(0)
    expect(pub.codigoDescuentoMonto).toBe(0)
    // Y en ninguna parte del JSON: ni con otro nombre.
    expect(JSON.stringify(pub)).not.toContain('VERANO20')
  })

  it('el total sale SIN el descuento', async () => {
    const pub: any = await obtenerPropuestaPublica('tok')
    expect(pub.base).toBe(100_000)
    expect(pub.total).toBe(116_000)
  })

  it('con el cupón APROBADO, la liga lo lleva y el total baja', async () => {
    respuestas.propuesta = [{ ...PROP, codigo_estado: 'APROBADO', codigo_aprobado_en: new Date() }]
    const pub: any = await obtenerPropuestaPublica('tok')
    expect(pub.codigoTexto).toBe('VERANO20')
    expect(pub.codigoDescuentoMonto).toBe(20_000)
    expect(pub.base).toBe(80_000)
  })

  it('la lista INTERNA sí sigue contando el cupón pendiente, y dice que está pendiente', async () => {
    // Decisión del encargo: los totales internos NO cambian de cálculo. Lo que
    // cambia es que la pantalla interna sabe que está pendiente.
    const [p]: any = await listarPropuestas()
    expect(p.codigoTexto).toBe('VERANO20')
    expect(p.base).toBe(80_000)
    expect(p.codigoEstado).toBe('PENDIENTE')
  })
})

describe('2 · el cliente ACEPTA con el cupón PENDIENTE', () => {
  it('se quita el cupón y se devuelve el uso DENTRO de la transacción, antes del commit', async () => {
    const r = await aceptarPropuestaPublica('tok', { nombre: 'Cliente Uno', ip: '1.2.3.4' })
    expect(r?.ok).toBe(true)
    const sqls = consultas.map((c) => c.sql)
    const i = (re: RegExp) => sqls.findIndex((s) => re.test(s))
    const iBegin = i(/^\s*begin/i)
    const iLock = i(/select[\s\S]*codigo_estado[\s\S]*from propuestas[\s\S]*for no key update/i)
    const iDel = i(/delete from canjes_codigo/)
    const iLimpia = i(/update propuestas[\s\S]*codigo_texto\s*=\s*null/)
    const iAprob = i(/set estatus='APROBADA'/)
    const iLog = i(/insert into acciones/)
    const iCommit = i(/^\s*commit/i)
    expect(iLock, 'la fila no se bloqueó').toBeGreaterThan(iBegin)
    expect(iDel, 'no se devolvió el uso').toBeGreaterThan(iLock)
    expect(iLimpia).toBeGreaterThan(iLock)
    expect(iLimpia).toBeLessThan(iAprob)
    expect(iLog).toBeGreaterThan(-1)
    expect(iLog).toBeLessThan(iCommit)
    expect(iAprob).toBeLessThan(iCommit)
    // El delete lleva el tenant como segunda capa.
    expect(sqls[iDel]).toMatch(/tenant_id\s*=\s*\$2/)
  })

  it('con el cupón APROBADO no se quita nada', async () => {
    respuestas.propuesta = [{ ...PROP, codigo_estado: 'APROBADO', codigo_aprobado_en: new Date() }]
    await aceptarPropuestaPublica('tok', { nombre: 'Cliente Uno', ip: null })
    expect(consultas.some((c) => /delete from canjes_codigo/.test(c.sql))).toBe(false)
  })

  it('sin cupón no se quita nada', async () => {
    respuestas.propuesta = [{ ...PROP, codigo_texto: null, codigo_descuento_pct: 0, codigo_canjeado_en: null, codigo_estado: null }]
    await aceptarPropuestaPublica('tok', { nombre: 'Cliente Uno', ip: null })
    expect(consultas.some((c) => /delete from canjes_codigo/.test(c.sql))).toBe(false)
  })
})

describe('3 · aprobar POR DENTRO con el cupón PENDIENTE', () => {
  it('→ CodigoPendienteError con la frase del dueño, y no se toca el estatus', async () => {
    await expect(cambiarEstatusPropuesta('P1', 'APROBADA')).rejects.toThrow(CodigoPendienteError)
    await expect(cambiarEstatusPropuesta('P1', 'APROBADA')).rejects.toThrow(
      /Primero aprueba o rechaza el código promocional/,
    )
    expect(consultas.some((c) => /update propuestas set estatus/.test(c.sql))).toBe(false)
  })

  it('la lectura del estado del cupón lleva tenant_id', async () => {
    await expect(cambiarEstatusPropuesta('P1', 'APROBADA')).rejects.toThrow()
    const lect = consultas.find((c) => /select[\s\S]*codigo_estado[\s\S]*from propuestas/i.test(c.sql))
    expect(lect?.sql).toMatch(/tenant_id\s*=\s*\$2/)
  })

  it('pasar a ENVIADA o RECHAZADA con PENDIENTE sí se puede', async () => {
    respuestas.update = [{ ...PROP, estatus: 'ENVIADA' }]
    const r = await cambiarEstatusPropuesta('P1', 'ENVIADA')
    expect(r?.estatus).toBe('ENVIADA')
  })
})
