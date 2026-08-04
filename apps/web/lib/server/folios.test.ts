import { describe, it, expect, vi } from 'vitest'
import type { PoolClient } from 'pg'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const { siguienteConsecutivo, folioCampana, folioDocumento } = await import('./folios')

// ============================================================================
//  Folios consecutivos. Lo que se ancla aquí es que el folio SALE DE UN
//  CONTADOR y no de un dado: el generador anterior tenía 1.000 combinaciones por
//  día para campañas, chocaba contra su propia restricción UNIQUE y le enseñaba
//  al vendedor `duplicate key value violates unique constraint`.
//
//  La atomicidad de verdad la da el UPSERT en Postgres (probado contra la BD);
//  aquí se fija el CONTRATO: que se pida el número al contador, con el ámbito y
//  el periodo correctos, y que el formato no vuelva a depender del azar.
// ============================================================================

// Cliente falso: devuelve el número que se le indique y registra las consultas.
function fakeClient(numeros: number[]) {
  const queries: { sql: string; params: unknown[] }[] = []
  let i = 0
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params })
      return { rows: [{ ultimo: numeros[i++] ?? 1 }] }
    },
  } as unknown as PoolClient
  return { client, queries }
}

const DIA = new Date(2026, 7, 4) // 2026-08-04

describe('siguienteConsecutivo', () => {
  it('pide el número al contador con ámbito y periodo del día', async () => {
    const { client, queries } = fakeClient([7])
    const r = await siguienteConsecutivo({ ambito: 'campana', periodo: 'dia', client, ahora: DIA })
    expect(r).toEqual({ n: 7, periodo: '20260804' })
    expect(queries[0].params).toEqual(['campana', '20260804'])
    // El incremento va en la MISMA sentencia que la lectura: leer y luego
    // escribir dejaría la ventana donde dos reservas simultáneas toman el mismo.
    expect(queries[0].sql).toMatch(/on conflict[\s\S]*do update set ultimo = folios_consecutivos\.ultimo \+ 1/i)
    expect(queries[0].sql).toMatch(/returning ultimo/i)
  })

  it('el periodo anual agrupa por año', async () => {
    const { client, queries } = fakeClient([3])
    const r = await siguienteConsecutivo({ ambito: 'ot', periodo: 'anio', client, ahora: DIA })
    expect(r.periodo).toBe('2026')
    expect(queries[0].params).toEqual(['ot', '2026'])
  })

  it('usa el client de la transacción cuando se le pasa: si la tx se revierte, el folio no se emite a medias', async () => {
    const { client, queries } = fakeClient([1])
    await siguienteConsecutivo({ ambito: 'campana', periodo: 'dia', client, ahora: DIA })
    expect(queries).toHaveLength(1)
  })
})

describe('folioCampana', () => {
  it('conserva la forma <PREFIJO><YYYYMMDD><NNN> con el consecutivo del día', async () => {
    vi.setSystemTime(DIA)
    const { client } = fakeClient([4])
    await expect(folioCampana('RGB', client)).resolves.toBe('RGB20260804004')
    vi.useRealTimers()
  })

  it('números distintos ⇒ folios distintos (era exactamente lo que fallaba)', async () => {
    vi.setSystemTime(DIA)
    const { client } = fakeClient([1, 2, 3])
    const folios = [
      await folioCampana('RGB', client),
      await folioCampana('RGB', client),
      await folioCampana('RGB', client),
    ]
    expect(new Set(folios).size).toBe(3)
    expect(folios).toEqual(['RGB20260804001', 'RGB20260804002', 'RGB20260804003'])
    vi.useRealTimers()
  })

  it('pasando de 999 en un día crece a cuatro dígitos en vez de repetirse', async () => {
    vi.setSystemTime(DIA)
    const { client } = fakeClient([1000])
    await expect(folioCampana('RGB', client)).resolves.toBe('RGB202608041000')
    vi.useRealTimers()
  })
})

describe('folioDocumento', () => {
  it('usa la sigla de cada ámbito, el año y el consecutivo', async () => {
    vi.setSystemTime(DIA)
    for (const [ambito, esperado] of [
      ['ot', 'OT-2026-0009'],
      ['propuesta', 'PR-2026-0009'],
      ['oc', 'ODC-2026-0009'],
      ['oi', 'OI-2026-0009'],
    ] as const) {
      const { client } = fakeClient([9])
      await expect(folioDocumento(ambito, client)).resolves.toBe(esperado)
    }
    vi.useRealTimers()
  })
})
