import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  EL REPOSITORIO DE PROPUESTAS, POR EL LADO DEL VOLUMEN.  ADR 0039, Fase 2.
// ----------------------------------------------------------------------------
//  ⚠️ ESTE ARCHIVO NACIÓ DE TRES MUTANTES QUE SOBREVIVIERON, y los tres apuntaban
//  al mismo agujero: el camino VIVO del repositorio —la propuesta antes de
//  aprobarse, la escritura de sus líneas y la comprobación del tope— no tenía
//  una sola prueba unitaria. Todo lo que había miraba el SNAPSHOT, que es el
//  final del recorrido.
//
//  Los tres, con lo que costaría cada uno:
//   · `armarPropuesta` aplicando el descuento comercial al bruto de LISTA en vez
//     de al bruto con volumen. La pantalla de la propuesta enseñaría una base y
//     un total más bajos de los que se van a congelar al aprobar — o sea que el
//     vendedor cotiza un número y el contrato dice otro.
//   · El `insert` escribiendo 0 y null en vez del porcentaje resuelto. El
//     descuento se calcularía, se enseñaría… y no se guardaría. Nadie ve un
//     error: se ve una propuesta sin descuento.
//   · El tope comparando solo el comercial. Volvería la acumulación que VOL-02
//     viene a cerrar, y el techo dejaría de ser el techo.
//
//  Se mockea `./db` y se miran las consultas. Nada de esto afirma algo contra
//  Postgres: eso está en `descuento-volumen.e2e.test.ts`.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []
const respuestas: Record<string, any[]> = {}

/**
 * Empareja cada consulta con su respuesta por una marca del SQL.
 *
 * El ORDEN de las reglas importa y por eso va comentado: `select p.estatus from
 * propuesta_items i join propuestas p` menciona las DOS tablas, y si la regla
 * de `propuestas` fuera primero devolvería la fila equivocada — una prueba en
 * verde midiendo otra cosa, que es peor que una en rojo.
 */
function responder(sql: string): any[] {
  if (/update propuesta_items set aprobado/.test(sql)) return [{ propuesta_id: 'P1' }]
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

const { topeMock } = vi.hoisted(() => ({ topeMock: vi.fn(async () => 100 as number | null) }))
vi.mock('./config-repo', () => ({ topeDescuentoDelTenant: () => topeMock() }))

const { aprobarItem, actualizarPropuesta, crearPropuesta } = await import('./propuestas-repo')

/** 50 spots a 1 200 de lista, con el tramo «desde 50 → 10 %» ya aplicado. */
const ITEM = {
  id: 'I1',
  propuesta_id: 'P1',
  sitio_id: 'S1',
  precio: 60000,
  tarifa_unitaria: 1200,
  cantidad: 50,
  unidad: 'spot',
  aprobado: true,
  descuento_volumen_pct: 10,
  volumen_desde: 50,
}

beforeEach(() => {
  consultas.length = 0
  db.q.mockClear()
  db.q1.mockClear()
  topeMock.mockClear()
  topeMock.mockResolvedValue(100)
  respuestas.propuesta = [
    { id: 'P1', estatus: 'BORRADOR', comision_pct: 0, descuento_pct: 20, cliente_iva: 16, version: 1 },
  ]
  respuestas.items = [{ ...ITEM }]
})

describe('1 · la propuesta VIVA ya compone el volumen con el comercial', () => {
  it('el comercial se calcula sobre el bruto CON volumen, no sobre el de lista', async () => {
    const p: any = await aprobarItem('I1', true)
    expect(p.bruto).toBe(60000)               // la lista no se mueve
    expect(p.descuentoVolumenMonto).toBe(6000)
    expect(p.brutoConVolumen).toBe(54000)
    // 20 % de 54 000, NO de 60 000. La diferencia son 1 200 pesos por venta.
    expect(p.descuentoMonto).toBe(10800)
    expect(p.base).toBe(43200)
  })

  it('y el porcentaje efectivo de la propuesta es el ponderado', async () => {
    respuestas.items = [{ ...ITEM }, { ...ITEM, id: 'I2', sitio_id: 'S2', precio: 40000, descuento_volumen_pct: 0, volumen_desde: null }]
    const p: any = await aprobarItem('I1', true)
    expect(p.bruto).toBe(100000)
    expect(p.descuentoVolumenMonto).toBe(6000)
    expect(p.descuentoVolumenPct).toBeCloseTo(6, 10)
  })

  it('SIN volumen da exactamente los mismos numeros que antes de esta fase', async () => {
    respuestas.items = [{ ...ITEM, descuento_volumen_pct: 0, volumen_desde: null }]
    const p: any = await aprobarItem('I1', true)
    expect(p.bruto).toBe(60000)
    expect(p.descuentoVolumenMonto).toBe(0)
    expect(p.brutoConVolumen).toBe(60000)
    expect(p.descuentoMonto).toBe(12000) // 20 % de 60 000
    expect(p.base).toBe(48000)
  })

  it('cada linea lleva su porcentaje y su umbral en la lectura', async () => {
    const p: any = await aprobarItem('I1', true)
    expect(p.items[0].descuentoVolumenPct).toBe(10)
    expect(p.items[0].volumenDesde).toBe(50)
  })
})

describe('2 · lo resuelto por el controller SE GUARDA', () => {
  it('el insert lleva el porcentaje y el umbral, no ceros', async () => {
    await crearPropuesta({
      nombre: 'Con volumen',
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-30',
      items: [
        {
          sitioId: 'S1',
          precio: 60000,
          unidad: 'spot',
          tarifaUnitaria: 1200,
          cantidad: 50,
          descuentoVolumenPct: 10,
          volumenDesde: 50,
        },
      ],
    })
    const ins = consultas.find((c) => /insert into propuesta_items/.test(c.sql))
    expect(ins, 'tiene que haber un insert de items').toBeTruthy()
    // Se comprueba por CONTENIDO y no por posición: si mañana alguien reordena
    // las columnas, lo que importa sigue siendo que los dos valores viajen.
    expect(ins!.params).toContain(10)
    expect(ins!.params).toContain(50)
    expect(ins!.sql).toMatch(/descuento_volumen_pct/)
    expect(ins!.sql).toMatch(/volumen_desde/)
  })

  it('sin volumen se escribe 0 y null EXPLICITOS, nunca undefined', async () => {
    await crearPropuesta({
      nombre: 'Sin volumen',
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-30',
      items: [{ sitioId: 'S1', precio: 5000 }],
    })
    const ins = consultas.find((c) => /insert into propuesta_items/.test(c.sql))!
    const p = ins.params as unknown[]
    // PRECIO-01 (2026-10-01) añadió DOS parámetros al final —`tarifa_calculada`
    // y `precio_ajustado_por`—, así que la pareja del volumen va antes. Los dos
    // nuevos también tienen que ser `null` explícito: una línea creada sin el
    // controller no tiene tarifa calculada ni ajuste que atribuir.
    //
    // ADR 0042 (2026-10-01) añadió CUATRO más detrás —`espacios_comprados`,
    // `horas_dia`, `roadblock` y `prima_roadblock_pct`—, así que todo lo de
    // antes se corre cuatro puestos. Sin calculadora son null, null, FALSE y
    // null: `roadblock` es NOT NULL, y una línea normal NO es un Roadblock.
    const k = p.length - 4
    expect(p[k - 4]).toBe(0)
    expect(p[k - 3]).toBeNull()
    expect(p[k - 2]).toBeNull()
    expect(p[k - 1]).toBeNull()
    expect(p.slice(k)).toEqual([null, null, false, null])
  })
})

describe('3 · VOL-02 · el tope mira el volumen de ESTA propuesta', () => {
  it('con 10 % de volumen y tope 15, un 10 % comercial no cabe', async () => {
    // compuesto(10, 10) = 19 % > 15
    topeMock.mockResolvedValue(15)
    await expect(actualizarPropuesta('P1', { descuentoPct: 10 })).rejects.toThrow(/volumen/i)
    expect(
      consultas.some((c) => /update propuestas set/.test(c.sql)),
      'por encima del tope NO se escribe nada',
    ).toBe(false)
  })

  it('el que si cabe se guarda: compuesto(5, 10) = 14,5 %', async () => {
    topeMock.mockResolvedValue(15)
    await expect(actualizarPropuesta('P1', { descuentoPct: 5 })).resolves.toBeTruthy()
    expect(consultas.some((c) => /update propuestas set/.test(c.sql))).toBe(true)
  })

  it('SIN volumen el tope se comporta igual que antes de esta fase', async () => {
    respuestas.items = [{ ...ITEM, descuento_volumen_pct: 0, volumen_desde: null }]
    topeMock.mockResolvedValue(15)
    await expect(actualizarPropuesta('P1', { descuentoPct: 15 })).resolves.toBeTruthy()
    await expect(actualizarPropuesta('P1', { descuentoPct: 16 })).rejects.toThrow()
  })

  it('el volumen se lee de las LINEAS, no de la escala de hoy', async () => {
    // Lo que cuenta es lo que se capturó. Si esto leyera `escalas_volumen`,
    // mover la escala cambiaría el techo de propuestas ya cotizadas.
    topeMock.mockResolvedValue(15)
    await actualizarPropuesta('P1', { descuentoPct: 5 }).catch(() => {})
    expect(consultas.some((c) => /escalas_volumen/.test(c.sql))).toBe(false)
    expect(
      consultas.some((c) => /select precio, descuento_volumen_pct from propuesta_items/.test(c.sql)),
    ).toBe(true)
  })

  it('no se lee nada de mas cuando el guardado NO toca el descuento', async () => {
    await actualizarPropuesta('P1', { nombre: 'Otro nombre' })
    expect(
      consultas.some((c) => /select precio, descuento_volumen_pct/.test(c.sql)),
      'editar el nombre no tiene por que pagar una consulta de volumen',
    ).toBe(false)
  })
})
