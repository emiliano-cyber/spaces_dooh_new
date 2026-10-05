import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  TOPE-03 · aprobar y aceptar revisan el tope VIGENTE, no el de cuando se
//  guardó el descuento.
// ----------------------------------------------------------------------------
//  El tope se valida al ESCRIBIR el descuento (`actualizarPropuesta`) y al
//  quitar un paquete (`quitarPaquete`). Pero si Administración BAJA el tope
//  después, ni la aprobación interna ni la aceptación del cliente por la liga
//  lo volvían a mirar, y el descuento por encima del techo vigente se
//  congelaba en el snapshot.
//
//  Aquí, con la base simulada: las dos puertas se niegan con
//  `TopeVigenteError` y no escriben nada; con el descuento dentro del tope
//  siguen funcionando; con 0 % comercial no hay nada que revisar; y la cuenta
//  es LA MISMA que la de la edición (volumen sí, salvo con paquete).
//
//  La demostración contra Postgres es `lib/test/tope-descuento.e2e.test.ts`.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []
const respuestas: Record<string, any[]> = {}

function responder(sql: string): any[] {
  if (/config_negocio/.test(sql)) return respuestas.config ?? []
  if (/propuesta_items/.test(sql)) return respuestas.items ?? []
  if (/^\s*select[\s\S]*from propuestas/i.test(sql)) return respuestas.propuesta ?? []
  if (/^\s*update propuestas/i.test(sql)) return respuestas.update ?? respuestas.propuesta ?? []
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
const tope = { valor: 100 }
vi.mock('./config-repo', () => ({ topeDescuentoDelTenant: vi.fn(async () => tope.valor) }))

const repo: any = await import('./propuestas-repo')
const { aceptarPropuestaPublica, cambiarEstatusPropuesta, PropuestaError } = repo

const PROP = {
  id: 'P1',
  tenant_id: 'T1',
  folio: 'PR-2026-0001',
  token_publico: 'tok',
  nombre: 'Con descuento',
  estatus: 'ENVIADA',
  agencia_id: null,
  comision_pct: 0,
  descuento_pct: '40.00',
  cliente_iva: 16,
  version: 1,
  codigo_texto: null,
  codigo_descuento_pct: 0,
  codigo_estado: null,
  paquete_nombre: null,
  paquete_precio: null,
  paquete_admite_codigo: false,
  aceptado_en: null,
  aceptado_por: null,
}

const ITEM = {
  id: 'I1',
  propuesta_id: 'P1',
  sitio_id: 'S1',
  precio: 100_000,
  aprobado: true,
  descuento_volumen_pct: 0,
  base: 60_000,
}

/** El tope que lee la aceptación DENTRO de su transacción, con el tenant del token. */
function topeEnBase(pct: number) {
  respuestas.config = [{ tope_descuento_pct: String(pct) }]
}

beforeEach(() => {
  consultas.length = 0
  respuestas.propuesta = [{ ...PROP }]
  respuestas.items = [{ ...ITEM }]
  respuestas.update = undefined as any
  respuestas.config = []
  tope.valor = 100
})

const escribioAprobada = () =>
  consultas.some((c) => /update propuestas[\s\S]*estatus\s*=\s*('APROBADA'|\$2)/i.test(c.sql))

describe('1 · aprobar por dentro con el tope BAJADO', () => {
  it('→ TopeVigenteError (un PropuestaError), con el tope y el descuento, y no se escribe nada', async () => {
    tope.valor = 10
    expect(repo.TopeVigenteError, 'falta la clase TopeVigenteError').toBeDefined()
    const e = await cambiarEstatusPropuesta('P1', 'APROBADA', { confirmarCero: true }).catch(
      (x: unknown) => x,
    )
    expect(e).toBeInstanceOf(repo.TopeVigenteError)
    expect(e).toBeInstanceOf(PropuestaError)
    expect(String((e as Error).message)).toMatch(/40 %/)
    expect(String((e as Error).message)).toMatch(/10 %/)
    expect(String((e as Error).message)).toMatch(/[Aa]justa el descuento/)
    expect(escribioAprobada()).toBe(false)
    expect(consultas.some((c) => /update propuesta_items set aprobado/.test(c.sql))).toBe(false)
  })

  it('la lectura del descuento y de las líneas lleva tenant_id', async () => {
    tope.valor = 10
    await cambiarEstatusPropuesta('P1', 'APROBADA', { confirmarCero: true }).catch(() => null)
    const lect = consultas.find((c) =>
      /select[\s\S]*descuento_pct[\s\S]*from propuestas[\s\S]*tenant_id/i.test(c.sql),
    )
    expect(lect, 'la propuesta no se leyó con tenant_id').toBeDefined()
    const lin = consultas.find((c) => /select[\s\S]*descuento_volumen_pct[\s\S]*from propuesta_items/i.test(c.sql))
    expect(lin?.sql).toMatch(/tenant_id\s*=\s*\$2/)
  })

  it('con el descuento DENTRO del tope vigente aprueba como siempre', async () => {
    tope.valor = 40
    respuestas.update = [{ ...PROP, estatus: 'APROBADA' }]
    const r = await cambiarEstatusPropuesta('P1', 'APROBADA', { confirmarCero: true })
    expect(r?.estatus).toBe('APROBADA')
  })

  it('el VOLUMEN cuenta, igual que al editar: 10 % volumen + 25 % comercial = 32,5 % > 30', async () => {
    tope.valor = 30
    respuestas.propuesta = [{ ...PROP, descuento_pct: '25.00' }]
    respuestas.items = [{ ...ITEM, descuento_volumen_pct: 10 }]
    const e = await cambiarEstatusPropuesta('P1', 'APROBADA', { confirmarCero: true }).catch(
      (x: unknown) => x,
    )
    expect(e).toBeInstanceOf(repo.TopeVigenteError)
    expect(String((e as Error).message)).toMatch(/32\.5 %/)
  })

  it('con PAQUETE el volumen no cuenta, igual que al editar', async () => {
    tope.valor = 30
    respuestas.propuesta = [
      { ...PROP, descuento_pct: '25.00', paquete_nombre: 'Combo', paquete_precio: 90_000 },
    ]
    respuestas.items = [{ ...ITEM, descuento_volumen_pct: 10 }]
    respuestas.update = [{ ...PROP, estatus: 'APROBADA' }]
    const r = await cambiarEstatusPropuesta('P1', 'APROBADA', { confirmarCero: true })
    expect(r?.estatus).toBe('APROBADA')
  })

  it('con 0 % comercial no hay discreción que revisar: aprueba aunque el volumen solo pase el tope', async () => {
    tope.valor = 5
    respuestas.propuesta = [{ ...PROP, descuento_pct: '0' }]
    respuestas.items = [{ ...ITEM, descuento_volumen_pct: 10 }]
    respuestas.update = [{ ...PROP, estatus: 'APROBADA' }]
    const r = await cambiarEstatusPropuesta('P1', 'APROBADA', { confirmarCero: true })
    expect(r?.estatus).toBe('APROBADA')
  })

  it('pasar a ENVIADA o RECHAZADA no revisa el tope', async () => {
    tope.valor = 10
    respuestas.update = [{ ...PROP, estatus: 'RECHAZADA' }]
    const r = await cambiarEstatusPropuesta('P1', 'RECHAZADA')
    expect(r?.estatus).toBe('RECHAZADA')
  })
})

describe('2 · el cliente acepta por la liga con el tope BAJADO', () => {
  it('→ TopeVigenteError SIN decirle al cliente el tope interno, y rollback sin escribir', async () => {
    topeEnBase(10)
    const e = await aceptarPropuestaPublica('tok', { nombre: 'Cliente Uno', ip: null }).catch(
      (x: unknown) => x,
    )
    expect(e).toBeInstanceOf(repo.TopeVigenteError)
    expect(e).toBeInstanceOf(PropuestaError)
    const msg = String((e as Error).message)
    expect(msg).not.toMatch(/10 %/)
    expect(msg).toMatch(/ejecutivo/)
    const sqls = consultas.map((c) => c.sql)
    expect(sqls.some((s) => /set estatus='APROBADA'/.test(s))).toBe(false)
    expect(sqls.some((s) => /^\s*rollback/i.test(s))).toBe(true)
    expect(sqls.some((s) => /^\s*commit/i.test(s))).toBe(false)
  })

  it('el tope se lee DENTRO de la transacción, con el tenant del token, después de bloquear la propuesta', async () => {
    topeEnBase(10)
    await aceptarPropuestaPublica('tok', { nombre: 'Cliente Uno', ip: null }).catch(() => null)
    const sqls = consultas.map((c) => c.sql)
    const i = (re: RegExp) => sqls.findIndex((s) => re.test(s))
    const iBegin = i(/^\s*begin/i)
    const iLock = i(/select[\s\S]*descuento_pct[\s\S]*from propuestas[\s\S]*for no key update/i)
    const iTope = i(/config_negocio/)
    expect(iLock, 'la propuesta no se leyó con bloqueo').toBeGreaterThan(iBegin)
    expect(iTope, 'el tope no se leyó en la transacción').toBeGreaterThan(iLock)
    const tq = consultas[iTope]
    expect(tq.sql).toMatch(/tenant_id\s*=\s*\$1/)
    expect(tq.params[0]).toBe('T1')
  })

  it('con el descuento DENTRO del tope vigente acepta como siempre', async () => {
    topeEnBase(40)
    respuestas.update = [{ estatus: 'APROBADA', aceptado_en: new Date(), aceptado_por: 'Cliente Uno' }]
    const r = await aceptarPropuestaPublica('tok', { nombre: 'Cliente Uno', ip: null })
    expect(r?.ok).toBe(true)
    expect(r?.yaAceptada).toBe(false)
  })

  it('sin fila de configuración manda el respaldo del 100 %: acepta', async () => {
    respuestas.config = []
    respuestas.update = [{ estatus: 'APROBADA', aceptado_en: new Date(), aceptado_por: 'Cliente Uno' }]
    const r = await aceptarPropuestaPublica('tok', { nombre: 'Cliente Uno', ip: null })
    expect(r?.ok).toBe(true)
  })
})

describe('3 · TOPE-04 · el volumen SOLO pasa el tope: la edición deja 0 % comercial', () => {
  // Tope bajado a 5 % con una escala que da 10 % de volumen. Antes la edición
  // rechazaba incluso 0 %, y la aprobación pedía «ajustar» algo que no tenía
  // ningún valor posible. Mismo criterio que aprobar y quitarPaquete.
  const escribioDescuento = () =>
    consultas.some((c) => /update propuestas set[\s\S]*descuento_pct=/i.test(c.sql))

  beforeEach(() => {
    tope.valor = 5
    respuestas.propuesta = [{ ...PROP, descuento_pct: '5.00' }]
    respuestas.items = [{ ...ITEM, descuento_volumen_pct: 10 }]
  })

  it('guardar 0 % comercial SE GUARDA', async () => {
    const r = await repo.actualizarPropuesta('P1', { descuentoPct: 0 })
    expect(r).not.toBeNull()
    expect(r.descuentoAplicado).toBe(0)
    expect(escribioDescuento()).toBe(true)
  })

  it('con comercial > 0 sigue rechazando, con la salida real y sin escribir', async () => {
    const e = await repo.actualizarPropuesta('P1', { descuentoPct: 5 }).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(Error)
    expect(String((e as Error).message)).toMatch(
      /descuento por volumen \(10 %\) ya supera el tope \(5 %\): deja el descuento comercial en 0 %/,
    )
    expect(escribioDescuento()).toBe(false)
  })

  it('aprobar con comercial > 0 dice la misma salida, no «Ajusta el descuento»', async () => {
    const e = await cambiarEstatusPropuesta('P1', 'APROBADA', { confirmarCero: true }).catch(
      (x: unknown) => x,
    )
    expect(e).toBeInstanceOf(repo.TopeVigenteError)
    const msg = String((e as Error).message)
    expect(msg).toMatch(/deja el descuento comercial en 0 % o pide a Administración que suba el tope/)
    expect(msg).not.toMatch(/Ajusta el descuento/)
    expect(escribioAprobada()).toBe(false)
  })
})
