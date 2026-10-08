// backend/src/workers/espejoWorker.ts
// El espejo: trae a esta instancia (V2) lo que los equipos le reportan a V1.
//
// Ver utils/espejo.ts para el porque. Aqui solo se LEE de V1, siempre por llave
// primaria y en lotes chicos, para no cargarle nada a la instancia que la gente
// esta usando:
//
//   - Tablas chicas que administra V1 (equipos, grupos, campañas, programacion,
//     consumo): cada pocos segundos se copian enteras, solo las columnas que
//     tienen las dos versiones. Lo que V1 borro, se borra aqui.
//   - Tablas que solo crecen (fotos, estado, registros, ordenes, verificaciones):
//     se traen las filas nuevas por numero, y se refrescan las recientes porque
//     cambian despues de creadas (una orden pasa a "done", una foto se verifica).
//
// Nunca se usa REPLACE: borra y vuelve a insertar, y con eso las llaves foraneas
// en cascada se llevarian lo que solo existe aqui (fallas, creativos). Siempre
// INSERT ... ON DUPLICATE KEY UPDATE.
//
// Ademas escucha los avisos en vivo de V1 (equipo conectado, estado nuevo, oferta
// de video) y los repite aqui, asi el dashboard se mueve igual que en V1.
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { BASE_PROPIO, baseV1, columnasV1, estadoEspejo, redisDeV1 } from '../utils/espejo';
import { atenderCandidato, atenderOferta } from '../utils/relayTelefono';
import { publicarAEquipos } from '../utils/espejo';
import { registrarCandidato } from '../utils/iceDiag';

// Las que administra V1 y caben enteras en una consulta.
const CHICAS = ['device_groups', 'devices', 'campaigns', 'campaign_devices', 'schedules', 'device_data_usage'];
// Las que solo crecen. `recientes`: cuanto hacia atras se refresca, y por que
// columna de fecha.
const CRECEN: { tabla: string; fecha?: string; horas?: number }[] = [
  { tabla: 'photos', fecha: 'uploaded_at', horas: 48 },
  { tabla: 'verifications', fecha: 'created_at', horas: 48 },
  { tabla: 'commands', fecha: 'created_at', horas: 2 },
  { tabla: 'device_status' },
  { tabla: 'device_logs' },
];
const LOTE = 500;
const CADA_MS = 4000;

const columnasLocales = new Map<string, Set<string>>();
async function columnasAqui(tabla: string) {
  let c = columnasLocales.get(tabla);
  if (!c) {
    const [f] = await pool.query<any[]>(
      `SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`, [tabla]);
    c = new Set((f as any[]).map((r) => r.c ?? r.COLUMN_NAME));
    columnasLocales.set(tabla, c);
  }
  return c;
}

/** Las columnas que tienen las dos versiones de la tabla, o null si falta en alguna. */
async function comunes(tabla: string): Promise<string[] | null> {
  const [v1, aqui] = [await columnasV1(tabla), await columnasAqui(tabla)];
  if (!v1.size || !aqui.size) return null;
  return [...v1].filter((c) => aqui.has(c));
}

// mysql2 devuelve los JSON ya convertidos en objeto, y al reinsertar un objeto lo
// escribe como "clave = valor": hay que volverlo texto.
const valor = (v: unknown) =>
  v !== null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v;

async function escribir(tabla: string, cols: string[], filas: any[]) {
  if (!filas.length) return;
  const lista = cols.map((c) => `\`${c}\``).join(', ');
  const marcas = `(${cols.map(() => '?').join(', ')})`;
  const actualizar = cols.filter((c) => c !== 'id').map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
  const valores = filas.flatMap((f) => cols.map((c) => valor(f[c])));
  await pool.query(
    `INSERT INTO \`${tabla}\` (${lista}) VALUES ${filas.map(() => marcas).join(', ')}
     ON DUPLICATE KEY UPDATE ${actualizar || '`id` = `id`'}`,
    valores);
}

async function copiarChica(tabla: string) {
  const cols = await comunes(tabla);
  if (!cols) return;
  const [filas] = await baseV1().query<any[]>(`SELECT ${cols.map((c) => `\`${c}\``).join(', ')} FROM \`${tabla}\``);
  const lista = filas as any[];
  for (let i = 0; i < lista.length; i += LOTE) await escribir(tabla, cols, lista.slice(i, i + LOTE));
  // Lo que V1 ya no tiene, tampoco aqui (tablas con llave `id`).
  if (cols.includes('id')) {
    const ids = lista.map((f) => f.id);
    // Solo entre los numeros de V1: lo propio de esta instancia no se toca.
    if (ids.length) await pool.query(`DELETE FROM \`${tabla}\` WHERE id NOT IN (?) AND id < ?`, [ids, BASE_PROPIO]);
    else await pool.query(`DELETE FROM \`${tabla}\` WHERE id < ?`, [BASE_PROPIO]);
  }
}

// Hasta donde ya se copio cada tabla que crece. En Redis, para sobrevivir a un
// reinicio sin volver a leer todo.
async function cursor(tabla: string): Promise<number> {
  const v = await redis.get(`espejo:cursor:${tabla}`);
  if (v != null) return Number(v);
  // Primera vez: se arranca desde lo que ya trajo el volcado inicial.
  const [f] = await pool.query<any[]>(`SELECT COALESCE(MAX(id), 0) AS m FROM \`${tabla}\` WHERE id < ?`, [BASE_PROPIO]);
  return Number((f as any[])[0].m);
}

async function copiarNuevas(t: { tabla: string; fecha?: string; horas?: number }, refrescar: boolean) {
  const cols = await comunes(t.tabla);
  if (!cols || !cols.includes('id')) return;
  const sel = cols.map((c) => `\`${c}\``).join(', ');
  let desde = await cursor(t.tabla);
  for (;;) {
    const [filas] = await baseV1().query<any[]>(
      `SELECT ${sel} FROM \`${t.tabla}\` WHERE id > ? ORDER BY id LIMIT ${LOTE}`, [desde]);
    const lista = filas as any[];
    if (!lista.length) break;
    await escribir(t.tabla, cols, lista);
    desde = lista[lista.length - 1].id;
    await redis.set(`espejo:cursor:${t.tabla}`, String(desde));
    if (lista.length < LOTE) break;
  }
  if (refrescar && t.fecha && cols.includes(t.fecha)) {
    const [filas] = await baseV1().query<any[]>(
      `SELECT ${sel} FROM \`${t.tabla}\` WHERE \`${t.fecha}\` >= NOW() - INTERVAL ? HOUR ORDER BY id LIMIT 5000`, [t.horas ?? 24]);
    const lista = filas as any[];
    for (let i = 0; i < lista.length; i += LOTE) await escribir(t.tabla, cols, lista.slice(i, i + LOTE));
  }
}

let vuelta = 0;
let corriendo = false;
let ultimoError = '';

async function unaVuelta() {
  if (corriendo) return;
  corriendo = true;
  try {
    // Equipos en cada vuelta (es lo que se mira: en linea, ultimo contacto); el
    // resto de las chicas, cada ~30 s.
    const chicas = vuelta % 8 === 0 ? CHICAS : ['devices'];
    for (const t of chicas) await copiarChica(t);
    const refrescar = vuelta % 8 === 0;
    for (const t of CRECEN) await copiarNuevas(t, refrescar);
    vuelta++;
    estadoEspejo.ultima = new Date();
    estadoEspejo.error = '';
    if (ultimoError) { console.log('[Espejo] recuperado'); ultimoError = ''; }
  } catch (e: any) {
    estadoEspejo.error = e.message;
    // Una vez por error distinto, no cada 4 segundos.
    if (e.message !== ultimoError) console.error('[Espejo] fallo la copia:', e.message);
    ultimoError = e.message;
  } finally {
    corriendo = false;
  }
}

/** Los avisos en vivo de V1, repetidos aqui. */
async function escucharAV1() {
  const sub = (await redisDeV1()).duplicate();
  sub.on('error', () => { /* el cliente principal ya lo anota */ });
  await sub.connect();

  // Estado y conexion: se refresca la ficha del equipo y se repite el aviso
  // para los dashboards de aqui.
  for (const canal of ['device:online', 'device:status']) {
    await sub.subscribe(canal, async (msg) => {
      if (canal === 'device:online') await copiarChica('devices').catch(() => {});
      await redis.publish(canal, msg);
    });
  }

  // Video: si la vista de ese equipo se abrio AQUI y se reparte por el servidor
  // de medios, la oferta la contesta esta instancia, y la respuesta le llega al
  // telefono por el buzon de V1. Si no, se repite aqui por si un visor punto a
  // punto de este dashboard la esta esperando.
  await sub.subscribe('webrtc:device_offer', async (msg) => {
    const d = JSON.parse(msg);
    const did = Number(d.device_id);
    const atendida = await atenderOferta(did, d, (r) =>
      publicarAEquipos('webrtc:dashboard_answer', { device_id: did, sdp: r.sdp, user_id: null }));
    if (!atendida) await redis.publish('webrtc:device_offer', msg);
  });
  await sub.subscribe('webrtc:device_ice', async (msg) => {
    const d = JSON.parse(msg);
    const did = Number(d.device_id);
    registrarCandidato(did, d?.candidate?.candidate);
    if (!atenderCandidato(did, d)) await redis.publish('webrtc:device_ice', msg);
  });
  console.log('[Espejo] escuchando a V1');
}

/**
 * Lo que nace aqui (un equipo conectado directo, sus fotos, sus ordenes) toma
 * numeros desde BASE_PROPIO. Sin esto, la siguiente foto propia tomaria el
 * numero que V1 le dara a su proxima foto, y el espejo la pisaria.
 */
async function separarNumeros() {
  for (const t of [...CHICAS, ...CRECEN.map((c) => c.tabla)]) {
    const [f] = await pool.query<any[]>(
      `SELECT AUTO_INCREMENT AS a FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`, [t]);
    const a = Number((f as any[])[0]?.a ?? 0);
    if ((f as any[]).length && a < BASE_PROPIO) await pool.query(`ALTER TABLE \`${t}\` AUTO_INCREMENT = ${BASE_PROPIO}`);
  }
}

console.log(`[Espejo] activo: esta instancia refleja los equipos de ${env.ESPEJO_NOMBRE}`);
separarNumeros().catch((e) => console.error('[Espejo] no se pudieron separar los numeros propios:', e.message));
void unaVuelta();
setInterval(() => void unaVuelta(), CADA_MS);
escucharAV1().catch((e) => console.error('[Espejo] no se pudo escuchar a V1:', e.message));
