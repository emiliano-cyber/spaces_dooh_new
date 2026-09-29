import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  EL REPOSITORIO DE PROPUESTAS, POR EL LADO DEL CÓDIGO. ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  ⚠️ ESTE ARCHIVO NACIÓ DE UN MUTANTE QUE SOBREVIVIÓ (M16), y apuntaba al mismo
//  agujero que ya encontró la Fase 2: **el camino VIVO del repositorio —la
//  propuesta ANTES de aprobarse— no tenía ninguna prueba del código.** Todo lo
//  que había miraba el SNAPSHOT, que es el final del recorrido.
//
//  El mutante quitaba el cupón de `armarPropuesta` dejando intacto el del
//  snapshot, y la suite entera seguía en verde. Lo que costaría: la pantalla de
//  la propuesta enseñaría una base y un total SIN el descuento del cupón —o sea
//  que el vendedor le cotiza al cliente un número y al aprobar se congela otro
//  más bajo—. Nadie ve un error: se ven dos cifras distintas del mismo trato, y
//  la que el cliente vio primero es la mala.
//
//  Se mockea `./db` y se miran los números. Nada de esto afirma algo contra
//  Postgres: eso está en `codigo-promocional.e2e.test.ts`.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []
const respuestas: Record<string, any[]> = {}

/**
 * El ORDEN de las reglas importa: `select p.estatus from propuesta_items i join
 * propuestas p` menciona las DOS tablas, así que la de `propuesta_items` va
 * primero. Con el orden al revés devolvería la fila equivocada — una prueba en
 * verde midiendo otra cosa, que es peor que una en rojo.
 */
function responder(sql: string): any[] {
  if (/insert into propuestas /.test(sql)) return respuestas.propuesta ?? []
  if (/propuesta_items/.test(sql)) return respuestas.items ?? []
  if (/propuestas/.test(sql)) return respuestas.propuesta ?? []
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
  qConTenant: vi.fn(async () => []),
  qRaw1: vi.fn(async () => null),
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
  withTenantTx: vi.fn(),
}
vi.mock('./db', () => db)
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./auth', () => ({ usuarioActual: vi.fn(async () => ({ id: 'U1' })) }))
vi.mock('./folios', () => ({ folioDocumento: vi.fn(async () => 'PR-2026-0001') }))
vi.mock('./config-repo', () => ({ topeDescuentoDelTenant: vi.fn(async () => 100) }))

const { listarPropuestas } = await import('./propuestas-repo')

/** Una propuesta de 100 000 de lista con VERANO20 al 20 %, SIN aprobar. */
const PROPUESTA = {
  id: 'P1',
  folio: 'PR-2026-0001',
  nombre: 'Viva',
  estatus: 'BORRADOR',
  comision_pct: 0,
  descuento_pct: 0,
  cliente_iva: 16,
  version: 1,
  codigo_texto: 'VERANO20',
  codigo_descuento_pct: 20,
  codigo_canjeado_en: new Date('2026-09-30T18:00:00.000Z'),
}

const ITEM = {
  id: 'I1',
  propuesta_id: 'P1',
  sitio_id: 'S1',
  precio: 100000,
  tarifa_unitaria: 100000,
  cantidad: 1,
  unidad: 'spot',
  fecha_inicio: '2026-11-13',
  fecha_fin: '2026-12-12',
  aprobado: false,
  franja_id: null,
  descuento_volumen_pct: 0,
  volumen_desde: null,
}

beforeEach(() => {
  consultas.length = 0
  respuestas.propuesta = [{ ...PROPUESTA }]
  respuestas.items = [{ ...ITEM }]
})

const leer = async () => (await listarPropuestas())[0] as any

describe('1 · la propuesta VIVA ya lleva el código dentro', () => {
  it('la base y el total que ve el vendedor YA tienen el descuento del cupón', async () => {
    // Es el mutante M16. Sin esto, la pantalla enseña 100 000 de base, el
    // cliente ve 116 000 de total, y al aprobar se congelan 80 000 y 92 800.
    const p = await leer()
    expect(p.baseComercial).toBe(100_000)
    expect(p.codigoDescuentoMonto).toBe(20_000)
    expect(p.base).toBe(80_000)
    expect(p.iva).toBe(12_800)
    expect(p.total).toBe(92_800)
  })

  it('el código y su porcentaje viajan en la propuesta, para poder pintarlos', async () => {
    const p = await leer()
    expect(p.codigoTexto).toBe('VERANO20')
    expect(p.codigoDescuentoPct).toBe(20)
  })

  it('el NETO del medio sale de la base YA con el cupón dentro', async () => {
    respuestas.propuesta = [{ ...PROPUESTA, comision_pct: 20 }]
    const p = await leer()
    // 80 000 × 0,8. Si el cupón se aplicara después de la comisión, el medio
    // cobraría 80 000 y el descuento se lo comería la agencia.
    expect(p.neto).toBe(64_000)
  })

  it('las TRES capas se COMPONEN también en la propuesta viva', async () => {
    respuestas.propuesta = [{ ...PROPUESTA, descuento_pct: 20 }]
    respuestas.items = [{ ...ITEM, descuento_volumen_pct: 20, volumen_desde: 2 }]
    const p = await leer()
    expect(p.brutoConVolumen).toBe(80_000)
    expect(p.descuentoMonto).toBe(16_000)
    expect(p.baseComercial).toBe(64_000)
    expect(p.codigoDescuentoMonto).toBe(12_800)
    expect(p.base).toBe(51_200)
  })

  it('los totales APROBADOS también llevan el cupón', async () => {
    // El modelo «menú»: se aprueban sitios sueltos. El cupón es de la propuesta
    // entera, así que tiene que aplicarse igual sobre lo aprobado — si no, el
    // presupuesto parcial que se enseña sería mayor que el que se va a cobrar.
    respuestas.items = [{ ...ITEM, aprobado: true }]
    const p = await leer()
    expect(p.brutoAprobado).toBe(100_000)
    expect(p.codigoDescuentoMontoAprobado).toBe(20_000)
    expect(p.baseAprobado).toBe(80_000)
    expect(p.totalAprobado).toBe(92_800)
  })
})

describe('2 · SIN código, la propuesta viva es la de siempre', () => {
  beforeEach(() => {
    respuestas.propuesta = [
      { ...PROPUESTA, codigo_texto: null, codigo_descuento_pct: 0, codigo_canjeado_en: null },
    ]
  })

  it('no se mueve ni un peso', async () => {
    const p = await leer()
    expect(p.codigoTexto).toBeNull()
    expect(p.codigoDescuentoPct).toBe(0)
    expect(p.codigoDescuentoMonto).toBe(0)
    expect(p.baseComercial).toBe(100_000)
    expect(p.base).toBe(100_000)
    expect(p.total).toBe(116_000)
  })
})

describe('3 · lo ILEGIBLE no envenena la propuesta viva', () => {
  it('un porcentaje NaN se lee como CERO', async () => {
    // Igual que el descuento comercial: `numeric` de Postgres admite NaN, y una
    // fila corrupta contaminaría la base, el neto y el total CADA VEZ QUE SE
    // LEE la propuesta — no solo al escribirla.
    respuestas.propuesta = [{ ...PROPUESTA, codigo_descuento_pct: Number.NaN }]
    const p = await leer()
    expect(p.codigoDescuentoPct).toBe(0)
    expect(p.base).toBe(100_000)
    expect(Number.isFinite(p.total)).toBe(true)
  })

  it('un porcentaje por encima de 100 se ACOTA a 100, no regala de más', async () => {
    respuestas.propuesta = [{ ...PROPUESTA, codigo_descuento_pct: 250 }]
    const p = await leer()
    expect(p.codigoDescuentoPct).toBe(100)
    expect(p.codigoDescuentoMonto).toBe(100_000)
    expect(p.base).toBe(0)
  })

  it('un porcentaje NEGATIVO no puede SUBIR el precio', async () => {
    respuestas.propuesta = [{ ...PROPUESTA, codigo_descuento_pct: -50 }]
    const p = await leer()
    expect(p.codigoDescuentoPct).toBe(0)
    expect(p.base).toBe(100_000)
  })
})
