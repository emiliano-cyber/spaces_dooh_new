import 'server-only'
import { Pool } from 'pg'
import type { PoolClient } from 'pg'

// ============================================================================
//  lib/server/db.ts — Pool de PostgreSQL (solo servidor)
// ----------------------------------------------------------------------------
//  Conexión única reutilizada entre route handlers. La URL se toma de
//  DATABASE_URL; por defecto apunta al Postgres local del docker-compose
//  (db/docker-compose.yml → puerto 5433).
//
//  Aislamiento multi-tenant (RLS): `q()/q1()` fijan `app.tenant_id` del tenant
//  activo de la request de forma TRANSACTION-LOCAL (set_config(..., true)) antes
//  de cada consulta. Nunca a nivel de sesión: el pool reusa conexiones entre
//  tenants y un GUC de sesión filtraría datos de otro tenant.
//
//  `qRaw()/qRaw1()` NO fijan tenant: solo para el bootstrap (tenants, usuarios,
//  sesiones) que se resuelve ANTES de conocer el tenant. Esas tablas quedan
//  exentas de RLS fail-closed.
// ============================================================================

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'

// Reusar el pool entre hot-reloads en dev (evita agotar conexiones).
const g = globalThis as unknown as { _pgPool?: Pool }
export const pool: Pool =
  g._pgPool ?? new Pool({ connectionString: DATABASE_URL, max: 10 })
if (process.env.NODE_ENV !== 'production') g._pgPool = pool

// Tenant activo de la request (import perezoso para evitar el ciclo db<->tenant).
async function tenantDeRequest(): Promise<string> {
  const { tenantActual } = await import('./tenant')
  return (await tenantActual()) ?? ''
}

// Fija app.tenant_id (transaction-local) en un client YA dentro de transacción.
// Úsalo tras `begin` en las transacciones explícitas (pool.connect()).
export async function fijarTenant(client: PoolClient): Promise<void> {
  await client.query("select set_config('app.tenant_id', $1, true)", [await tenantDeRequest()])
}

// ─── Consultas SIN contexto de tenant (bootstrap / tablas exentas) ───────────
export async function qRaw<T = any>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await pool.query(text, params as any[])
  return res.rows as T[]
}
export async function qRaw1<T = any>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await qRaw<T>(text, params)
  return rows[0] ?? null
}

// ─── Consultas CON contexto de tenant (RLS) ──────────────────────────────────
export async function q<T = any>(text: string, params?: unknown[]): Promise<T[]> {
  const tenant = await tenantDeRequest()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query("select set_config('app.tenant_id', $1, true)", [tenant])
    const res = await client.query(text, params as any[])
    await client.query('commit')
    return res.rows as T[]
  } catch (e) {
    try { await client.query('rollback') } catch { /* noop */ }
    throw e
  } finally {
    client.release()
  }
}
export async function q1<T = any>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await q<T>(text, params)
  return rows[0] ?? null
}

// Transacción multi-statement con app.tenant_id ya fijado. Para operaciones que
// necesitan varias sentencias atómicas dentro del mismo tenant.
export async function withTenantTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const tenant = await tenantDeRequest()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query("select set_config('app.tenant_id', $1, true)", [tenant])
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (e) {
    try { await client.query('rollback') } catch { /* noop */ }
    throw e
  } finally {
    client.release()
  }
}
