// backend/scripts/revisar-relojes.ts
//
// Cuanto miente el reloj de cada equipo, medido contra el del servidor.
//
//   npm run revisar:relojes                  # toda la flota
//   npm run revisar:relojes -- autopista     # solo los que coincidan
//
// POR QUE HACE FALTA
// ------------------
// La hora que se sella en una evidencia sale del RELOJ DEL EQUIPO: los tres
// agentes mandan `taken_at` con su propia hora, en UTC. El servidor la guarda
// tal cual y ademas anota `uploaded_at`, que es la SUYA.
//
// Si un equipo sube la foto en cuanto la toma -que es lo normal-, esas dos horas
// tienen que diferir en segundos. Una diferencia sistematica de horas solo puede
// significar una cosa: el reloj del equipo esta corrido, y TODAS sus evidencias
// llevan una hora que no es. Eso importa mas de lo que parece: la evidencia es
// lo que se factura.
//
// El caso que lo destapo: "Autopista mex-qrto", con dos horas de atraso.
//
// LO QUE NO SE PUEDE HACER
// ------------------------
// Corregir `taken_at` sumandole la diferencia. Una foto tomada sin internet y
// subida dos horas despues tiene, legitimamente, esa diferencia; reescribirla
// convertiria un dato real en uno inventado. Por eso esto MIDE y avisa, y el
// arreglo es ponerle la hora al equipo.
//
// Por eso tambien se usa la MEDIANA y no el promedio: unas pocas fotos de una
// cola atrasada no deben mover el diagnostico del reloj.
import { pool } from '../src/config/database';

const FILTRO = process.argv.slice(2).join(' ').trim().toLowerCase();

// Por debajo de esto no es un reloj malo: es la red tardando en subir la foto.
const TOLERANCIA_S = 120;

type Fila = {
  id: number;
  name: string;
  app_version: string | null;
  fotos: number;
  mediana_s: number | null;
  min_s: number | null;
  max_s: number | null;
  ultima: string | null;
};

function humano(s: number): string {
  const signo = s < 0 ? '-' : '+';
  const a = Math.abs(s);
  if (a < 90) return `${signo}${a} s`;
  const m = Math.round(a / 60);
  if (m < 90) return `${signo}${m} min`;
  const h = a / 3600;
  return `${signo}${h.toFixed(1)} h`;
}

async function main() {
  // La diferencia, foto por foto, de las ultimas 200 de cada equipo.
  const [filas] = await pool.query<any[]>(
    `SELECT d.id, d.name, d.app_version,
            TIMESTAMPDIFF(SECOND, p.taken_at, p.uploaded_at) AS diff_s,
            p.uploaded_at
       FROM photos p
       JOIN devices d ON d.id = p.device_id
      WHERE p.uploaded_at IS NOT NULL
        AND p.uploaded_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY d.id, p.uploaded_at DESC`,
  );

  const porEquipo = new Map<number, { nombre: string; version: string | null; diffs: number[]; ultima: string }>();
  for (const f of filas as any[]) {
    if (!porEquipo.has(f.id)) {
      porEquipo.set(f.id, { nombre: f.name, version: f.app_version, diffs: [], ultima: f.uploaded_at });
    }
    const e = porEquipo.get(f.id)!;
    if (e.diffs.length < 200) e.diffs.push(Number(f.diff_s));
  }

  const resultado: Fila[] = [];
  for (const [id, e] of porEquipo) {
    if (FILTRO && !e.nombre.toLowerCase().includes(FILTRO)) continue;
    const orden = [...e.diffs].sort((a, b) => a - b);
    resultado.push({
      id,
      name: e.nombre,
      app_version: e.version,
      fotos: orden.length,
      mediana_s: orden.length ? orden[Math.floor(orden.length / 2)] : null,
      min_s: orden.length ? orden[0] : null,
      max_s: orden.length ? orden[orden.length - 1] : null,
      ultima: e.ultima ? new Date(e.ultima).toISOString() : null,
    });
  }

  if (!resultado.length) {
    console.log(`\nNo hay fotos de los ultimos 30 dias${FILTRO ? ` para "${FILTRO}"` : ''}.\n`);
    process.exit(0);
  }

  resultado.sort((a, b) => Math.abs(b.mediana_s ?? 0) - Math.abs(a.mediana_s ?? 0));

  console.log('\nDESFASE DEL RELOJ DE CADA EQUIPO (hora del servidor menos la del equipo)');
  console.log('Positivo = el equipo va ATRASADO. Lo normal son segundos.\n');
  console.log('  id  equipo                                   fotos   mediana     rango');
  console.log('  ──  ───────────────────────────────────────  ─────  ────────  ──────────────');

  let sospechosos = 0;
  for (const r of resultado) {
    const mal = Math.abs(r.mediana_s ?? 0) > TOLERANCIA_S;
    if (mal) sospechosos++;
    const marca = mal ? '⚠ ' : '  ';
    console.log(
      `${marca}${String(r.id).padStart(3)}  ${r.name.slice(0, 39).padEnd(39)}  ${String(r.fotos).padStart(5)}  ` +
      `${humano(r.mediana_s ?? 0).padStart(8)}  ${humano(r.min_s ?? 0)} .. ${humano(r.max_s ?? 0)}`,
    );
  }

  if (sospechosos) {
    console.log(`\n${sospechosos} equipo(s) con el reloj corrido mas de ${TOLERANCIA_S} s.`);
    console.log('\nQUE SIGNIFICA Y COMO SE ARREGLA');
    console.log('  La hora de sus evidencias es la de SU reloj, asi que esta corrida lo mismo.');
    console.log('  No se arregla desde el servidor: hay que ponerle la hora al equipo.');
    console.log('');
    console.log('  Android    Ajustes > Sistema > Fecha y hora > "Usar la hora de la red" ENCENDIDO.');
    console.log('             Sin eso, un telefono que se quedo sin bateria vuelve con la hora mal.');
    console.log('  Raspberry  No tiene reloj de pila: si arranca sin internet se queda con la del');
    console.log('             ultimo apagado. Comprobar:  timedatectl status');
    console.log('             y que el NTP salga (algunas SIM bloquean el udp/123).');
    console.log('  PC         w32tm /resync   y que el servicio de hora este en automatico.');
    console.log('');
    console.log('  Ojo: una diferencia GRANDE solo en el maximo, con mediana chica, no es el');
    console.log('  reloj: son fotos que se quedaron en la cola sin internet y subieron despues.');
  } else {
    console.log('\nTodos los relojes dentro de tolerancia.');
  }

  console.log('');
  await pool.end();
  process.exit(sospechosos ? 1 : 0);
}

main().catch((e) => {
  console.error(`\nNo pude revisar: ${e.message}\n`);
  process.exit(1);
});
