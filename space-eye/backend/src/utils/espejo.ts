// backend/src/utils/espejo.ts
// MODO ESPEJO: esta instancia (V2) opera los equipos que estan conectados a otra
// (V1).
//
// Por que existe: los equipos en campo traen fija en su APK la direccion de V1, y
// no hay equipo de campo para reinstalarlos. Asi que V2 no los tiene conectados.
// Lo que si puede es hablar con ellos por donde V1 les habla: V1 manda todo a sus
// equipos a traves de canales de Redis ('device:command', 'camera:control',
// 'webrtc:dashboard_answer'...) y escribe lo que los equipos reportan en su base.
// V2 usa esos mismos canales y lee esa misma base. Para V1 es indistinguible de
// que alguien pulse un boton en su propio dashboard: no se le cambia codigo ni se
// le reinicia nada.
//
// Lo que es de V1 (equipos, fotos, estado, ordenes, campañas, programacion) se
// copia aqui (workers/espejoWorker.ts). Lo que solo existe en V2 (pantalla
// marcada, fallas, creativos, ajustes de vigilancia) vive solo aqui.
import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import { env } from '../config/env';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import type { Request, Response, NextFunction } from 'express';

export const espejoActivo = () => !!(env.ESPEJO_DB_HOST && env.ESPEJO_REDIS_URL);

/**
 * Desde aqui empiezan los numeros de lo que es PROPIO de esta instancia (un
 * equipo que se conecta directo a V2, como el telefono de pruebas, y todo lo
 * suyo). Lo que viene de V1 conserva su numero, que esta muy por debajo; asi
 * nunca chocan, y el espejo sabe que no le toca borrar ni pisar lo de arriba.
 */
export const BASE_PROPIO = 1_000_000_000;

/** El equipo esta conectado a V1 (se le habla por su buzon) y no a esta instancia. */
export const esDeV1 = (deviceId: number) => espejoActivo() && Number(deviceId) < BASE_PROPIO;

/** Como va la copia: lo lee el dashboard para avisar si el espejo se atraso. */
export const estadoEspejo = { ultima: null as Date | null, error: '' };

let poolV1: mysql.Pool | null = null;
let redisV1: ReturnType<typeof createClient> | null = null;

/** La base de V1. Solo se escribe en `commands` (y en lo que V1 tambien edita). */
export function baseV1(): mysql.Pool {
  if (!poolV1) {
    poolV1 = mysql.createPool({
      host: env.ESPEJO_DB_HOST,
      port: env.ESPEJO_DB_PORT,
      user: env.ESPEJO_DB_USER,
      password: env.ESPEJO_DB_PASSWORD,
      database: env.ESPEJO_DB_NAME,
      waitForConnections: true,
      // Pocas a proposito: V1 atiende a la gente y a la flota; el espejo no
      // tiene por que competirle conexiones.
      connectionLimit: 4,
      enableKeepAlive: true,
      timezone: 'Z',
    });
  }
  return poolV1;
}

const columnas = new Map<string, Set<string>>();

/** Las columnas que tiene una tabla en V1 (su esquema es el de antes). */
export async function columnasV1(tabla: string): Promise<Set<string>> {
  let c = columnas.get(tabla);
  if (!c) {
    const [filas] = await baseV1().query<any[]>(
      `SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`, [tabla]);
    c = new Set((filas as any[]).map((r) => r.c ?? r.COLUMN_NAME));
    columnas.set(tabla, c);
  }
  return c;
}

/** El Redis de V1: por aqui salen las ordenes hacia los equipos. */
export async function redisDeV1() {
  if (!redisV1) {
    redisV1 = createClient({
      url: env.ESPEJO_REDIS_URL,
      // Sin tope de reintentos: si V1 se reinicia, el espejo tiene que volver
      // solo en cuanto este de pie.
      socket: { reconnectStrategy: (n) => Math.min(n * 500, 10000) },
    });
    redisV1.on('error', (e) => {
      if (!(e as any)._logged) { console.error('[Espejo] Redis de V1:', e.message); (e as any)._logged = true; }
    });
    await redisV1.connect();
  }
  return redisV1;
}

/**
 * Publica un mensaje para los equipos. En una instancia normal va a su propio
 * Redis (lo recoge su deviceSocket); en modo espejo, al de V1 (lo recoge el
 * deviceSocket de V1, que es el que tiene a los equipos conectados).
 */
export async function publicarAEquipos(canal: string, datos: { device_id: number } & Record<string, unknown>) {
  const msg = JSON.stringify(datos);
  if (esDeV1(datos.device_id)) await (await redisDeV1()).publish(canal, msg);
  else await redis.publish(canal, msg);
}

/**
 * Le manda una orden a un equipo y devuelve su numero. UNICO camino para crear
 * ordenes: el dashboard, la foto a todos, las capturas por stream, el corte de
 * la vista y las instancias de SPACE OS pasan por aqui.
 *
 * En modo espejo la orden se anota en la base de V1 -el equipo le contesta a V1
 * con ese numero- y se copia aqui con el MISMO numero, para que el historial y
 * la vista de la ficha la vean al instante, sin esperar al espejo.
 */
export async function ordenarEquipo(
  deviceId: number,
  tipo: string,
  payload: unknown,
  op: { prioridad?: number; creadoPor?: number | null; scheduleId?: number | null } = {},
): Promise<number> {
  const prioridad = op.prioridad ?? 5;
  const creadoPor = op.creadoPor ?? null;
  const scheduleId = op.scheduleId ?? null;
  const json = JSON.stringify(payload ?? null);
  const sql = `INSERT INTO commands (device_id, command_type, payload, schedule_id, priority, created_by, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`;

  let id: number;
  if (esDeV1(deviceId)) {
    const v1 = baseV1();
    const tiene = await columnasV1('commands');
    const insertarEnV1 = async (firma: boolean) => {
      const campos: [string, unknown][] = [
        ['device_id', deviceId], ['command_type', tipo], ['payload', json], ['priority', prioridad],
      ];
      if (firma && tiene.has('schedule_id')) campos.push(['schedule_id', scheduleId]);
      if (firma && tiene.has('created_by')) campos.push(['created_by', creadoPor]);
      const [r] = await v1.query<any>(
        `INSERT INTO commands (${campos.map(([k]) => k).join(', ')}, expires_at)
         VALUES (${campos.map(() => '?').join(', ')}, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
        campos.map(([, v]) => v));
      return r.insertId as number;
    };
    try {
      id = await insertarEnV1(true);
    } catch (e: any) {
      // Un usuario que solo existe en V2, o una programacion de V2, no existen
      // en V1 (llave foranea): la orden sale igual, sin firma.
      if (!/foreign key/i.test(e.message)) throw e;
      id = await insertarEnV1(false);
    }
    await pool.query(
      `INSERT IGNORE INTO commands (id, device_id, command_type, payload, schedule_id, priority, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [id, deviceId, tipo, json, scheduleId, prioridad, creadoPor],
    ).catch(() => { /* el espejo la traera de todos modos */ });
  } else {
    const [r] = await pool.query<any>(sql, [deviceId, tipo, json, scheduleId, prioridad, creadoPor]);
    id = r.insertId;
  }

  await publicarAEquipos('device:command', {
    device_id: deviceId,
    command: { id, command_type: tipo, payload: payload ?? null },
  });
  return id;
}

/**
 * Cambios que el dashboard le hace a un equipo y que el equipo (o V1) usa: el
 * encuadre, la orientacion, la marca de la foto, el nombre. En modo espejo se
 * escriben TAMBIEN en V1; si no, el espejo los pisaria con el valor viejo a los
 * pocos segundos, y las fotos programadas -que dispara V1- saldrian con el
 * encuadre anterior.
 */
export async function escribirEquipoEnV1(deviceId: number, campos: Record<string, unknown>) {
  if (!esDeV1(deviceId)) return;
  const v1 = baseV1();
  // Solo las columnas que V1 tiene: lo nuevo de V2 no existe alla.
  const existentes = await columnasV1('devices');
  const pares = Object.entries(campos).filter(([k]) => existentes.has(k));
  if (!pares.length) return;
  await v1.query(
    `UPDATE devices SET ${pares.map(([k]) => `\`${k}\` = ?`).join(', ')} WHERE id = ?`,
    [...pares.map(([, v]) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v)), deviceId],
  );
}

// --- Rutas ------------------------------------------------------------------

/** GET /api/espejo: si esta instancia es espejo, de quien, y si va al dia. */
export function estado(_req: Request, res: Response) {
  if (!espejoActivo()) return res.json({ activo: false });
  const atraso = estadoEspejo.ultima ? Math.round((Date.now() - estadoEspejo.ultima.getTime()) / 1000) : null;
  res.json({ activo: true, origen: env.ESPEJO_NOMBRE, atraso_s: atraso, error: estadoEspejo.error || null });
}

/**
 * Lo que el dashboard edita de un equipo y que V1 tambien usa. Despues de
 * guardarlo aqui se copia a V1: si no, el espejo lo pisaria con el valor viejo, y
 * las fotos que dispara V1 (las programadas) saldrian con el encuadre anterior.
 */
const EDITABLES = [
  'name', 'address', 'billboard_code', 'notes', 'status', 'group_id', 'latitude', 'longitude',
  'camera_lens', 'camera_zoom', 'camera_ajustes', 'photo_rotation', 'stream_rotation',
  'overlay_x', 'overlay_y', 'overlay_enabled', 'overlay_style',
];

export function copiarEdicionAV1(req: Request, res: Response, next: NextFunction) {
  if (!espejoActivo()) return next();
  res.on('finish', () => {
    if (res.statusCode >= 300) return;
    const id = Number(req.params.id);
    if (!esDeV1(id)) return;
    pool.query<any[]>(`SELECT * FROM devices WHERE id = ?`, [id])
      .then(([filas]) => {
        const d = (filas as any[])[0];
        if (!d) return;
        const campos: Record<string, unknown> = {};
        for (const k of EDITABLES) if (k in d) campos[k] = d[k];
        return escribirEquipoEnV1(id, campos);
      })
      .catch((e) => console.error(`[Espejo] no se pudo copiar a V1 la edicion del equipo ${id}:`, e.message));
  });
  next();
}

/**
 * Lo que mientras V2 sea espejo se sigue administrando en V1: campañas,
 * programacion, borrar equipos o fotos. Si se hiciera aqui, el espejo lo
 * desharia a los pocos segundos -o peor, borraria aqui algo que V1 conserva-.
 */
export function soloEnV1(_req: Request, res: Response, next: NextFunction) {
  if (!espejoActivo()) return next();
  res.status(409).json({
    error: 'espejo_solo_lectura',
    mensaje: `Mientras esta version sea espejo, esto se cambia en ${env.ESPEJO_NOMBRE}.`,
  });
}
