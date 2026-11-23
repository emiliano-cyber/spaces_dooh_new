// backend/scripts/medir-obstruccion.ts
//
// ¿Separa de verdad el umbral de «algo delante de la pantalla»?
//
//   npx tsx scripts/medir-obstruccion.ts [device_id]
//
// LA PREGUNTA. `obstruccionEnFoto` dice que lo que cambio esta DELANTE de la
// pantalla cuando una parte buena de la imagen sigue siendo un creativo que ya
// conociamos. El umbral es PARECIDO_OBSTRUIDO = 0.45, y sale de la geometria
// del caso -un vehiculo tapa entre un cuarto y la mitad de la pantalla desde la
// altura de la camara-, NO de un conteo. Este guion hace el conteo.
//
// COMO. Los camiones ya estan en el catalogo de produccion: entraron como
// «creativos» que se vieron UNA vez y nunca mas. Asi que para cada creativo se
// mide su parecido con los demas del mismo sitio:
//
//   · un anuncio de verdad se parece POCO a los otros (son imagenes distintas);
//   · una foto con algo delante se parece MUCHO a uno de ellos -el que estaba
//     en pantalla en ese momento-, porque solo le falta el trozo tapado.
//
// Si los vistos una sola vez salen con parecidos altos y el resto bajos, el
// umbral separa. Si se mezclan, hay que moverlo ANTES de soltar esto en la
// flota: un umbral corto deja de registrar anuncios de verdad, y eso no avisa.
import { pool } from '../src/config/database';
import { enderezarDeEquipo } from '../src/controllers/creativos.controller';
import { bloquesDe, parecidoPorBloques } from '../src/utils/enderezar';
import { leerStored } from '../src/services/photoStorage.service';

const DID = Number(process.argv[2] || 0);

type Fila = { device_id: number; equipo: string; phash: string; vistas: number; ruta: string };

async function main() {
  // `photo_id_ultima` llego con la migracion 029. En una instancia anterior la
  // consulta reventaria entera, y este guion tiene que poder correrse justo
  // ahi: es donde estan las fotos viejas que hay que medir.
  const [cols] = await pool.query<any[]>(`SHOW COLUMNS FROM device_creatives LIKE 'photo_id_ultima'`);
  const hayUltima = (cols as any[]).length > 0;
  const ruta = hayUltima ? 'COALESCE(u.storage_path, p.storage_path)' : 'p.storage_path';
  const join = hayUltima ? 'LEFT JOIN photos u ON u.id = c.photo_id_ultima' : '';
  if (!hayUltima) console.log('(sin migracion 029: se mide con la foto del hallazgo)');

  const [filas] = await pool.query<any[]>(
    `SELECT c.device_id, d.name AS equipo, c.phash, c.vistas, ${ruta} AS ruta
       FROM device_creatives c
       JOIN devices d ON d.id = c.device_id
       LEFT JOIN photos p ON p.id = c.photo_id
       ${join}
      WHERE d.pantalla IS NOT NULL AND ${ruta} IS NOT NULL
        ${DID ? 'AND c.device_id = ?' : ''}
      ORDER BY c.device_id, c.vistas DESC`, DID ? [DID] : []);

  // Agrupado por equipo: un creativo solo se compara con los de SU pantalla.
  const porEquipo = new Map<number, Fila[]>();
  for (const f of filas as Fila[]) {
    if (!porEquipo.has(f.device_id)) porEquipo.set(f.device_id, []);
    porEquipo.get(f.device_id)!.push(f);
  }

  const unaVez: number[] = [];
  const varias: number[] = [];

  for (const [did, lista] of porEquipo) {
    if (lista.length < 2) continue;
    console.log(`\n${did} — ${String(lista[0].equipo).slice(0, 40)}  (${lista.length} creativos)`);

    const bloques = new Map<string, ReturnType<typeof bloquesDe>>();
    for (const c of lista) {
      try {
        const gris = await enderezarDeEquipo(did, await leerStored(c.ruta));
        if (gris) bloques.set(c.phash, bloquesDe(gris));
      } catch { /* una foto que ya no esta en disco no invalida la cuenta */ }
    }

    for (const c of lista) {
      const mio = bloques.get(c.phash);
      if (!mio) continue;
      let mejor = 0;
      for (const otro of lista) {
        if (otro.phash === c.phash) continue;
        const suyo = bloques.get(otro.phash);
        if (!suyo) continue;
        const p = parecidoPorBloques(mio, suyo);
        if (p > mejor) mejor = p;
      }
      (Number(c.vistas) <= 1 ? unaVez : varias).push(mejor);
      console.log(`   visto ${String(c.vistas).padStart(4)} vez(ces)   se parece ${(mejor * 100).toFixed(0).padStart(3)}% al mas parecido`
        + (mejor >= 0.45 ? '   <- lo marcaria como ALGO DELANTE' : ''));
    }
  }

  const resumen = (nombre: string, xs: number[]) => {
    if (!xs.length) return `${nombre}: ninguno`;
    const ord = [...xs].sort((a, b) => a - b);
    const mediana = ord[Math.floor(ord.length / 2)];
    const sobre = xs.filter((x) => x >= 0.45).length;
    return `${nombre}: ${xs.length}  ·  mediana ${(mediana * 100).toFixed(0)}%  ·  ${sobre} por encima del umbral`;
  };
  console.log('\n' + resumen('Vistos UNA sola vez (candidatos a camion)', unaVez));
  console.log(resumen('Vistos varias veces (anuncios de verdad)   ', varias));
  console.log('\nEl umbral separa si los de arriba estan casi todos por encima y los de abajo casi todos por debajo.');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
