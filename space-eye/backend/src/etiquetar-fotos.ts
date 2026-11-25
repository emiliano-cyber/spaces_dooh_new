// backend/src/etiquetar-fotos.ts
//
// Reconoce hacia atras las fotos que ya estan guardadas: que creativo salia en
// cada una (migracion 034).
//
//   node dist/etiquetar-fotos.js <device_id> [--desde=2026-10-01] [--tope=2000] [--aplicar]
//
// POR QUE EXISTE. Desde la 034 cada foto que llega queda etiquetada con el
// creativo que ensena, y con eso se sacan los comprobantes de una campana sin
// abrirlas una por una. Las fotos ANTERIORES no dicen nada: la etiqueta se
// calculaba y se tiraba. Este guion las mira otra vez.
//
// No cuesta datos moviles: las fotos estan en el disco del droplet y ya se
// pagaron. Cuesta CPU -hay que decodificar y enderezar cada JPEG-, asi que va
// por equipo, con tope, y de uno en uno a proposito: es trabajo de fondo y no
// debe competir con las subidas de la flota.
//
// VIVE EN src/ Y NO EN scripts/ porque hay que poder correrlo DONDE ESTAN LAS
// FOTOS. La imagen de la instancia no lleva el repositorio ni tsx: solo
// `dist`, igual que `dist/migrar.js`. Un guion en scripts/ solo serviria en un
// equipo de desarrollo, que es justo donde no hay nada que etiquetar.
//
// ENSAYO POR OMISION. Sin `--aplicar` no escribe nada: cuenta cuantas
// reconoceria y ensena las primeras. Es la unica forma de ver, antes de tocar
// miles de filas, si la tolerancia del sitio esta bien puesta.
//
// LO QUE NO HACE: registrar creativos nuevos. Una foto que no casa con nada se
// queda sin etiqueta. En vivo el servidor si los registra -ahi la foto acaba de
// llegar y se sabe de cuando es-, pero hacerlo en lote sobre meses de historia
// llenaria el catalogo de anuncios que ya no existen, con fecha de hoy, y
// ninguno tendria manera de distinguirse de uno de verdad.
import { pool } from './config/database';
import {
  configDe,
  enderezarDeEquipo,
  yaConocida,
} from './controllers/creativos.controller';
import { medirPantalla } from './utils/enderezar';
import { calcular } from './utils/huella';
import { leerStored } from './services/photoStorage.service';

const DID = Number(process.argv[2] || 0);
const bandera = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const DESDE = bandera('desde') || '';
const TOPE = Number(bandera('tope') || 2000);
const APLICAR = process.argv.includes('--aplicar');

async function main() {
  if (!DID) {
    console.error('uso: node dist/etiquetar-fotos.js <device_id> [--desde=YYYY-MM-DD] [--tope=N] [--aplicar]');
    process.exit(1);
  }

  const cfg = await configDe(DID);
  if (!cfg) {
    console.error(`no existe el equipo ${DID}`);
    process.exit(1);
  }
  // No se exige `creative_watch`: un sitio puede tener catalogo de cuando lo
  // tenia encendido, y esas fotos se pueden etiquetar igual. Lo que si hace
  // falta es catalogo, porque sin el no hay con que comparar.
  const [cat] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM device_creatives WHERE device_id = ? AND descartado = 0`, [DID]);
  const enCatalogo = Number((cat as any[])[0]?.n || 0);
  if (!enCatalogo) {
    console.error(`el equipo ${DID} no tiene catalogo de creativos: no hay con que comparar`);
    process.exit(1);
  }

  const [filas] = await pool.query<any[]>(
    `SELECT id, storage_path, taken_at FROM photos
      WHERE device_id = ? AND creativo IS NULL AND storage_path IS NOT NULL
        ${DESDE ? 'AND taken_at >= ?' : ''}
      ORDER BY taken_at DESC
      LIMIT ?`,
    DESDE ? [DID, DESDE, TOPE] : [DID, TOPE]
  );

  const fotos = filas as any[];
  console.log(`equipo ${DID} · ${enCatalogo} creativos en catalogo · tolerancia ${cfg.tolerancia ?? 24} bits`);
  console.log(`${fotos.length} fotos sin etiquetar${DESDE ? ` desde ${DESDE}` : ''}${APLICAR ? '' : '  (ENSAYO: no se escribe nada)'}`);
  if (!fotos.length) return;

  let etiquetadas = 0, apagadas = 0, desconocidas = 0, ilegibles = 0;
  const muestra: string[] = [];

  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i];
    try {
      const gris = await enderezarDeEquipo(DID, await leerStored(f.storage_path));
      if (!gris) { ilegibles++; continue; }
      // La pantalla apagada NO se etiqueta. Daria huella -los reflejos la dan-
      // y casaria con cualquier cosa oscura del catalogo; un comprobante con
      // una pantalla apagada dentro es peor que uno con una foto de menos.
      if (medirPantalla(gris).apagada) { apagadas++; continue; }
      const h = calcular(gris.datos, gris.ancho, gris.alto);
      if (!h) { ilegibles++; continue; }
      const c = await yaConocida(DID, h);
      if (!c) { desconocidas++; continue; }

      etiquetadas++;
      if (muestra.length < 5) {
        const cuando = new Date(f.taken_at).toISOString().slice(0, 16).replace('T', ' ');
        muestra.push(`  foto ${f.id} (${cuando}) -> ${c.phash.slice(0, 12)}… a ${c.bits} bits`);
      }
      if (APLICAR) {
        await pool.query(`UPDATE photos SET creativo = ? WHERE id = ?`, [c.phash, f.id]);
        // Y si ese dia ese creativo no tenia foto, esta se la queda. Es lo que
        // llena la tira de dias hacia atras, y la foto ya existia.
        await pool.query(
          `INSERT INTO device_creative_dias (device_id, phash, dia, photo_id)
           VALUES (?, ?, DATE(?), ?)
           ON DUPLICATE KEY UPDATE photo_id = COALESCE(photo_id, VALUES(photo_id))`,
          [DID, c.phash, f.taken_at, f.id]
        ).catch(() => null);
      }
    } catch {
      ilegibles++;
    }
    if ((i + 1) % 100 === 0) console.log(`  … ${i + 1}/${fotos.length}`);
  }

  console.log('');
  console.log(`etiquetadas   ${etiquetadas}`);
  console.log(`sin catalogo  ${desconocidas}   (no casan con ningun creativo conocido)`);
  console.log(`apagadas      ${apagadas}`);
  console.log(`ilegibles     ${ilegibles}`);
  if (muestra.length) console.log(['', 'ejemplos:', ...muestra].join('\n'));
  if (!APLICAR) console.log('\nENSAYO. Vuelve a correrlo con --aplicar para escribirlo.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
