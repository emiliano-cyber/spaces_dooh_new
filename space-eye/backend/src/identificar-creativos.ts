// backend/src/identificar-creativos.ts
//
// De quien es cada creativo del catalogo: lo casa con la creatividad que
// Operaciones ya subio para su campana (migracion 035).
//
//   node dist/identificar-creativos.js [device_id] [--aplicar]
//
// Sin device_id mira TODA la flota. Sin `--aplicar` no escribe nada: ensena
// que casaria y a cuantos bits, que es lo unico que permite juzgar el umbral
// antes de ponerle el nombre de un cliente a cientos de anuncios.
//
// POR QUE EXISTE. En vivo cada creativo nuevo se identifica solo, al
// registrarse. Los que YA estaban en el catalogo -meses de anuncios en g500-
// no se vuelven a registrar nunca, asi que sin esto se quedarian sin nombre
// para siempre. Tambien sirve despues de que Operaciones suba una campana
// nueva: lo que ya se habia visto en pantalla sin saber de quien era, queda
// identificado hacia atras.
//
// NO CUESTA NADA: ni una llamada a internet, ni una foto, ni una llave. Se
// comparan huellas de 256 bits que ya estan calculadas contra las de las
// creatividades, que se leen una vez y se recuerdan.
import { pool } from './config/database';
import { identificarCreativo } from './controllers/creativos.controller';

const DID = Number(process.argv[2]) || 0;
const APLICAR = process.argv.includes('--aplicar');

async function main() {
  const [filas] = await pool.query<any[]>(
    `SELECT c.device_id, c.phash, c.nombre, c.campaign_id, d.name AS equipo
       FROM device_creatives c
       JOIN devices d ON d.id = c.device_id
      WHERE c.descartado = 0 ${DID ? 'AND c.device_id = ?' : ''}
      ORDER BY c.device_id, c.ultima_vez DESC`,
    DID ? [DID] : []
  );
  console.log(`${filas.length} creativos en el catalogo${DID ? ` del equipo ${DID}` : ' de la flota'}` +
    `${APLICAR ? '' : '   (ENSAYO: no se escribe nada)'}`);
  if (!filas.length) return;

  let casados = 0, sinCasar = 0, yaEstaban = 0;
  const muestra: string[] = [];

  for (const f of filas as any[]) {
    const id = await identificarCreativo(String(f.phash));
    if (!id) { sinCasar++; continue; }
    if (f.campaign_id === id.campaign_id) { yaEstaban++; continue; }
    casados++;
    if (muestra.length < 10) {
      muestra.push(`  ${String(f.equipo).slice(0, 26).padEnd(26)} ${String(f.phash).slice(0, 10)}… ` +
        `-> ${id.nombre.slice(0, 40)} (${id.bits} bits)` +
        (f.nombre ? `  [tiene nombre a mano: «${f.nombre}»]` : ''));
    }
    if (APLICAR) {
      await pool.query(
        `UPDATE device_creatives SET campaign_id = ?, campana_bits = ?
          WHERE device_id = ? AND phash = ?`,
        [id.campaign_id, Math.min(255, id.bits), f.device_id, f.phash]
      );
    }
  }

  console.log('');
  console.log(`identificados   ${casados}`);
  console.log(`ya lo estaban   ${yaEstaban}`);
  console.log(`sin campana     ${sinCasar}   (ninguna creatividad se le parece lo bastante)`);
  if (muestra.length) console.log(['', 'ejemplos:', ...muestra].join('\n'));
  if (!APLICAR) console.log('\nENSAYO. Vuelve a correrlo con --aplicar para escribirlo.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
