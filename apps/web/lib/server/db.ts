import 'server-only'
import { Pool } from 'pg'

// ============================================================================
//  lib/server/db.ts — Pool de PostgreSQL (solo servidor)
// ----------------------------------------------------------------------------
//  Conexión única reutilizada entre route handlers. La URL se toma de
//  DATABASE_URL; por defecto apunta al Postgres local del docker-compose
//  (db/docker-compose.yml → puerto 5433).
// ============================================================================

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'

// Reusar el pool entre hot-reloads en dev (evita agotar conexiones).
const g = globalThis as unknown as { _pgPool?: Pool }
export const pool: Pool =
  g._pgPool ?? new Pool({ connectionString: DATABASE_URL, max: 10 })
if (process.env.NODE_ENV !== 'production') g._pgPool = pool

// Helper de consulta tipado.
export async function q<T = any>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await pool.query(text, params as any[])
  return res.rows as T[]
}

export async function q1<T = any>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await q<T>(text, params)
  return rows[0] ?? null
}
