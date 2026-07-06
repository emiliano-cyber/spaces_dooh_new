// Aplica un archivo .sql (idempotente) contra la BD. Uso:
//   node scripts/apply-migration.mjs db/migrations/20260706_reserva_ttl.sql
import pg from 'pg'
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('Uso: node scripts/apply-migration.mjs <archivo.sql>')
  process.exit(1)
}
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'
const sql = readFileSync(file, 'utf8')
const pool = new pg.Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 4000 })

try {
  await pool.query(sql)
  const col = await pool.query(
    `select column_name from information_schema.columns
      where table_name='reservas' and column_name='expira_en'`,
  )
  const cnt = await pool.query(
    `select count(*)::int as n from reservas where estatus='TENTATIVA' and expira_en is not null`,
  )
  console.log('OK — columna expira_en presente:', col.rowCount === 1)
  console.log('Tentativas con expira_en seteado:', cnt.rows[0].n)
} catch (e) {
  console.error('ERROR aplicando migración:', e.message)
  process.exitCode = 2
} finally {
  await pool.end()
}
