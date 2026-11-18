import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  VAL-07 (model) · «Extender» no puede acortar.
// ----------------------------------------------------------------------------
//  Ver la cabecera de `campanas-extender.test.ts` para el hallazgo completo. El
//  controlador solo puede decir «eso no es una fecha»; QUIÉN sabe si la fecha
//  nueva acorta o alarga es el model, porque es el único que conoce la fecha de
//  fin que la campaña tiene HOY. Mismo reparto que UX-01 en los contratos.
// ============================================================================

const consultas: { texto: string; params: unknown[] }[] = []
let finActual: string | null = '2026-09-30'
// FOLIO-VENTA (07/10) · el update de la campaña devuelve la fila escrita; sin
// ella es que otra extensión la llevó más lejos entre la lectura y el update.
let escribeCampana = true

// EXT-CONTRATO (29/10) · la extensión va en UNA transacción (cliente de
// `pool.connect`), así que el mock responde igual por `q` y por el cliente, y
// anota las dos en `consultas` para poder afirmar el ORDEN (begin … commit).
function responder(texto: string): unknown[] {
  if (/select fecha_fin/i.test(texto)) return finActual == null ? [] : [{ fecha_fin: finActual }]
  if (/^\s*update campanas/i.test(texto)) return escribeCampana ? [{ id: 'cmp-1', folio: 'PR-2026-0042.1' }] : []
  if (/select \* from campanas/i.test(texto)) {
    return [{ id: 'cmp-1', nombre: 'Campaña', fecha_inicio: '2026-08-01', fecha_fin: finActual }]
  }
  return []
}
let liberado = 0
vi.mock('./db', () => ({
  q: vi.fn(async (texto: string, params: unknown[] = []) => {
    consultas.push({ texto, params })
    return responder(texto)
  }),
  q1: vi.fn(async () => null),
  pool: {
    connect: vi.fn(async () => ({
      query: vi.fn(async (texto: string, params: unknown[] = []) => {
        consultas.push({ texto, params })
        return { rows: responder(texto) }
      }),
      release: () => {
        liberado++
      },
    })),
  },
  fijarTenant: vi.fn(async () => {
    consultas.push({ texto: 'fijarTenant', params: [] })
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 't1') }))

const { extenderCampana } = await import('./campanas-repo')

const PDF = 'data:application/pdf;base64,JVBERi0xLjQK'
const USUARIO = { id: 'u-1', nombre: 'Ana' }

beforeEach(() => {
  consultas.length = 0
  finActual = '2026-09-30'
  escribeCampana = true
  liberado = 0
})

async function extender(nueva: string) {
  try {
    const c = await extenderCampana('cmp-1', nueva, PDF, USUARIO)
    return { ok: true as const, campana: c, mensaje: '', status: 200 }
  } catch (e) {
    const err = e as Error & { status?: number }
    return { ok: false as const, campana: null, mensaje: err.message, status: err.status ?? 500 }
  }
}

// Control positivo: sin esto, un negativo podría estar pasando porque el módulo
// no llega ni a ejecutarse. Es el fallo que se repitió cinco veces el 26/08.
describe('control · extender de verdad sigue funcionando', () => {
  it('una fecha posterior alarga la campaña y sus reservas', async () => {
    const r = await extender('2026-12-31')
    expect(r.ok, r.mensaje).toBe(true)
    expect(consultas.some((c) => /update campanas[\s\S]*fecha_fin = \$2/i.test(c.texto))).toBe(true)
    expect(consultas.some((c) => /update reservas\s+set fecha_fin/i.test(c.texto))).toBe(true)
  })

  // EXT-CONTRATO (29/10) · hasta hoy la MISMA fecha pasaba (no acorta). Con el
  // contrato obligatorio dejaría en el expediente una «extensión» firmada que
  // no alarga nada, así que ahora se rechaza igual que acortar, sin escribir.
  it('NEGATIVO · la MISMA fecha ya no es una extensión: 400 y no escribe nada', async () => {
    const r = await extender('2026-09-30')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(consultas.filter((c) => /^\s*(update|insert)/i.test(c.texto))).toEqual([])
  })
})

describe('VAL-07 · una fecha anterior no acorta en silencio', () => {
  it('rechaza con 400 y no escribe NADA', async () => {
    const r = await extender('2026-08-15')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(consultas.filter((c) => /^\s*update/i.test(c.texto))).toEqual([])
    // Ni siquiera el recalculo de presupuesto: el rechazo es ANTES de tocar nada.
  })

  it('el mensaje dice hasta cuándo llega hoy la campaña', async () => {
    const r = await extender('2026-08-15')
    expect(r.mensaje).toContain('2026-09-30')
  })

  it('compara por CALENDARIO, no como texto', () => {
    // Si se compararan como cadenas, '2026-9-1' saldría MAYOR que '2026-10-01'
    // y un acortamiento real pasaría. Es el defecto que ya apareció en UX-01.
    finActual = '2026-10-01'
    return extender('2026-9-1').then((r) => {
      expect(r.ok).toBe(false)
      expect(r.status).toBe(400)
    })
  })
})

describe('VAL-07 · la campaña de otra organización', () => {
  it('la lectura de la fecha actual lleva su `and tenant_id`', async () => {
    await extender('2026-12-31')
    const lectura = consultas.find((c) => /select fecha_fin/i.test(c.texto))
    expect(lectura?.texto).toMatch(/tenant_id/)
  })

  it('los dos updates de la extension llevan su `and tenant_id`', async () => {
    // Segunda capa sobre la RLS, como manda la convencion. NO es observable por
    // HTTP —la RLS con FORCE tapa el hueco—, asi que si se omite ninguna prueba
    // de caja negra lo diria. Por eso se afirma sobre el SQL.
    await extender('2026-12-31')
    const u = consultas.filter((c) => /update (campanas|reservas)\s+set (fecha_fin|folio)/i.test(c.texto))
    expect(u.length).toBe(2)
    for (const c of u) expect(c.texto, c.texto).toMatch(/tenant_id/)
  })

  it('una campaña que no existe devuelve null, no un 500', async () => {
    finActual = null
    const r = await extender('2026-12-31')
    expect(r.ok, r.mensaje).toBe(true)
    expect(r.campana).toBeNull()
  })
})

describe('FOLIO-VENTA (07/10) · el tramo .1/.2 lo pone el mismo update', () => {
  const upd = () => consultas.find((c) => /^\s*update campanas/i.test(c.texto))?.texto ?? ''

  it('el folio y la fecha se escriben en UNA sentencia, no en dos', async () => {
    await extender('2026-12-31')
    expect(upd()).toMatch(/set folio = case[\s\S]*fecha_fin = \$2/)
  })

  it('la expresión llega a Postgres con su barra: «\.» y no «.» (cualquier carácter)', async () => {
    await extender('2026-12-31')
    expect(upd()).toContain(String.raw`folio ~ '\.[0-9]+$'`)
    expect(upd()).not.toContain(`folio ~ '.[0-9]+$'`)
  })

  it('NEGATIVO · si otra extensión la llevó más lejos: 409 y las reservas no se tocan', async () => {
    escribeCampana = false
    const r = await extender('2026-12-31')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(409)
    expect(consultas.some((c) => /update reservas/i.test(c.texto))).toBe(false)
  })

  it('el update no acorta ni repite: lleva la condición estricta sobre la fecha de la fila', async () => {
    await extender('2026-12-31')
    expect(upd()).toMatch(/fecha_fin < \$2::date/)
  })
})

describe('EXT-CONTRATO (29/10) · la extensión deja su contrato en el expediente', () => {
  const insercion = () => consultas.find((c) => /insert into campana_extensiones/i.test(c.texto))
  const indice = (re: RegExp) => consultas.findIndex((c) => re.test(c.texto))

  it('inserta la fila con el contrato, las dos fechas, el folio del tramo y quién', async () => {
    const r = await extender('2026-12-31')
    expect(r.ok, r.mensaje).toBe(true)
    const ins = insercion()
    expect(ins, 'no se insertó la extensión').toBeDefined()
    expect(ins!.texto).toMatch(/tenant_id/)
    for (const v of ['t1', 'cmp-1', 'PR-2026-0042.1', '2026-09-30', '2026-12-31', PDF, 'u-1', 'Ana']) {
      expect(ins!.params, String(v)).toContain(v)
    }
  })

  it('fecha, folio, contrato y reservas van en UNA transacción, en ese orden', async () => {
    await extender('2026-12-31')
    const begin = indice(/^begin$/i)
    const tenant = indice(/^fijarTenant$/)
    const lectura = indice(/select fecha_fin/i)
    const camp = indice(/^\s*update campanas/i)
    const ins = indice(/insert into campana_extensiones/i)
    const res = indice(/update reservas/i)
    const commit = indice(/^commit$/i)
    expect(begin).toBeGreaterThanOrEqual(0)
    expect([begin, tenant, lectura, camp, ins, res, commit]).toEqual(
      [begin, tenant, lectura, camp, ins, res, commit].slice().sort((a, b) => a - b),
    )
    expect(new Set([begin, tenant, lectura, camp, ins, res, commit]).size).toBe(7)
    expect(liberado).toBe(1)
  })

  it('la lectura de la fecha actual bloquea la fila (`for update`)', async () => {
    await extender('2026-12-31')
    expect(consultas.find((c) => /select fecha_fin/i.test(c.texto))?.texto).toMatch(/for update/i)
  })

  it('NEGATIVO · si otra extensión ganó: rollback, sin fila de extensión ni reservas', async () => {
    escribeCampana = false
    const r = await extender('2026-12-31')
    expect(r.status).toBe(409)
    expect(insercion()).toBeUndefined()
    expect(indice(/^rollback$/i)).toBeGreaterThanOrEqual(0)
    expect(indice(/^commit$/i)).toBe(-1)
    expect(liberado).toBe(1)
  })

  it('NEGATIVO · acortar no deja fila de extensión', async () => {
    const r = await extender('2026-08-15')
    expect(r.status).toBe(400)
    expect(insercion()).toBeUndefined()
    expect(indice(/^commit$/i)).toBe(-1)
  })

  it('NEGATIVO · campaña inexistente: null, sin fila y sin commit', async () => {
    finActual = null
    const r = await extender('2026-12-31')
    expect(r.campana).toBeNull()
    expect(insercion()).toBeUndefined()
    expect(indice(/^commit$/i)).toBe(-1)
  })
})
