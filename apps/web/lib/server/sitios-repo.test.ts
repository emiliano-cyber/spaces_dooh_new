import { describe, it, expect, vi } from 'vitest'
import type { PoolClient } from 'pg'

// React 18 solo expone cache() dentro del runtime de servidor de Next; fuera de
// él es undefined y lib/server/tenant.ts revienta al importarse. Identidad basta:
// aquí no se ejercita el memo, solo el armado del SQL.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const { insertarSitio } = await import('./sitios-repo')

// El insert de sitios arma columnas y placeholders desde COLS, pero los valores
// vienen de valoresDe(). Si las dos listas se desalinean, Postgres responde
// "bind message supplies N parameters, but prepared statement requires M" y el
// import de inventario muere con 500. Pasó de verdad: se añadieron pausa_legal,
// motivo_pausa_legal y pausa_legal_en a COLS sin añadir sus valores.
describe('insertarSitio', () => {
  it('manda tantos valores como placeholders tiene el insert', async () => {
    const queries: { sql: string; params: unknown[] }[] = []
    const fakeClient = {
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        return { rows: [{ id: 'sitio-1' }] }
      },
    } as unknown as PoolClient

    // tenantId explícito: evita tenantActual(), que necesita cookies de request.
    await insertarSitio(fakeClient, { nombre: 'Pantalla de prueba', tenantId: 'tenant-1' })

    const insert = queries.find((q) => q.sql.includes('insert into sitios'))
    expect(insert).toBeDefined()

    const placeholders = new Set(insert!.sql.match(/\$\d+/g) ?? [])
    expect(insert!.params).toHaveLength(placeholders.size)

    // Y los placeholders son $1..$N sin huecos.
    const maxPlaceholder = Math.max(...[...placeholders].map((p) => Number(p.slice(1))))
    expect(maxPlaceholder).toBe(insert!.params.length)
  })

  it('no escribe columnas de pausa legal: son del modulo de arrendadores', async () => {
    const queries: { sql: string; params: unknown[] }[] = []
    const fakeClient = {
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        return { rows: [{ id: 'sitio-1' }] }
      },
    } as unknown as PoolClient

    await insertarSitio(fakeClient, { nombre: 'Pantalla de prueba', tenantId: 'tenant-1' })

    const insert = queries.find((q) => q.sql.includes('insert into sitios'))!
    expect(insert.sql).not.toContain('pausa_legal')
    expect(insert.sql).not.toContain('motivo_pausa_legal')
  })
})
