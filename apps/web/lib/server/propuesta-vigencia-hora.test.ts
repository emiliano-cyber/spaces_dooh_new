import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import type { PoolClient } from 'pg'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  LA VIGENCIA DE UNA PROPUESTA NO DEPENDE DE LA HORA DEL DIA (05/11).
// ----------------------------------------------------------------------------
//  El defecto, que era de PRODUCCION y no solo del arnes: en g500 la base corre
//  con la zona del sistema (`Etc/UTC`) y la aplicacion con
//  `TZ=America/Mexico_City` (`app.env`). Habia DOS relojes para la misma regla:
//
//    · la ficha y la liga decian «vencida» con el dia LOCAL de la aplicacion
//      (`propuestaVencida()`, `lib/propuesta-vigencia.ts`);
//    · aceptar por la liga, el correo de «Enviar» y la vigencia que se pone al
//      enviar usaban `current_date` de la BASE, o sea el dia UTC.
//
//  Desde las 18:00 de Mexico el dia UTC ya es el siguiente. Una propuesta
//  «valida hasta hoy» salia vigente en la liga, con su boton de aceptar, y al
//  pulsarlo el servidor contestaba 409 «vencio». Y una enviada a las 19:00 se
//  guardaba con un dia MAS de vigencia que el que decia su correo.
//
//  La regla, unica y explicita: el dia de la vigencia es el dia de la ZONA DEL
//  NEGOCIO, que es la `TZ` del proceso (`hoyDeVigencia()`), y la base lo recibe
//  como parametro en vez de usar su `current_date`.
//
//  Aqui la base esta simulada EN UTC, como en produccion: si una consulta usa
//  `current_date`, la simulacion contesta con el dia UTC. Y el reloj esta fijo
//  a las 19:00 de Mexico del 04/11 (01:00 UTC del 05/11).
// ============================================================================

const DIA_MEXICO = '2026-11-04'
const DIA_UTC = '2026-11-05'
const A_LAS_19_DE_MEXICO = new Date('2026-11-05T01:00:00Z')

const consultas: { sql: string; params: unknown[] }[] = []
const fila: { vigente_hasta: string | null } = { vigente_hasta: null }

/** El «hoy» con que la base simulada evaluaria la consulta. */
function hoyDeLaBase(sql: string, params: unknown[]): string {
  if (/current_date/.test(sql)) return DIA_UTC
  const m = sql.match(/vigente_hasta\s*<\s*\$(\d+)::date/)
  if (!m) throw new Error(`consulta de vigencia sin dia: ${sql}`)
  return String(params[Number(m[1]) - 1])
}

function responder(sql: string, params: unknown[]): any[] {
  if (/^\s*select[\s\S]*as vencida[\s\S]*from propuestas/i.test(sql)) {
    const hoy = hoyDeLaBase(sql, params)
    return [{
      id: 'P1', tenant_id: 'T1', folio: 'PR-2026-0001', nombre: 'Vigencia', estatus: 'ENVIADA',
      aceptado_en: null, aceptado_por: null,
      vigente_hasta_txt: fila.vigente_hasta,
      vencida: fila.vigente_hasta == null ? null : fila.vigente_hasta < hoy,
    }]
  }
  if (/^\s*update propuestas set estatus/i.test(sql)) return [{ id: 'P1', estatus: 'ENVIADA', nombre: 'Vigencia' }]
  return []
}

const clienteFalso = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return { rows: responder(sql, params ?? []) }
  }),
  release: vi.fn(),
} as unknown as PoolClient

const db = {
  pool: { connect: vi.fn(async () => clienteFalso) },
  q: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql, params ?? [])
  }),
  q1: vi.fn(async (sql: string, params?: unknown[]): Promise<any> => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql, params ?? [])[0] ?? null
  }),
  qConTenant: vi.fn(async (_t: string, sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql, params ?? [])
  }),
  qRaw1: vi.fn(async () => ({ tenant: 'T1' })),
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
}
vi.mock('./db', () => db)
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./auth', () => ({ usuarioActual: vi.fn(async () => ({ id: 'U1' })) }))
vi.mock('./folios', () => ({ folioDocumento: vi.fn(async () => 'PR-2026-0001') }))
vi.mock('./config-repo', () => ({
  topeDescuentoDelTenant: vi.fn(async () => 100),
  vigenciaPropuestaDelTenant: vi.fn(async () => 30),
}))

const repo: any = await import('./propuestas-repo')
const { aceptarPropuestaPublica, cambiarEstatusPropuesta, PropuestaVencidaError } = repo
const { hoyDeVigencia, propuestaVencida, vigenciaDesde } = await import('@/lib/propuesta-vigencia')

// La zona del negocio, fijada aqui para que la prueba diga lo mismo en el CI
// (Linux en UTC) que en el portatil de Mexico. Node relee `TZ` al cambiarla.
let tzAntes: string | undefined
beforeAll(() => {
  tzAntes = process.env.TZ
  process.env.TZ = 'America/Mexico_City'
})
afterAll(() => {
  if (tzAntes === undefined) delete process.env.TZ
  else process.env.TZ = tzAntes
})
beforeEach(() => {
  consultas.length = 0
  db.pool.connect.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(A_LAS_19_DE_MEXICO)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('a las 19:00 de Mexico (ya es manana en UTC)', () => {
  it('el dia de la vigencia es el de Mexico, no el UTC', () => {
    expect(hoyDeVigencia()).toBe(DIA_MEXICO)
  })

  it('una propuesta que vence HOY sale vigente en la ficha y en la liga…', () => {
    expect(propuestaVencida(DIA_MEXICO)).toBe(false)
  })

  it('…y aceptarla por la liga NO dice «vencio» (antes: 409 con el boton a la vista)', async () => {
    fila.vigente_hasta = DIA_MEXICO
    const r = await aceptarPropuestaPublica('tok', { nombre: 'Cliente' }).catch((e: unknown) => e)
    expect(r).not.toBeInstanceOf(PropuestaVencidaError)
    // Paso la comprobacion y entro a la transaccion de la aceptacion.
    expect(db.pool.connect).toHaveBeenCalled()
  })

  it('NEGATIVO · la que vencio AYER (dia de Mexico) se sigue negando, con la fecha', async () => {
    fila.vigente_hasta = '2026-11-03'
    const r = await aceptarPropuestaPublica('tok', { nombre: 'Cliente' }).catch((e: unknown) => e)
    expect(r).toBeInstanceOf(PropuestaVencidaError)
    expect(db.pool.connect).not.toHaveBeenCalled()
  })

  it('al ENVIAR, la vigencia se cuenta desde el dia de Mexico, el mismo que dice el correo', async () => {
    await cambiarEstatusPropuesta('P1', 'ENVIADA').catch(() => {})
    const upd = consultas.find((c) => /^\s*update propuestas set estatus/i.test(c.sql))
    expect(upd, 'no hubo update de estatus').toBeTruthy()
    expect(upd!.sql).not.toMatch(/current_date/)
    expect(upd!.params).toContain(DIA_MEXICO)
    // Lo que escribe el correo de «Enviar» para la misma propuesta:
    expect(vigenciaDesde(hoyDeVigencia(), 30)).toBe('2026-12-04')
  })
})

describe('la regla es UNA: ninguna consulta de vigencia de propuestas usa el reloj de la base', () => {
  it('NEGATIVO · ni el repo ni el envio usan `current_date` (todas sus consultas con fecha son de vigencia)', () => {
    for (const archivo of ['propuestas-repo.ts', 'propuestas-envio.ts']) {
      const src = readFileSync(join(__dirname, archivo), 'utf8')
      // Solo el codigo: los comentarios pueden contar la historia.
      const codigo = src.replace(/\/\/.*$/gm, '')
      const malas = codigo.split('\n').filter((l) => /current_date/.test(l))
      expect(malas, archivo).toEqual([])
    }
  })
})
