import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/database';

async function migrate() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    process.exit(0);
  }

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [executed] = await pool.query<any[]>('SELECT filename FROM _migrations');
  const executedSet = new Set((executed as any[]).map((r: any) => r.filename));

  for (const file of files) {
    if (executedSet.has(file)) {
      console.log(`  SKIP  ${file} (already executed)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`  RUN   ${file}`);

    // Quitar lineas de comentario completas ANTES de partir por ';'. Si no,
    // un fragmento que empieza con "-- SECCION\nCREATE TABLE..." se descartaria
    // entero al filtrar por startsWith('--'), perdiendo el CREATE que le sigue.
    const cleaned = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleaned
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        // Ignore "already exists" errors for IF NOT EXISTS statements
        if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_ENTRY') {
          continue;
        }
        throw err;
      }
    }

    await pool.query('INSERT INTO _migrations (filename) VALUES (?)', [file]);
    console.log(`  DONE  ${file}`);
  }

  console.log('Migrations complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
