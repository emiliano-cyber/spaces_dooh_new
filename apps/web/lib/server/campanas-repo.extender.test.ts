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

vi.mock('./db', () => ({
  q: vi.fn(async (texto: string, params: unknown[] = []) => {
    consultas.push({ texto, params })
    if (/select fecha_fin/i.test(texto)) return finActual == null ? [] : [{ fecha_fin: finActual }]
    if (/select \* from campanas/i.test(texto)) {
      return [{ id: 'cmp-1', nombre: 'Campaña', fecha_inicio: '2026-08-01', fecha_fin: finActual }]
    }
    return []
  }),
  q1: vi.fn(async () => null),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(async () => {}),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 't1') }))

const { extenderCampana } = await import('./campanas-repo')

beforeEach(() => {
  consultas.length = 0
  finActual = '2026-09-30'
})

async function extender(nueva: string) {
  try {
    const c = await extenderCampana('cmp-1', nueva)
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
    expect(consultas.some((c) => /update campanas set fecha_fin/i.test(c.texto))).toBe(true)
    expect(consultas.some((c) => /update reservas\s+set fecha_fin/i.test(c.texto))).toBe(true)
  })

  it('la MISMA fecha no es un acortamiento: no se rechaza', async () => {
    const r = await extender('2026-09-30')
    expect(r.ok, r.mensaje).toBe(true)
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
    const u = consultas.filter((c) => /update (campanas|reservas)\s+set fecha_fin/i.test(c.texto))
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
