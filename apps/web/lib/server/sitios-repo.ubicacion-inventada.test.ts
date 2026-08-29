import { describe, it, expect, vi } from 'vitest'
import type { PoolClient } from 'pg'

// React 18 solo expone cache() dentro del runtime de servidor de Next; fuera de
// él es undefined y lib/server/tenant.ts revienta al importarse. Mismo motivo
// (y mismo apaño) que en sitios-repo.test.ts.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const { insertarSitio, rowToSitio } = await import('./sitios-repo')

// ============================================================================
//  DATA-01 · una pantalla de CDMX se guardaba en Perú.
// ----------------------------------------------------------------------------
//  El alta no captura estado ni país, y la capa de persistencia rellenaba los
//  huecos con 'Lima', 'Lima' y 'PE' — herencia de cuando el producto se vendía
//  como «Billboards Perú SA». No es un valor interno: la liga pública de la
//  pantalla lo imprime, y un cliente mexicano leía «Cuauhtemoc · Lima» en su
//  propia ficha.
//
//  La regla es que un dato AUSENTE quede ausente. Inventar una ubicación es
//  peor que no tenerla: un hueco se ve y se rellena; un dato falso se cree.
//
//  El índice de cada columna se deduce del propio INSERT en vez de escribirse a
//  mano: `valoresDe()` y `COLS` son dos listas paralelas y ya se desalinearon
//  una vez. Una posición quemada aquí convertiría ese desajuste en un verde.
// ============================================================================

async function capturarInsert(entrada: Record<string, unknown>) {
  const queries: { sql: string; params: unknown[] }[] = []
  const fakeClient = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params })
      return { rows: [{ id: 'sitio-1' }] }
    },
  } as unknown as PoolClient

  await insertarSitio(fakeClient, { nombre: 'Pantalla de prueba', tenantId: 'tenant-1', ...entrada })

  const insert = queries.find((q) => q.sql.includes('insert into sitios'))!
  const columnas = insert.sql.slice(insert.sql.indexOf('(') + 1, insert.sql.indexOf(')'))
    .split(',').map((c) => c.trim())
  return (columna: string) => {
    const i = columnas.indexOf(columna)
    expect(i, `la columna ${columna} ya no está en el INSERT de sitios`).toBeGreaterThanOrEqual(0)
    return insert.params[i]
  }
}

describe('insertarSitio — no inventa la ubicación que nadie capturó', () => {
  it('sin ciudad, la columna ciudad va NULL y no «Lima»', async () => {
    const valor = await capturarInsert({})
    expect(valor('ciudad')).toBeNull()
  })

  it('sin estado, la columna estado va NULL y no «Lima»', async () => {
    // Éste es el que el cliente leía: la liga pública imprime «alcaldía · estado».
    const valor = await capturarInsert({})
    expect(valor('estado')).toBeNull()
  })

  it('una pantalla de CDMX guarda CDMX, no Lima', async () => {
    // La otra mitad del caso: si el arreglo fuera «no escribir nunca la
    // columna», este caso lo delataría.
    const valor = await capturarInsert({ ciudad: 'Ciudad de México', estado: 'CDMX', alcaldia: 'Cuauhtémoc' })
    expect(valor('ciudad')).toBe('Ciudad de México')
    expect(valor('estado')).toBe('CDMX')
    expect(valor('alcaldia')).toBe('Cuauhtémoc')
  })
})

describe('rowToSitio — la lectura tampoco inventa el país', () => {
  it('una fila sin país devuelve null, no «PE»', async () => {
    expect(rowToSitio({ id: 's1', nombre: 'X' }).pais).toBeNull()
  })

  it('una fila con país devuelve el suyo', async () => {
    expect(rowToSitio({ id: 's1', nombre: 'X', pais: 'MX' }).pais).toBe('MX')
  })
})
