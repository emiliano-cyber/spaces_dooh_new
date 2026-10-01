import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  COD-03 · el cupón nace PENDIENTE y lo aprueba un gerente.  Lo que se fija
//  aquí, con la base SIMULADA, es el ORDEN y la FORMA de lo que el servidor
//  escribe; lo que solo Postgres puede demostrar (la RLS, el JSON público de
//  verdad, la cuenta de canjes) está en `lib/test/codigo-aprobacion.e2e.test.ts`.
//
//   · el canje escribe `codigo_estado='PENDIENTE'` en el MISMO update que el
//     cupón, y si la propuesta estaba RECHAZADA la pasa a BORRADOR DENTRO de
//     la misma transacción, con su línea en `acciones`;
//   · la decisión bloquea la fila de la propuesta, solo decide sobre
//     PENDIENTE, y rechazar devuelve el uso (borra el canje) con su motivo;
//   · el esquema de la decisión es `.strict()`: no entra ni un campo de más.
// ============================================================================

const ejecutadas: { sql: string; params: unknown[] }[] = []
const respuestas: Record<string, any[]> = {}
let confirmada = false
let revertida = false

function responder(sql: string): any[] {
  if (/^\s*select[\s\S]*from propuestas/i.test(sql)) return respuestas.propuesta ?? []
  if (/from codigos_promocionales/.test(sql)) return respuestas.cupon ?? []
  if (/count\(\*\)[\s\S]*from canjes_codigo/.test(sql)) return respuestas.conteo ?? [{ n: 0 }]
  if (/^\s*update propuestas/i.test(sql)) return respuestas.update ?? [{ id: 'P1' }]
  return []
}

const cliente = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    ejecutadas.push({ sql, params })
    if (/^\s*commit/i.test(sql)) confirmada = true
    if (/^\s*rollback/i.test(sql)) revertida = true
    const rows = responder(sql)
    return { rows, rowCount: rows.length }
  }),
  release: vi.fn(),
}

vi.mock('./db', () => ({
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
  pool: { connect: vi.fn(async () => cliente) },
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
  qConTenant: vi.fn(async () => []),
  qRaw1: vi.fn(async () => null),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./auth', () => ({ usuarioActual: vi.fn(async () => ({ id: 'U1', nombre: 'Ana Gerente' })) }))

const { canjearCodigo, decidirCodigo, quitarCodigo, DecisionImposible } = await import('./codigos-repo')
const { decidirCodigoCtrl } = await import('./codigos-controller')

const CUPON = {
  id: 'C1',
  codigo: 'VERANO20',
  descuento_pct: 20,
  vigente_desde: '2026-09-01',
  vigente_hasta: '2026-10-31',
  usos_maximos: 3,
  hoy: '2026-09-30',
}

const sqls = () => ejecutadas.map((e) => e.sql)
const idx = (re: RegExp) => sqls().findIndex((s) => re.test(s))

beforeEach(() => {
  ejecutadas.length = 0
  confirmada = false
  revertida = false
  respuestas.propuesta = [{ estatus: 'BORRADOR', codigo_texto: null }]
  respuestas.cupon = [{ ...CUPON }]
  respuestas.conteo = [{ n: 0 }]
  respuestas.update = [{ id: 'P1' }]
})

describe('1 · el canje deja el cupón PENDIENTE', () => {
  it('el mismo update que congela el cupón escribe PENDIENTE y limpia la aprobación', async () => {
    const r = await canjearCodigo('P1', 'VERANO20')
    expect(r.estado).toBe('PENDIENTE')
    const upd = sqls().find((s) => /update propuestas[\s\S]*codigo_texto=/.test(s)) ?? ''
    expect(upd).toMatch(/codigo_estado\s*=\s*'PENDIENTE'/)
    expect(upd).toMatch(/codigo_aprobado_por\s*=\s*null/)
    expect(upd).toMatch(/codigo_aprobado_en\s*=\s*null/)
    expect(upd).toMatch(/tenant_id\s*=\s*\$\d/)
  })

  it('la propuesta se lee BLOQUEADA, antes que el cupón', async () => {
    // Sin el bloqueo, aprobar la propuesta por dentro podría colarse entre la
    // lectura del estatus y el update del canje, y quedaría APROBADA con un
    // cupón PENDIENTE congelado en el snapshot.
    await canjearCodigo('P1', 'VERANO20')
    const iProp = idx(/select[\s\S]*from propuestas[\s\S]*for no key update/i)
    const iCup = idx(/from codigos_promocionales[\s\S]*for update/i)
    expect(iProp).toBeGreaterThan(-1)
    expect(iProp).toBeLessThan(iCup)
  })

  it('en BORRADOR no cambia el estatus ni anota reactivación', async () => {
    const r = await canjearCodigo('P1', 'VERANO20')
    expect(r.reactivada).toBe(false)
    expect(sqls().some((s) => /set estatus\s*=\s*'BORRADOR'/.test(s))).toBe(false)
    expect(sqls().some((s) => /insert into acciones/.test(s))).toBe(false)
  })

  it('⚠️ RECHAZADA + cupón → BORRADOR, DENTRO de la transacción del canje', async () => {
    respuestas.propuesta = [{ estatus: 'RECHAZADA', codigo_texto: null }]
    const r = await canjearCodigo('P1', 'VERANO20')
    expect(r.reactivada).toBe(true)
    const iBegin = idx(/^\s*begin/i)
    const iCanje = idx(/insert into canjes_codigo/)
    const iReact = idx(/update propuestas[\s\S]*estatus\s*=\s*'BORRADOR'/)
    const iLog = idx(/insert into acciones/)
    const iCommit = idx(/^\s*commit/i)
    expect(iReact, 'no se reactivó').toBeGreaterThan(-1)
    expect(iBegin).toBeLessThan(iReact)
    expect(iCanje).toBeLessThan(iCommit)
    expect(iReact).toBeLessThan(iCommit)
    expect(iLog).toBeGreaterThan(-1)
    expect(iLog).toBeLessThan(iCommit)
    expect(ejecutadas[iLog].params).toContain('Reactivó la propuesta con el código VERANO20')
    expect(confirmada).toBe(true)
  })

  it('si el canje falla, la RECHAZADA NO se reactiva', async () => {
    respuestas.propuesta = [{ estatus: 'RECHAZADA', codigo_texto: null }]
    respuestas.conteo = [{ n: 3 }]
    await expect(canjearCodigo('P1', 'VERANO20')).rejects.toThrow(/ya se uso/i)
    expect(sqls().some((s) => /estatus\s*=\s*'BORRADOR'/.test(s))).toBe(false)
    expect(revertida).toBe(true)
  })
})

describe('2 · la decisión', () => {
  it('bloquea la fila de la propuesta y aprueba solo si sigue PENDIENTE', async () => {
    respuestas.propuesta = [
      { estatus: 'ENVIADA', codigo_texto: 'VERANO20', codigo_descuento_pct: 20, codigo_estado: 'PENDIENTE', nombre: 'X' },
    ]
    const r = await decidirCodigo('P1', { decision: 'APROBAR' })
    expect(r?.decision).toBe('APROBAR')
    const lectura = sqls().find((s) => /select[\s\S]*from propuestas/i.test(s)) ?? ''
    expect(lectura).toMatch(/for no key update/i)
    expect(lectura).toMatch(/tenant_id\s*=\s*\$2/)
    const upd = sqls().find((s) => /update propuestas[\s\S]*codigo_estado\s*=\s*'APROBADO'/.test(s)) ?? ''
    expect(upd).toMatch(/codigo_aprobado_en\s*=\s*now\(\)/)
    expect(upd).toMatch(/codigo_estado\s*=\s*'PENDIENTE'/) // el where
    // El aprobador sale de la SESIÓN.
    const iUpd = idx(/codigo_estado\s*=\s*'APROBADO'/)
    expect(ejecutadas[iUpd].params).toContain('U1')
    expect(confirmada).toBe(true)
  })

  it('sobre un cupón ya APROBADO → DecisionImposible, y no escribe nada', async () => {
    respuestas.propuesta = [
      { estatus: 'ENVIADA', codigo_texto: 'VERANO20', codigo_descuento_pct: 20, codigo_estado: 'APROBADO' },
    ]
    await expect(decidirCodigo('P1', { decision: 'APROBAR' })).rejects.toThrow(DecisionImposible)
    expect(sqls().some((s) => /^\s*update/i.test(s))).toBe(false)
    expect(revertida).toBe(true)
  })

  it('de otra organización (o inexistente) → null, que el controller convierte en 404', async () => {
    respuestas.propuesta = []
    expect(await decidirCodigo('P1', { decision: 'APROBAR' })).toBeNull()
  })

  it('RECHAZAR quita el cupón y DEVUELVE EL USO, con el motivo en la bitácora', async () => {
    respuestas.propuesta = [
      { estatus: 'ENVIADA', codigo_texto: 'VERANO20', codigo_descuento_pct: 20, codigo_estado: 'PENDIENTE' },
    ]
    await decidirCodigo('P1', { decision: 'RECHAZAR', motivo: 'no califica' })
    const del = sqls().find((s) => /delete from canjes_codigo/.test(s)) ?? ''
    expect(del).toMatch(/propuesta_id\s*=\s*\$1/)
    expect(del).toMatch(/tenant_id\s*=\s*\$2/)
    const limpia = sqls().find((s) => /update propuestas[\s\S]*codigo_texto\s*=\s*null/.test(s)) ?? ''
    expect(limpia).toMatch(/codigo_estado\s*=\s*null/)
    expect(limpia).toMatch(/codigo_aprobado_por\s*=\s*null/)
    const iLog = idx(/insert into acciones/)
    expect(String(ejecutadas[iLog].params.find((p) => typeof p === 'string' && /Rechazó/.test(p)))).toMatch(
      /no califica/,
    )
  })

  it('quitar el cupón (el vendedor) también limpia el estado y la aprobación', async () => {
    respuestas.propuesta = [{ estatus: 'BORRADOR', codigo_texto: 'VERANO20' }]
    await quitarCodigo('P1')
    const limpia = sqls().find((s) => /update propuestas[\s\S]*codigo_texto\s*=\s*null/.test(s)) ?? ''
    expect(limpia).toMatch(/codigo_estado\s*=\s*null/)
    expect(limpia).toMatch(/codigo_aprobado_en\s*=\s*null/)
  })
})

describe('3 · el esquema de la decisión es estricto', () => {
  it('APROBAR no lleva nada más', async () => {
    respuestas.propuesta = [
      { estatus: 'ENVIADA', codigo_texto: 'V', codigo_descuento_pct: 20, codigo_estado: 'PENDIENTE' },
    ]
    await expect(decidirCodigoCtrl('P1', { decision: 'APROBAR', descuentoPct: 90 })).rejects.toThrow()
    await expect(decidirCodigoCtrl('P1', { decision: 'APROBAR', aprobadoPor: 'X' })).rejects.toThrow()
  })

  it('RECHAZAR exige motivo, y no vacío', async () => {
    await expect(decidirCodigoCtrl('P1', { decision: 'RECHAZAR' })).rejects.toThrow()
    await expect(decidirCodigoCtrl('P1', { decision: 'RECHAZAR', motivo: '   ' })).rejects.toThrow()
  })

  it('una decisión inventada no pasa', async () => {
    await expect(decidirCodigoCtrl('P1', { decision: 'AUTOAPROBAR' })).rejects.toThrow()
    await expect(decidirCodigoCtrl('P1', {})).rejects.toThrow()
  })

  it('el esquema se declara con .strict() en las dos ramas', () => {
    const fuente = readFileSync(join(__dirname, 'codigos-controller.ts'), 'utf8')
    const i = fuente.indexOf('const decisionSchema')
    expect(i).toBeGreaterThan(-1)
    const trozo = fuente.slice(i, fuente.indexOf('])', i))
    expect(trozo.match(/\.strict\(\)/g) ?? []).toHaveLength(2)
  })
})
