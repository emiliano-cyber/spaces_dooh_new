// backend/scripts/ajustar-reloj.ts
//
// Endereza la hora de las evidencias de un equipo cuyo reloj esta corrido, sin
// ir al sitio y sin tocar su programa.
//
//   npm run ajustar:reloj -- --equipo autopista            # mide y propone
//   npm run ajustar:reloj -- --equipo autopista --aplicar  # lo deja puesto
//   npm run ajustar:reloj -- --equipo autopista --cero     # deshace
//
// COMO LO MIDE
// ------------
// La APK captura y sube en el acto: no guarda fotos en cola. Asi que para un
// telefono, la diferencia entre la hora que SELLA (`taken_at`, su reloj) y la
// que el servidor ANOTA al recibirla (`uploaded_at`, el nuestro) tiene que ser
// de segundos. Lo que sobre de ahi es lo que su reloj miente.
//
// Se usa la mediana: una foto que tardo en subir por mala red no debe mover el
// diagnostico. Y se exige que las muestras esten de acuerdo entre si -poca
// dispersion-, porque un reloj corrido miente SIEMPRE lo mismo; si cada foto
// dice una cosa distinta, eso no es el reloj y sumarle un numero fijo lo
// empeoraria.
//
// QUE NO HACE
// -----------
// No reescribe `photos.taken_at`. Guarda el desfase en el equipo y la hora se
// endereza AL LEER (migracion 018). Asi el dato crudo sigue ahi -es el unico
// testigo de que ese reloj esta mal-, las fotos viejas quedan bien sin tocarlas,
// y poner el desfase en cero deshace todo sin restaurar nada.
//
// Y NO SUSTITUYE A ARREGLAR EL RELOJ. Es un parche para que las evidencias sean
// utiles mientras tanto. Un telefono con la hora mal tambien dispara sus fotos
// programadas a deshora, y eso esto no lo arregla.
import { pool } from '../src/config/database';

const args = process.argv.slice(2);
const valor = (bandera: string) => {
  const i = args.indexOf(bandera);
  return i >= 0 ? args[i + 1] : undefined;
};
const FILTRO = (valor('--equipo') ?? '').toLowerCase();
const APLICAR = args.includes('--aplicar');
const CERO = args.includes('--cero');

// Por debajo de esto no es el reloj: es la red.
const TOLERANCIA_S = 120;
// Si las muestras discrepan mas que esto entre si, no es un reloj corrido.
const DISPERSION_MAX_S = 300;
const MINIMO_FOTOS = 5;

function humano(s: number): string {
  const a = Math.abs(s);
  const signo = s < 0 ? '-' : '+';
  if (a < 90) return `${signo}${a} s`;
  if (a < 5400) return `${signo}${Math.round(a / 60)} min`;
  return `${signo}${(a / 3600).toFixed(2)} h`;
}

async function main() {
  if (!FILTRO) {
    console.log('\nFalta a que equipo: npm run ajustar:reloj -- --equipo <parte del nombre>\n');
    process.exit(1);
  }

  const [equipos] = await pool.query<any[]>(
    `SELECT id, name, app_version, clock_offset_s FROM devices WHERE LOWER(name) LIKE ?`,
    [`%${FILTRO}%`],
  );
  if (!(equipos as any[]).length) {
    console.log(`\nNingun equipo se llama algo como "${FILTRO}".\n`);
    process.exit(1);
  }
  if ((equipos as any[]).length > 1) {
    console.log(`\nHay ${(equipos as any[]).length} equipos que coinciden. Se mas concreto:`);
    for (const e of equipos as any[]) console.log(`  #${e.id}  ${e.name}`);
    console.log('');
    process.exit(1);
  }

  const eq = (equipos as any[])[0];
  console.log(`\nEquipo #${eq.id} — ${eq.name}`);
  console.log(`Programa: ${eq.app_version ?? '(desconocido)'}`);
  console.log(`Desfase puesto hoy: ${eq.clock_offset_s === 0 ? 'ninguno' : humano(eq.clock_offset_s)}`);

  // ─── Deshacer ─────────────────────────────────────────────────────────────
  if (CERO) {
    await pool.query(`UPDATE devices SET clock_offset_s = 0 WHERE id = ?`, [eq.id]);
    console.log('\nDesfase puesto en 0: las horas vuelven a ser las que manda el equipo.\n');
    await pool.end();
    return;
  }

  // ─── Medir ────────────────────────────────────────────────────────────────
  // OJO: se mide contra el CRUDO (`p.taken_at`), no contra el corregido, para
  // que medir dos veces no acumule el ajuste.
  const [filas] = await pool.query<any[]>(
    `SELECT TIMESTAMPDIFF(SECOND, p.taken_at, p.uploaded_at) AS diff_s
       FROM photos p
      WHERE p.device_id = ? AND p.uploaded_at IS NOT NULL
      ORDER BY p.uploaded_at DESC
      LIMIT 200`,
    [eq.id],
  );
  const diffs = (filas as any[]).map((f) => Number(f.diff_s)).sort((a, b) => a - b);

  if (diffs.length < MINIMO_FOTOS) {
    console.log(`\nSolo hay ${diffs.length} foto(s). Con menos de ${MINIMO_FOTOS} no se puede afirmar nada.\n`);
    process.exit(1);
  }

  const mediana = diffs[Math.floor(diffs.length / 2)];
  const q1 = diffs[Math.floor(diffs.length * 0.25)];
  const q3 = diffs[Math.floor(diffs.length * 0.75)];
  const dispersion = q3 - q1;

  console.log(`\nMedido sobre ${diffs.length} fotos:`);
  console.log(`  mediana del desfase   ${humano(mediana)}   (el servidor va por delante del equipo)`);
  console.log(`  dispersion (q1..q3)   ${humano(q1)} .. ${humano(q3)}`);

  if (Math.abs(mediana) <= TOLERANCIA_S) {
    console.log(`\nEse reloj esta bien (menos de ${TOLERANCIA_S} s). No hay nada que ajustar.\n`);
    await pool.end();
    return;
  }
  if (dispersion > DISPERSION_MAX_S) {
    console.log(`\nLas fotos NO coinciden entre si (${humano(dispersion)} de dispersion).`);
    console.log('Un reloj corrido miente siempre lo mismo; esto parece otra cosa —red mala, o');
    console.log('fotos que se quedaron esperando—. Sumar un numero fijo lo empeoraria.\n');
    process.exit(1);
  }

  const propuesta = Math.round(mediana);
  console.log(`\nPropuesta: sumarle ${humano(propuesta)} a la hora de sus fotos.`);
  console.log('Con eso, las evidencias -viejas y nuevas- salen con la hora buena.');

  if (!APLICAR) {
    console.log('\nNo se ha cambiado nada. Para dejarlo puesto:');
    console.log(`  npm run ajustar:reloj -- --equipo ${FILTRO} --aplicar\n`);
    await pool.end();
    return;
  }

  await pool.query(`UPDATE devices SET clock_offset_s = ? WHERE id = ?`, [propuesta, eq.id]);
  console.log(`\nAplicado: ${humano(propuesta)} en el equipo #${eq.id}.`);
  console.log('\nRECUERDA que esto NO le pone la hora al telefono. Sus fotos programadas');
  console.log('siguen disparandose a deshora hasta que alguien encienda "Usar la hora de la');
  console.log('red" en Ajustes > Sistema > Fecha y hora. Para deshacerlo: --cero\n');
  await pool.end();
}

main().catch((e) => {
  console.error(`\nNo pude ajustar: ${e.message}\n`);
  process.exit(1);
});
