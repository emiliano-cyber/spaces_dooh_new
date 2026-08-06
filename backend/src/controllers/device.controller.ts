// backend/src/controllers/device.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { deviceJwt } from '../utils/jwt';
import { z } from 'zod';
import { uploadPhoto } from '../services/photoStorage.service';
import { configDe, registrarRecorrido, ligarFoto } from './creativos.controller';
import { apkInfo } from '../utils/apkInfo';
import { redis } from '../config/redis';

// Los limites reflejan el tamaño real de las columnas: sin ellos, un dato mas
// largo llegaba a MySQL, reventaba el INSERT y el error tumbaba el proceso. Se
// recorta en vez de rechazar: un equipo en campo no debe quedarse sin registrar
// por un nombre de modelo largo.
const recorta = (max: number) => z.string().transform((s) => s.slice(0, max));

const registerSchema = z.object({
  device_uid: recorta(64).pipe(z.string().min(16)),
  android_version: recorta(64),   // version del SO (Android o Windows en el agente de PC)
  app_version: recorta(64),
  model: recorta(100),
  manufacturer: recorta(100),
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const { device_uid, android_version, app_version, model, manufacturer } = parsed.data;

  const [existing] = await pool.query<any[]>(
    `SELECT id FROM devices WHERE device_uid = ? LIMIT 1`,
    [device_uid]
  );

  let deviceId: number;
  if ((existing as any[])[0]) {
    deviceId = (existing as any[])[0].id;
    await pool.query(
      `UPDATE devices SET android_version=?, app_version=?, model=?, manufacturer=? WHERE id=?`,
      [android_version, app_version, model, manufacturer, deviceId]
    );
  } else {
    const [result] = await pool.query<any>(
      `INSERT INTO devices (device_uid, name, status, android_version, app_version, model, manufacturer, auth_token_hash, token_issued_at)
       VALUES (?, ?, 'provisioning', ?, ?, ?, ?, '', NOW())`,
      [device_uid, `Device ${device_uid.slice(0, 8)}`, android_version, app_version, model, manufacturer]
    );
    deviceId = (result as any).insertId;
  }

  const token = deviceJwt.sign({ did: deviceId, device_uid });
  const tokenHash = await bcrypt.hash(token, 8);

  await pool.query(
    `UPDATE devices SET auth_token_hash = ?, token_issued_at = NOW() WHERE id = ?`,
    [tokenHash, deviceId]
  );

  res.json({ device_id: deviceId, token });
}

const statusSchema = z.object({
  battery_pct: z.number().min(0).max(100),
  battery_temp: z.number().optional(),
  battery_charging: z.boolean().optional(),
  signal_dbm: z.number().optional(),
  network_type: z.string().optional(),
  network_operator: z.string().optional(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
  gps_accuracy_m: z.number().optional(),
  storage_free_mb: z.number().optional(),
  ram_free_mb: z.number().optional(),
  cpu_temp: z.number().optional(),
  uptime_seconds: z.number().optional(),
  // Consumo de datos (bytes). Opcionales: los APK previos a v0.7.0 no los envian.
  data_mobile_today: z.number().nonnegative().optional(),
  data_mobile_week: z.number().nonnegative().optional(),
  data_mobile_month: z.number().nonnegative().optional(),
  data_mobile_total: z.number().nonnegative().optional(),
  data_wifi_today: z.number().nonnegative().optional(),
  data_wifi_week: z.number().nonnegative().optional(),
  data_wifi_month: z.number().nonnegative().optional(),
  data_wifi_total: z.number().nonnegative().optional(),
  // Desde v0.10.0: si el equipo puede instalar actualizaciones sin que nadie lo
  // toque (device owner) y que numero de version trae. Los APK previos no los
  // mandan, por eso son opcionales.
  device_owner: z.boolean().optional(),
  app_version_code: z.number().int().optional(),
  // Resultado del ultimo recorrido del loop de la pantalla. Viaja AQUI, pegado
  // al reporte que el equipo ya manda, en vez de en una peticion propia: son
  // huellas de 64 caracteres: una docena de creativos no llegan a un kilobyte, y
  // con cuatro recorridos al dia son ~120 KB al mes contra los ~20 MB que ya
  // gasta cada equipo. Detectar un creativo nuevo no debe costar datos moviles.
  creativos: z.object({
    vistas: z.array(z.string()).optional(),
    nuevas: z.array(z.string()).optional(),
  }).optional(),
});

// IP publica desde la que el equipo habla con el backend. Si algun dia se pone
// un proxy delante (Caddy), la real viene en X-Forwarded-For.
function sourceIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0].trim() || req.ip || '';
  // Express entrega las IPv4 como ::ffff:189.203.98.166 cuando el socket es v6.
  const ip = raw.replace(/^::ffff:/, '');
  return ip ? ip.slice(0, 45) : null;
}

export async function reportStatus(req: Request, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const did = req.device!.did;
  const d = parsed.data;

  await pool.query(
    `INSERT INTO device_status
     (device_id, battery_pct, battery_temp, battery_charging, signal_dbm, network_type, network_operator,
      gps_lat, gps_lng, gps_accuracy_m, storage_free_mb, ram_free_mb, cpu_temp, uptime_seconds, source_ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [did, d.battery_pct, d.battery_temp ?? null, d.battery_charging ?? null,
     d.signal_dbm ?? null, d.network_type ?? null, d.network_operator ?? null,
     d.gps_lat ?? null, d.gps_lng ?? null, d.gps_accuracy_m ?? null,
     d.storage_free_mb ?? null, d.ram_free_mb ?? null, d.cpu_temp ?? null, d.uptime_seconds ?? null,
     sourceIp(req)]
  );

  // El NOMBRE de la version solo se guardaba al registrarse, y un equipo se
  // registra una vez en su vida: si despues se le actualiza la app, el dashboard
  // sigue mostrando la version del dia que se dio de alta. Paso de verdad con
  // MAGNOCENTRO, que figuraba en "0.5.0" cuando en realidad corria la ultima, y
  // parecia que alguien le habia bajado la version.
  //
  // El equipo si reporta su NUMERO de version en cada estado, asi que cuando ese
  // numero coincide con el de la APK publicada, se sabe que nombre le toca.
  const apk = apkInfo();
  const nombreVersion =
    apk.disponible && apk.version_code && d.app_version_code === apk.version_code
      ? apk.version
      : null;

  await pool.query(
    `UPDATE devices SET online = TRUE, last_seen_at = NOW(),
     lat = COALESCE(?, lat), lng = COALESCE(?, lng),
     device_owner = COALESCE(?, device_owner),
     app_version = COALESCE(?, app_version),
     app_version_code = COALESCE(?, app_version_code) WHERE id = ?`,
    [d.gps_lat ?? null, d.gps_lng ?? null,
     d.device_owner === undefined ? null : (d.device_owner ? 1 : 0),
     nombreVersion,
     d.app_version_code ?? null, did]
  );

  // Consumo de datos: upsert del ultimo snapshot (solo si el APK lo reporta).
  if (
    d.data_mobile_today !== undefined || d.data_mobile_week !== undefined ||
    d.data_mobile_month !== undefined || d.data_mobile_total !== undefined ||
    d.data_wifi_today !== undefined || d.data_wifi_week !== undefined ||
    d.data_wifi_month !== undefined || d.data_wifi_total !== undefined
  ) {
    await pool.query(
      `INSERT INTO device_data_usage
         (device_id, mobile_today, mobile_week, mobile_month, mobile_total,
          wifi_today, wifi_week, wifi_month, wifi_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         mobile_today=VALUES(mobile_today), mobile_week=VALUES(mobile_week),
         mobile_month=VALUES(mobile_month), mobile_total=VALUES(mobile_total),
         wifi_today=VALUES(wifi_today), wifi_week=VALUES(wifi_week),
         wifi_month=VALUES(wifi_month), wifi_total=VALUES(wifi_total)`,
      [did, d.data_mobile_today ?? null, d.data_mobile_week ?? null,
       d.data_mobile_month ?? null, d.data_mobile_total ?? null,
       d.data_wifi_today ?? null, d.data_wifi_week ?? null,
       d.data_wifi_month ?? null, d.data_wifi_total ?? null]
    );
  }

  // Catalogo de creativos del sitio. Un fallo aqui no puede tumbar el reporte de
  // estado: si algo sale mal se pierde un recorrido, no la telemetria del equipo.
  if (d.creativos && (d.creativos.vistas?.length || d.creativos.nuevas?.length)) {
    try {
      const cfg = await configDe(did);
      await registrarRecorrido(did, d.creativos.vistas || [], d.creativos.nuevas || [], !!cfg?.aprendiendo);
    } catch (err) {
      console.error('[creativos] no se pudo registrar el recorrido:', (err as any)?.message);
    }
  }

  await redis.publish('device:status', JSON.stringify({ device_id: did, ...d }));
  res.json({ ok: true });
}

export async function pendingCommands(req: Request, res: Response) {
  const did = req.device!.did;

  // El sondeo es el camino de RESPALDO: la orden ya salio por socket en el
  // instante en que se creo. Se le dan 20 segundos de gracia antes de repartirla
  // por aqui, porque si no llegaba por los dos caminos y el equipo la obedecia
  // dos veces: en REVOLUCION 267 cada foto programada se tomaba y se subia por
  // duplicado, el doble de datos por nada.
  //
  // 20 segundos alcanzan de sobra: los tres agentes acusan recibo por socket en
  // milisegundos, y ese acuse pasa la orden a 'executing', que ya no entra en
  // esta consulta. Si el socket estaba caido, la orden se entrega aqui 20
  // segundos mas tarde y no se pierde nada (vencen a los 10 minutos).
  const [rows] = await pool.query<any[]>(
    `SELECT id, command_type, payload, priority FROM commands
     WHERE device_id = ? AND status = 'pending'
       AND created_at <= NOW() - INTERVAL 20 SECOND
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY priority ASC, created_at ASC LIMIT 10`,
    [did]
  );

  if ((rows as any[]).length > 0) {
    const ids = (rows as any[]).map((r: any) => r.id);
    await pool.query(
      `UPDATE commands SET status='sent', sent_at=NOW() WHERE id IN (?)`,
      [ids]
    );
  }
  res.json({ commands: rows });
}

const commandResultSchema = z.object({
  command_id: z.number(),
  success: z.boolean(),
  result: z.any().optional(),
  error_message: z.string().optional(),
});

export async function commandResult(req: Request, res: Response) {
  const parsed = commandResultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const { command_id, success, result, error_message } = parsed.data;
  const did = req.device!.did;

  await pool.query(
    `UPDATE commands SET status=?, executed_at=NOW(), result=?, error_message=?
     WHERE id=? AND device_id=?`,
    [success ? 'done' : 'failed', JSON.stringify(result ?? null), error_message ?? null, command_id, did]
  );
  res.json({ ok: true });
}

const logSchema = z.object({
  level: z.enum(['debug', 'info', 'warning', 'error', 'critical']).default('info'),
  category: z.string().max(50).optional(),
  message: z.string().min(1).max(2000),
  metadata: z.any().optional(),
});

// El agente reporta sus eventos/errores aqui (logging remoto). Permite
// diagnosticar equipos en campo sin USB. Se guarda en device_logs.
export async function logEvent(req: Request, res: Response) {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const did = req.device!.did;
  const { level, category, message, metadata } = parsed.data;

  await pool.query(
    `INSERT INTO device_logs (device_id, level, category, message, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [did, level, category ?? null, message, metadata ? JSON.stringify(metadata) : null]
  );
  res.json({ ok: true });
}

export async function uploadPhotoEndpoint(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const did = req.device!.did;
  const meta = z.object({
    taken_at: z.coerce.date(),
    command_id: z.coerce.number().optional(),
    schedule_id: z.coerce.number().optional(),
    campaign_id: z.coerce.number().optional(),
    gps_lat: z.coerce.number().optional(),
    gps_lng: z.coerce.number().optional(),
    source: z.enum(['manual','scheduled','on_demand','boot','creative_change']).default('manual'),
    // Huella del creativo que disparo la foto (solo en source=creative_change).
    phash: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
    // La APK v0.8.0 sube la foto SIN marca quemada -> envia watermark_baked="false",
    // y el dashboard dibuja el overlay configurable. APK previas no lo envian
    // (default true = ya trae la marca quemada, no se le agrega overlay).
    watermark_baked: z.string().optional(),
  }).parse(req.body);

  // Multipart manda strings; solo "false"/"0" cuentan como no-quemada.
  const baked = !(meta.watermark_baked === 'false' || meta.watermark_baked === '0');

  const result = await uploadPhoto({
    deviceId: did,
    fileBuffer: req.file.buffer,
    mimetype: req.file.mimetype,
    ...meta,
    watermark_baked: baked,
  });

  // Evidencia de un creativo nuevo: se liga con su huella en el catalogo del
  // sitio para que el dashboard pueda mostrar "asi se ve lo que aparecio".
  if (meta.source === 'creative_change' && meta.phash) {
    try {
      await ligarFoto(did, meta.phash, result.photo_id);
    } catch (err) {
      console.error('[creativos] no se pudo ligar la foto:', (err as any)?.message);
    }
  }

  res.json(result);
}
