// backend/src/migrar.ts
// Aplica las migraciones pendientes. Va DENTRO de la imagen (dist/migrar.js) y
// lo corre el actualizador de la instancia ANTES de cambiar de version, con el
// respaldo ya hecho:
//
//   node dist/migrar.js                      aplica lo que falte
//   node dist/migrar.js --revisar            solo dice que falta (codigo 3 si algo)
//   MIGRACIONES_BASE=014 node dist/migrar.js adopta una base que ya existia
//
// Por que no el scripts/migrate.ts de antes: partia todo por ';', y desde la 015
// las migraciones son procedimientos con DELIMITER $$ (para ser idempotentes en
// MySQL, que no tiene ADD COLUMN IF NOT EXISTS). Partidas por ';' se rompen a la
// mitad. Por eso en produccion se aplicaban a mano, una por una.
//
// LA REGLA MAS IMPORTANTE: una base con tablas pero sin registro de migraciones
// (la de produccion, que nacio por initdb) NO se adivina. Sin MIGRACIONES_BASE se
// niega a tocarla: aplicar la 001 encima de datos reales no es lo mismo que en
// una base vacia, y equivocarse ahi no tiene vuelta.
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const DIR = process.env.MIGRACIONES_DIR || path.join(__dirname, '../migrations');

/** Parte un archivo en sentencias respetando DELIMITER. Exportada para las pruebas. */
export function sentencias(sql: string): string[] {
  const salida: string[] = [];
  let delim = ';';
  let actual: string[] = [];
  for (const linea of sql.split(/\r?\n/)) {
    const t = linea.trim();
    const cambio = /^DELIMITER\s+(\S+)\s*$/i.exec(t);
    if (cambio) {
      if (actual.join('\n').trim()) salida.push(actual.join('\n').trim());
      actual = [];
      delim = cambio[1];
      continue;
    }
    if (!actual.length && (t.startsWith('--') || t === '')) continue;
    actual.push(linea);
    if (!t.startsWith('--') && t.endsWith(delim)) {
      const texto = actual.join('\n').trim();
      const sinDelim = texto.slice(0, texto.length - delim.length).trim();
      if (sinDelim && !/^(--[^\n]*\n?)*$/.test(sinDelim)) salida.push(sinDelim);
      actual = [];
    }
  }
  const resto = actual.join('\n').trim();
  if (resto && !/^(--[^\n]*\n?)*$/.test(resto)) salida.push(resto);
  return salida;
}

async function main() {
  const revisar = process.argv.includes('--revisar');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'space_eye',
    multipleStatements: false,
  });
  // Un solo actualizador a la vez: dos corriendo la misma migracion a la vez es
  // la forma mas rapida de dejar una base a medias.
  const [cand] = await db.query<any[]>(`SELECT GET_LOCK('space_eye_migrar', 60) AS ok`);
  if (Number((cand as any[])[0].ok) !== 1) { console.error('Otro proceso esta migrando; no se sigue.'); process.exit(4); }

  await db.query(`CREATE TABLE IF NOT EXISTS _migrations (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

  const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  const [hechas] = await db.query<any[]>(`SELECT filename FROM _migrations`);
  const yaHechas = new Set((hechas as any[]).map((r) => r.filename));

  if (!yaHechas.size) {
    const [t] = await db.query<any[]>(
      `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'devices'`);
    const conDatos = Number((t as any[])[0].n) > 0;
    const base = process.env.MIGRACIONES_BASE || '';
    if (conDatos && !base) {
      console.error('Esta base ya tiene tablas pero ningun registro de migraciones. No se adivina hasta donde esta:');
      console.error('  corre con MIGRACIONES_BASE=<ultima ya aplicada>, p. ej. MIGRACIONES_BASE=014');
      process.exit(5);
    }
    if (conDatos && base) {
      const adoptadas = archivos.filter((f) => f.slice(0, base.length) <= base);
      for (const f of adoptadas) {
        if (!revisar) await db.query(`INSERT IGNORE INTO _migrations (filename) VALUES (?)`, [f]);
        yaHechas.add(f);
      }
      console.log(`Base adoptada: ${adoptadas.length} migraciones dadas por aplicadas (hasta ${base}).`);
    }
  }

  const pendientes = archivos.filter((f) => !yaHechas.has(f));
  if (revisar) {
    console.log(pendientes.length ? `Pendientes: ${pendientes.join(', ')}` : 'Sin pendientes.');
    process.exit(pendientes.length ? 3 : 0);
  }
  for (const f of pendientes) {
    process.stdout.write(`  aplicando ${f} ... `);
    for (const s of sentencias(fs.readFileSync(path.join(DIR, f), 'utf8'))) await db.query(s);
    await db.query(`INSERT INTO _migrations (filename) VALUES (?)`, [f]);
    console.log('ok');
  }
  console.log(pendientes.length ? `${pendientes.length} migracion(es) aplicada(s).` : 'Sin pendientes.');
  await db.query(`SELECT RELEASE_LOCK('space_eye_migrar')`);
  await db.end();
}

if (require.main === module) {
  main().catch((e) => { console.error('FALLO la migracion:', e.message); process.exit(1); });
}
