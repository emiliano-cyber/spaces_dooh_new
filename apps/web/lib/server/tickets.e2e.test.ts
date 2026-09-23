import { describe, it, expect, beforeAll } from 'vitest'
import { recrearEsquema, poolTest } from '@/lib/test/db-e2e'

describe('tabla tickets', () => {
  beforeAll(async () => { await recrearEsquema() })

  it('existe, tiene tenant_id y RLS encendida', async () => {
    const p = poolTest()
    const { rows } = await p.query(
      `select relrowsecurity from pg_class where relname = 'tickets'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('tiene la politica tenant_isolation', async () => {
    const p = poolTest()
    const { rows } = await p.query(
      `select policyname from pg_policies where tablename = 'tickets'`,
    )
    expect(rows.map((r) => r.policyname)).toContain('tenant_isolation')
  })
})
