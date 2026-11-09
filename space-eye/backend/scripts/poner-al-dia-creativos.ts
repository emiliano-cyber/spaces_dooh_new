// backend/scripts/poner-al-dia-creativos.ts
//
// Pone al dia el catalogo de creativos con las fotos que YA estan guardadas.
//
//   npm run creativos:al-dia                      solo dice que haria
//   npm run creativos:al-dia -- --aplicar         lo hace
//   npm run creativos:al-dia -- --equipo=6 --fotos=200 --aplicar
//
// Desde ahora, cada foto nueva del sitio pone al dia el catalogo sola
// (device.controller -> refrescarConFoto). Esto es para lo de ANTES: las fotos
// por horario de los ultimos meses ya ensenan la pantalla y nadie les saco la
// huella. El propio comentario de utils/huella.ts lo dice: 71 de las 130 fotos
// de creativo de g500 estan guardadas sin que nadie las use.
//
// No da de alta ningun creativo, solo refresca los que el equipo ya descubrio
// (el porque esta en refrescarConFoto). Y respeta `creative_refoto_h`, asi que
// por mucho que se corra no deja mas de una foto por creativo y por plazo.
import { readFile } from 'fs/promises';
import { join } from 'path';
import { pool } from '../src/config/database';
import { env } from '../src/config/env';
import { configDe, reconocerEnFoto, refrescarConFoto } from '../src/controllers/creativos.controller';

const APLICAR = process.argv.includes('--aplicar');
const EQUIPO = Number(/--equipo=(\d+)/.exec(process.argv.join(' '))?.[1] ?? 0);
const FOTOS = Number(/--fotos=(\d+)/.exec(process.argv.join(' '))?.[1] ?? 120);

/** El archivo de una foto, desde el disco de la instancia. */
async function leer(storagePath: string): Promise<Buffer | null> {
  if (env.STORAGE_DRIVER !== 'local') return null;
  // storage_path viene como "/storage/photos/..."; en disco cuelga de STORAGE_DIR.
  const rel = storagePath.replace(/^\/?storage\/?/, '');
  try {
    return await readFile(join(env.STORAGE_DIR, rel));
  } catch {
    return null;
  }
}

async function main() {
  if (env.STORAGE_DRIVER !== 'local') {
    console.log('Las fotos no estan en disco (STORAGE_DRIVER != local): este script no las puede leer.');
    process.exit(1);
  }
  if (!APLICAR) console.log('\n(en seco: no se escribe nada; agrega --aplicar)');

  const [equipos] = await pool.query<any[]>(
    `SELECT id, name FROM devices
      WHERE creative_watch = TRUE AND pantalla IS NOT NULL ${EQUIPO ? 'AND id = ?' : ''}
      ORDER BY id`, EQUIPO ? [EQUIPO] : []);
  if (!(equipos as any[]).length) {
    console.log('Ningun equipo con vigilancia de creativos y pantalla marcada.');
    process.exit(0);
  }

  let total = 0;
  for (const eq of equipos as any[]) {
    const cfg = await configDe(eq.id);
    const [fotos] = await pool.query<any[]>(
      // Las de creative_change ya se ligaron al subirse. Las demas -por horario,
      // a mano, de arranque- son las que nadie ha mirado.
      `SELECT id, storage_path, taken_at FROM photos
        WHERE device_id = ? AND source <> 'creative_change' AND storage_path IS NOT NULL
        ORDER BY taken_at DESC LIMIT ?`, [eq.id, FOTOS]);

    let puestas = 0;
    let sinArchivo = 0;
    for (const f of fotos as any[]) {
      const jpeg = await leer(String(f.storage_path));
      if (!jpeg) { sinArchivo++; continue; }
      // En seco se reconoce igual -que es lo que interesa saber antes de tocar
      // nada- pero no se escribe.
      if (APLICAR) {
        if (await refrescarConFoto(eq.id, jpeg, Number(f.id)).catch(() => null)) puestas++;
      } else {
        const r = await reconocerEnFoto(eq.id, jpeg).catch(() => null);
        if (r) puestas++;
      }
    }

    const [c] = await pool.query<any[]>(
      `SELECT COUNT(*) total, SUM(photo_id_ultima IS NOT NULL) con_ultima
         FROM device_creatives WHERE device_id = ?`, [eq.id]);
    const r = (c as any[])[0];
    console.log(`  equipo ${eq.id} ${String(eq.name ?? '').slice(0, 28).padEnd(28)} `
      + `fotas ${String((fotos as any[]).length).padStart(4)}  puestas al dia ${String(puestas).padStart(3)}  `
      + `catalogo ${r.con_ultima ?? 0}/${r.total}` + (sinArchivo ? `  (${sinArchivo} sin archivo)` : ''));
    total += puestas;
  }

  console.log(`\n${total} creativo(s) con foto nueva.`);
  if (!APLICAR) console.log('Nada se escribio. Con --aplicar se hace de verdad.');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
