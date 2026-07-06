// Aplica un archivo .sql (idempotente) contra la BD del BFF. Uso:
//   node scripts/apply-migration.mjs db/migrations/20260706_reserva_ttl.sql
//
// Resuelve DATABASE_URL en este orden: variable de entorno → .env del BFF
// (apps/web) → default local. Falla con código ≠0 si no puede aplicar, para que
// un deploy con `set -e` aborte ANTES de recargar la app (fail-closed).
import pg from 'pg'
import { readFileSync, existsSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('uso: node scripts/apply-migration.mjs <archivo.sql>')
  process.exit(1)
}

function resolveDbUrl() {
  if (process.env.DATABASE_URL) return { url: process.env.DATABASE_URL, fuente: 'entorno' }
  for (const f of ['apps/web/.env.production', 'apps/web/.env.local', 'apps/web/.env', '.env']) {
    if (existsSync(f)) {
      const m = readFileSync(f, 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m)
      if (m) return { url: m[1].replace(/^["']|["']$/g, ''), fuente: f }
    }
  }
  return { url: 'postgresql://spaces:spaces@localhost:5433/spaces', fuente: 'default local' }
}

const { url: DATABASE_URL, fuente } = resolveDbUrl()

// Log del destino SIN credenciales (host/puerto/db).
function destinoSeguro(u) {
  try {
    const x = new URL(u)
    return `${x.hostname}:${x.port || '5432'}${x.pathname}`
  } catch {
    return '(url no parseable)'
  }
}

const sql = readFileSync(file, 'utf8')
const pool = new pg.Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 8000 })

console.log(`→ ${file}`)
console.log(`  destino: ${destinoSeguro(DATABASE_URL)}  (fuente: ${fuente})`)

try {
  await pool.query(sql)
  console.log('  OK — migración aplicada (idempotente)')
} catch (e) {
  console.error('  ERROR aplicando migración:', e.message || e.code || e)
  process.exitCode = 2
} finally {
  await pool.end()
}
