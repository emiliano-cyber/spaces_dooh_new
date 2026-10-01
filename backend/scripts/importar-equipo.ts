// backend/scripts/importar-equipo.ts
// Trae a esta instancia (V2) un equipo de OTRA instancia con todo su historial:
// fotos, fallas, creativos, estado, registros y ordenes.
//
// Se uso para mudar el telefono de pruebas de :4100 a :4200. Los datos de la
// otra instancia se cargan antes en una base aparte del mismo servidor
// (`prueba_import`, un mysqldump filtrado por equipo); este script los copia a
// la base de verdad corriendo cada numero (el del equipo, el de cada foto, cada
// orden...) a la zona propia de V2 (BASE_PROPIO en adelante). Asi no chocan con
// lo que trae el espejo de V1, que conserva sus numeros, mas bajos.
//
//   node importar-equipo.js            (dentro del contenedor del backend)
//
// Es idempotente: INSERT IGNORE, se puede correr dos veces sin duplicar nada.
import mysql from 'mysql2/promise';

const BASE = 1_000_000_000;
const ORIGEN = process.env.ORIGEN_DB || 'prueba_import';
const DESTINO = process.env.DB_NAME || 'space_eye';
// En orden: primero el equipo y sus fotos, que los demas apuntan a ellos.
const TABLAS = ['devices', 'photos', 'commands', 'device_status', 'device_logs',
  'device_data_usage', 'pantalla_fallas', 'device_creatives', 'verifications'];
// Las columnas que son numeros de otra fila y hay que correr igual.
const REFERENCIAS = new Set(['id', 'device_id', 'photo_id', 'photo_recuperacion_id', 'command_id',
  'falla_id', 'verification_id', 'evidence_photo_id']);
const NUMERICOS = new Set(['int', 'bigint', 'mediumint', 'smallint', 'tinyint']);

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD,
  });

  for (const t of TABLAS) {
    const [cols] = await db.query<any[]>(
      `SELECT o.column_name AS c, o.data_type AS tipo
         FROM information_schema.columns o
         JOIN information_schema.columns d
           ON d.table_schema = ? AND d.table_name = o.table_name AND d.column_name = o.column_name
        WHERE o.table_schema = ? AND o.table_name = ?
        ORDER BY o.ordinal_position`, [DESTINO, ORIGEN, t]);
    const lista = cols as any[];
    if (!lista.length) { console.log(`  -   ${t}: no esta en las dos`); continue; }

    const exprs = lista.map(({ c, tipo }) => {
      const col = c ?? '';
      const t2 = String(tipo).toLowerCase();
      if (REFERENCIAS.has(col) && NUMERICOS.has(t2)) return `IF(o.\`${col}\` IS NULL, NULL, o.\`${col}\` + ${BASE})`;
      // Quien pidio una orden: si ese usuario no existe aqui, queda sin firma.
      if (col === 'created_by') return `IF(EXISTS(SELECT 1 FROM \`${DESTINO}\`.users u WHERE u.id = o.created_by), o.created_by, NULL)`;
      return `o.\`${col}\``;
    });
    const [r] = await db.query<any>(
      `INSERT IGNORE INTO \`${DESTINO}\`.\`${t}\` (${lista.map(({ c }) => `\`${c}\``).join(', ')})
       SELECT ${exprs.join(', ')} FROM \`${ORIGEN}\`.\`${t}\` o`);
    console.log(`  ok  ${t}: ${r.affectedRows} fila(s)`);
  }
  await db.end();
}

main().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
