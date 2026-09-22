// backend/src/controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { z } from 'zod';
import { deleteStored, storeBuffer } from '../services/photoStorage.service';
import sharp from 'sharp';
import { getIceServers } from '../utils/turn';
import { armStreamWatchdog, disarmStreamWatchdog, registrarSesion, sesionDeVista, stopStream } from '../utils/streamWatchdog';
import { agentePcInfo, agentePiInfo, apkInfo } from '../utils/apkInfo';
import { proximoDisparo, ventanasValidas } from '../utils/horarios';
import { env } from '../config/env';
import crypto from 'crypto';
import { firmarFilas, firmar } from '../utils/firmaArchivos';

// --- Vista en vivo de los equipos que NO son telefonos ---------------------
// La Raspberry y las PCs con camara IP no pueden hacer WebRTC punto a punto sin
// arrastrar GStreamer, asi que empujan el video al servidor de medios y el
// dashboard lo consume de ahi. Se reconocen por su app_version, que la ponemos
// nosotros ("pi-agent 0.1.0", "pc-agent 1.0.0").
export function usaServidorDeMedios(appVersion?: string | null) {
  return !!appVersion && /^(pi|pc)-agent/i.test(String(appVersion));
}

// Estado de una transmision en el servidor de medios. Sin esto el dashboard
// tenia que tocar la puerta del servidor de video hasta que el equipo empezara a
// publicar, dejando una fila de errores 404 en la consola del navegador que
// parecian una falla y no lo eran.
export async function streamStatus(req: Request, res: Response) {
  const clave = String(req.query.key || '');
  // La clave la genera el backend en hexadecimal; se valida para no reenviar
  // cualquier cosa al servidor de medios.
  if (!/^[0-9a-f]{8,64}$/.test(clave)) return res.status(400).json({ error: 'clave_invalida' });

  const medios = servidorDeMedios();
  if (!medios) return res.status(503).json({ error: 'servidor_de_medios_no_configurado' });

  try {
    const auth = Buffer.from(`${medios.user}:${medios.pass}`).toString('base64');
    const r = await fetch(`${env.MEDIAMTX_API}/v3/paths/get/${clave}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return res.json({ listo: false });
    const d: any = await r.json();
    res.json({ listo: d?.ready === true, pistas: d?.tracks ?? [] });
  } catch {
    // Si el servidor de medios no contesta, el dashboard sigue esperando.
    res.json({ listo: false });
  }
}

function servidorDeMedios() {
  let host = env.MEDIAMTX_HOST;
  if (!host) {
    try { host = new URL(env.PUBLIC_BASE_URL).hostname; } catch { host = ''; }
  }
  if (!host || !env.MEDIAMTX_PASS) return null;
  return {
    host,
    rtsp: env.MEDIAMTX_RTSP_PORT,
    webrtc: env.MEDIAMTX_WEBRTC_PORT,
    user: env.MEDIAMTX_USER,
    pass: env.MEDIAMTX_PASS,
    // Sin dominio publico se arma como siempre, por IP y puerto.
    whepBase: env.MEDIAMTX_WHEP_PUBLIC.replace(/\/+$/, ''),
  };
}

// ICE servers (STUN + TURN) para WebRTC. Lo consumen el dashboard y el agente.
export function iceServers(_req: Request, res: Response) {
  res.json({ iceServers: getIceServers() });
}

// --- DEVICES ---
export async function listDevices(req: Request, res: Response) {
  const { status, search, group_id } = req.query;
  let sql = `SELECT d.*, ds.battery_pct, ds.signal_dbm, ds.network_type
             FROM devices d
             LEFT JOIN (
               SELECT device_id, battery_pct, signal_dbm, network_type
               FROM device_status
               WHERE (device_id, reported_at) IN (
                 SELECT device_id, MAX(reported_at) FROM device_status GROUP BY device_id
               )
             ) ds ON d.id = ds.device_id
             WHERE 1=1`;
  const params: any[] = [];

  // Alcance de la llave de servicio. Va PRIMERO y no es opcional: una llave de
  // instancia solo ve los equipos de su dueno. Probado en local el 17-sep que
  // sin esto una organizacion nueva de SPACE OS veia camaras de g500.
  if (req.servicio?.owner) { sql += ` AND d.owner = ?`; params.push(req.servicio.owner); }

  if (status && status !== 'all') {
    if (status === 'online') {
      sql += ` AND d.online = TRUE`;
    } else if (status === 'offline') {
      sql += ` AND d.online = FALSE`;
    } else {
      sql += ` AND d.status = ?`;
      params.push(status);
    }
  }
  if (search) {
    sql += ` AND (d.name LIKE ? OR d.billboard_code LIKE ? OR d.address LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (group_id) {
    sql += ` AND d.group_id = ?`;
    params.push(group_id);
  }

  // Orden ALFABETICO y estable. Antes se ordenaba por online y por last_seen_at,
  // que cambia cada vez que un equipo reporta: la lista se reacomodaba sola cada
  // pocos segundos y costaba encontrar un sitio (o se hacia clic en el que no
  // era). Los fijados siguen arriba, que para eso se fijan.
  sql += ` ORDER BY d.pinned DESC, d.name ASC, d.id ASC`;

  const [rows] = await pool.query(sql, params);
  res.json({ devices: rows });
}

export async function getDevice(req: Request, res: Response) {
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM devices WHERE id = ?`,
    [req.params.id]
  );
  const device = (rows as any[])[0];
  if (!device) return res.status(404).json({ error: 'not_found' });
  // Un equipo de otro dueno se contesta igual que uno que no existe: decir
  // "prohibido" ya confirmaria que ese equipo existe.
  if (req.servicio?.owner && device.owner !== req.servicio.owner) {
    return res.status(404).json({ error: 'not_found' });
  }

  const [statusRows] = await pool.query<any[]>(
    `SELECT * FROM device_status WHERE device_id = ? ORDER BY reported_at DESC LIMIT 1`,
    [req.params.id]
  );

  const [usageRows] = await pool.query<any[]>(
    `SELECT * FROM device_data_usage WHERE device_id = ?`,
    [req.params.id]
  );

  res.json({
    device,
    latest_status: (statusRows as any[])[0] || null,
    data_usage: (usageRows as any[])[0] || null,
  });
}

// Fija la orientacion por defecto del stream (0/90/180/270) para este dispositivo.
// Solo admin (ver ruta). Todos la ven al abrir/recargar la vista en vivo.
export async function setStreamRotation(req: Request, res: Response) {
  const schema = z.object({ rotation: z.number().int().refine((v) => [0, 90, 180, 270].includes(v), 'invalid_rotation') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const [r] = await pool.query<any>(
    `UPDATE devices SET stream_rotation = ? WHERE id = ?`,
    [parsed.data.rotation, req.params.id]
  );
  if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true, rotation: parsed.data.rotation });
}

// Encuadre fijo del dispositivo: que lente usa y cuanto zoom.
//
// El zoom de la vista en vivo no llegaba a las fotos programadas (sin stream, la
// captura abre la camara con Camera2 y no heredaba ningun ajuste). Guardandolo
// aqui, el backend lo mete en el payload de cada TAKE_PHOTO y aplica igual a la
// foto por horario que a la manual. Solo admin (ver ruta).
// Ajustes de imagen del equipo. Lo que no entienda su agente lo ignora, asi que
// un mismo formulario sirve para telefono, Raspberry y camara IP.
const ajustesSchema = z.object({
  centro_x: z.number().min(0).max(1).optional(),
  centro_y: z.number().min(0).max(1).optional(),
  brillo: z.number().min(-1).max(1).optional(),
  contraste: z.number().min(0).max(2).optional(),
  saturacion: z.number().min(0).max(2).optional(),
  nitidez: z.number().min(0).max(2).optional(),
  ev: z.number().min(-10).max(10).optional(),
  awb: z.enum(['auto', 'incandescent', 'tungsten', 'fluorescent', 'indoor', 'daylight', 'cloudy']).optional(),
  // Ganancias manuales de blanco. Son las que sirven contra el tinte morado de
  // la camara sin filtro infrarrojo: el automatico se despista justo con eso.
  awb_rojo: z.number().min(0.1).max(8).nullable().optional(),
  awb_azul: z.number().min(0.1).max(8).nullable().optional(),
  ruido: z.enum(['auto', 'off', 'cdn_off', 'cdn_fast', 'cdn_hq']).optional(),
  // --- Exposicion y lineas de la pantalla ---------------------------------
  // 'brillo' NO sirve para una pantalla de LED: suma luz sobre la imagen ya
  // revelada y no puede devolver un canal recortado. Medido en la Raspberry el
  // 27-ago: el 21.4% de los pixeles de la pantalla tenia un canal pegado en
  // 250. Lo que lo evita es exponer menos, y eso son estos mandos.
  medicion: z.enum(['centre', 'spot', 'average', 'matrix']).optional(),
  // Exposicion fija en microsegundos (0 = automatico). Al fijarla conviene
  // fijar tambien la ganancia, o la foto queda a merced de la hora del dia.
  obturador: z.number().int().min(0).max(200000).optional(),
  ganancia: z.number().min(0).max(16).optional(),
  // Cuadros a promediar (1 = un disparo, como siempre). Es lo que borra las
  // LINEAS del LED: el patron de bandas cae en fase distinta en cada cuadro
  // -correlacion medida entre dos capturas: -0.10-, asi que promediando N la
  // amplitud baja con la raiz de N. Con 16 cuadros va del 40% al 10%.
  cuadros: z.number().int().min(1).max(32).optional(),
  // Enfoque fijo del sitio. En un espectacular la distancia NO cambia nunca, asi
  // que el autofoco continuo solo estorba: cada vez que pasa un creativo de
  // muchos colores la camara vuelve a buscar foco y la imagen "salta". Con esto
  // el enfoque se bloquea al abrir la vista en vivo, para todos y siempre, sin
  // depender de que alguien se acuerde de pulsar el boton.
  enfoque_fijo: z.boolean().optional(),
  // Donde enfocar antes de bloquear (0..1 sobre el cuadro). Por omision, el
  // centro; conviene apuntarlo a la pantalla, no al cielo.
  enfoque_x: z.number().min(0).max(1).optional(),
  enfoque_y: z.number().min(0).max(1).optional(),
  // Perfil de color del sensor (Raspberry). 'noir' es el que libcamera elige
  // solo con la camara sin filtro infrarrojo, pensado para vigilancia nocturna:
  // de dia deja la imagen lechosa. 'estandar' junto con ganancias de blanco a
  // mano devuelve cielo, nubes y colores naturales.
  perfil: z.enum(['auto', 'noir', 'estandar']).optional(),
  hflip: z.boolean().optional(),
  vflip: z.boolean().optional(),
});

export async function setCamera(req: Request, res: Response) {
  const schema = z.object({
    // 'wide' = gran angular (0.5x). Si el equipo no lo tiene, la APK cae al principal.
    lens: z.enum(['main', 'wide']).optional(),
    zoom: z.number().min(0).max(1).optional(),
    ajustes: ajustesSchema.nullable().optional(),
    // Giro que se aplica a la foto AL RECIBIRLA. Distinto de stream_rotation,
    // que solo gira la vista en vivo en el navegador y no toca el archivo: hay
    // un equipo con la vista en 90 cuya foto necesita 180.
    photo_rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });

  const d = parsed.data;
  const campos: string[] = [];
  const valores: any[] = [];
  if (d.lens !== undefined) { campos.push('camera_lens = ?'); valores.push(d.lens); }
  if (d.zoom !== undefined) { campos.push('camera_zoom = ?'); valores.push(d.zoom); }
  if (d.ajustes !== undefined) {
    campos.push('camera_ajustes = ?');
    valores.push(d.ajustes ? JSON.stringify(d.ajustes) : null);
  }
  if (d.photo_rotation !== undefined) { campos.push('photo_rotation = ?'); valores.push(d.photo_rotation); }
  if (!campos.length) return res.status(400).json({ error: 'no_fields' });

  const [r] = await pool.query<any>(
    `UPDATE devices SET ${campos.join(', ')} WHERE id = ?`,
    [...valores, req.params.id]
  );
  if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true, ...d });
}

// Guarda la posicion de la marca de informacion (overlay) del dispositivo.
// x/y = centro del bloque de texto en % (0-100). Solo admin (ver ruta).
export async function setOverlay(req: Request, res: Response) {
  const styleSchema = z.object({
    size: z.number().min(0.5).max(8).optional(),
    weight: z.enum(['normal', 'bold']).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    shadow: z.boolean().optional(),
    bg: z.boolean().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    letterSpacing: z.number().min(-0.5).max(2).optional(),
    lineSpacing: z.number().min(0.8).max(3).optional(),
  }).optional();
  const schema = z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    enabled: z.boolean().optional(),
    style: styleSchema,
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const { x, y, enabled, style } = parsed.data;
  const sets = ['overlay_x = ?', 'overlay_y = ?'];
  const values: any[] = [x, y];
  if (enabled !== undefined) { sets.push('overlay_enabled = ?'); values.push(enabled); }
  if (style !== undefined) { sets.push('overlay_style = ?'); values.push(JSON.stringify(style)); }

  const [r] = await pool.query<any>(`UPDATE devices SET ${sets.join(', ')} WHERE id = ?`, [...values, req.params.id]);
  if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true, overlay_x: x, overlay_y: y, overlay_enabled: enabled ?? true, overlay_style: style ?? null });
}

export async function updateDevice(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().optional(),
    billboard_code: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    group_id: z.number().nullable().optional(),
    status: z.enum(['active', 'inactive', 'maintenance', 'provisioning']).optional(),
    // Coordenadas del sitio. Estan en la tabla desde el principio y con indice
    // (idx_devices_location), pero no habia por donde escribirlas: ninguna
    // pantalla de la flota tiene posicion. Ademas de ubicarla en un mapa, es lo
    // que permite calcular la luz de SU sitio -amanecer, mediodia solar,
    // atardecer-, y esa luz es la que decide si la foto sale con rayas o limpia:
    // a mediodia el obturador se acorta y el parpadeo del LED aparece en bandas.
    // Sin coordenadas, las franjas de las fotos se eligen a ojo.
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    stream_quality: z.enum(['low', 'medium', 'high']).optional(),
    capture_quality: z.enum(['low', 'medium', 'high']).optional(),
    pinned: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const fields = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (fields.length === 0) return res.status(400).json({ error: 'no_fields' });

  const sets = fields.map(([k]) => `${k} = ?`).join(', ');
  const values = fields.map(([, v]) => v);

  await pool.query(`UPDATE devices SET ${sets} WHERE id = ?`, [...values, req.params.id]);
  res.json({ ok: true });
}

// Elimina un dispositivo y todo lo asociado (fotos, estado, comandos, logs caen
// por FK ON DELETE CASCADE; los archivos de fotos se borran del almacenamiento).
export async function deleteDevice(req: Request, res: Response) {
  const id = req.params.id;
  const [rows] = await pool.query<any[]>(`SELECT id FROM devices WHERE id = ?`, [id]);
  if (!(rows as any[])[0]) return res.status(404).json({ error: 'not_found' });

  const [photos] = await pool.query<any[]>(
    `SELECT storage_path, thumbnail_path FROM photos WHERE device_id = ?`,
    [id]
  );
  for (const p of photos as any[]) {
    await deleteStored(p.storage_path);
    if (p.thumbnail_path) await deleteStored(p.thumbnail_path);
  }

  await pool.query(`DELETE FROM devices WHERE id = ?`, [id]);
  res.json({ ok: true });
}

// Version del APK publicado, para que el dashboard sepa quien esta atrasado.
// Que version hay publicada para CADA tipo de equipo.
//
// Antes solo devolvia la del APK, y el dashboard comparaba con ella a todo el
// mundo: una PC con "pc-agent 1.1.0" nunca coincide con "0.13.0", asi que salia
// "atrasado" para siempre, incluso recien actualizada. Con la Raspberry el
// problema seria peor, porque ahi el boton de actualizar es lo unico que evita
// un viaje al sitio y hay que poder confiar en lo que dice.
//
// Los campos del APK siguen en la raiz para no romper a quien ya los leia.
export function appVersion(_req: Request, res: Response) {
  res.json({ ...apkInfo(), agente_pc: agentePcInfo(), agente_pi: agentePiInfo() });
}

// Lente y zoom guardados del equipo, para adjuntarlos a las ordenes de foto.
export async function encuadreDe(deviceId: number) {
  const [rows] = await pool.query<any[]>(
    `SELECT camera_lens, camera_zoom, camera_ajustes FROM devices WHERE id = ?`,
    [deviceId]
  );
  const d = (rows as any[])[0];
  if (!d) return {};

  // Los ajustes finos (color, exposicion, centro del recorte) viajan con el
  // encuadre en TODAS las ordenes de foto y de vista en vivo. Solo se mandan si
  // hay algo configurado, para no engordar cada orden sin necesidad.
  const ajustes = typeof d.camera_ajustes === 'string'
    ? (() => { try { return JSON.parse(d.camera_ajustes); } catch { return null; } })()
    : d.camera_ajustes;

  return {
    camera_lens: d.camera_lens || 'main',
    camera_zoom: Number(d.camera_zoom) || 0,
    ...(ajustes && Object.keys(ajustes).length ? { camera_ajustes: ajustes } : {}),
  };
}

export async function sendCommand(req: Request, res: Response) {
  const schema = z.object({
    command_type: z.enum(['TAKE_PHOTO', 'START_STREAM', 'STOP_STREAM', 'UPDATE_CONFIG', 'REBOOT_APP', 'SYNC_SCHEDULE', 'CHANGE_QUALITY', 'UPDATE_APP']),
    payload: z.any().optional(),
    priority: z.number().min(1).max(9).default(5),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const deviceId = req.params.id;
  const { command_type, priority } = parsed.data;
  let { payload } = parsed.data;

  // El encuadre fijo del equipo viaja en la orden: asi la APK lo aplica tanto si
  // toma la foto durante un stream como si abre la camara desde cero. Tambien en
  // START_STREAM, para que la vista en vivo muestre el mismo encuadre que tendra
  // la foto (si no, se encuadraria contra algo distinto de lo que se recibe).
  if (command_type === 'TAKE_PHOTO' || command_type === 'START_STREAM') {
    payload = { ...(payload ?? {}), ...(await encuadreDe(Number(deviceId))) };
  }

  // La orden de actualizar lleva de donde bajar el programa, su huella y que
  // version se espera: el equipo verifica antes de instalar y no reinstala la
  // misma.
  //
  // Cada tipo de equipo baja lo suyo. Los telefonos, el APK; las PCs con camara
  // IP, su propio ejecutable. Antes esto solo contemplaba Android, asi que a un
  // sitio con PC no habia forma de actualizarlo por red: habia que ir. Y se noto
  // -REVOLUCION 267 llevaba TRES versiones de atraso sin que se viera en el
  // dashboard, porque el numero de version no cambiaba.
  if (command_type === 'UPDATE_APP') {
    const [filas] = await pool.query<any[]>(`SELECT app_version FROM devices WHERE id = ?`, [deviceId]);
    const version = String((filas as any[])[0]?.app_version || '');

    const esPc = /^pc-agent/i.test(version);
    const esPi = /^pi-agent/i.test(version);

    // Cada tipo de equipo baja lo suyo: los telefonos el APK, las PCs con camara
    // IP su ejecutable, y la Raspberry un paquete con su codigo. Hasta la v0.2.0
    // del pi-agent esta rama contestaba "sin_actualizacion_remota" y la Pi era el
    // unico equipo de la flota que seguia exigiendo viajar al sitio.
    const publicado = esPc ? agentePcInfo() : esPi ? agentePiInfo() : apkInfo();
    if (!publicado.disponible) {
      return res.status(409).json({
        error: esPc ? 'agente_no_publicado' : esPi ? 'agente_pi_no_publicado' : 'apk_no_publicado',
      });
    }

    const archivo = esPc ? 'SpaceEyeAgente.exe'
      : esPi ? 'space-eye-pi-agent.tar.gz'
      : 'space-eye.apk';

    payload = {
      url: `${env.PUBLIC_BASE_URL || ''}/${archivo}`,
      sha256: publicado.sha256,
      version_code: publicado.version_code,
      version: publicado.version,
      ...(payload ?? {}),
    };
  }

  // Equipos que transmiten por el servidor de medios: se les da una ruta al azar
  // y de un solo uso. El equipo recibe a donde publicar y el dashboard de donde
  // ver; la ruta deja de existir en cuanto se corta la transmision.
  let stream: { modo: string; whep: string } | null = null;
  let compartida = false;

  if (command_type === 'START_STREAM') {
    const [filas] = await pool.query<any[]>(`SELECT app_version FROM devices WHERE id = ?`, [deviceId]);
    const porServidorDeMedios = usaServidorDeMedios((filas as any[])[0]?.app_version);
    const abierta = sesionDeVista(Number(deviceId));

    // Ya hay alguien viendo este equipo. Antes esto no se comprobaba y la segunda
    // persona se llevaba la camara: el primero se quedaba con la imagen congelada
    // (telefonos) o en negro (relay), sin ningun aviso para ninguno de los dos.
    if (abierta) {
      if (porServidorDeMedios && abierta.modo === 'relay' && abierta.whep) {
        // El servidor de medios reparte el MISMO video a cuantos quieran verlo, y
        // al equipo no le cuesta un byte de mas: publica una sola vez. Asi que se
        // le devuelve la transmision que ya esta corriendo, sin molestar al
        // equipo con otra orden.
        return res.json({
          command_id: null,
          compartida: true,
          con: abierta.nombre,
          desde: new Date(abierta.desde).toISOString(),
          stream: { modo: 'relay', whep: abierta.whep },
        });
      }

      // Punto a punto (telefonos): cada espectador es OTRA conexion de video
      // saliendo del telefono, o sea el doble de datos moviles. No se comparte a
      // proposito; se avisa quien la tiene.
      return res.status(409).json({
        error: 'vista_ocupada',
        con: abierta.nombre,
        desde: new Date(abierta.desde).toISOString(),
        minutos: Math.max(1, Math.round((Date.now() - abierta.desde) / 60000)),
      });
    }

    if (porServidorDeMedios) {
      const medios = servidorDeMedios();
      if (!medios) return res.status(503).json({ error: 'servidor_de_medios_no_configurado' });
      const clave = crypto.randomBytes(12).toString('hex');
      payload = {
        ...(payload ?? {}),
        publish_url: `rtsp://${medios.user}:${medios.pass}@${medios.host}:${medios.rtsp}/${clave}`,
      };
      // La direccion que abrira el NAVEGADOR. Con dominio publico va por el
      // proxy en https; sin el, por IP y puerto como hasta ahora.
      stream = {
        modo: 'relay',
        whep: medios.whepBase
          ? `${medios.whepBase}/${clave}/whep`
          : `http://${medios.host}:${medios.webrtc}/${clave}/whep`,
      };
    }
  }

  const [result] = await pool.query<any>(
    `INSERT INTO commands (device_id, command_type, payload, priority, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [deviceId, command_type, JSON.stringify(payload ?? null), priority, req.user!.uid]
  );

  const command = {
    id: (result as any).insertId,
    command_type,
    payload: payload ?? null,
  };

  await redis.publish('device:command', JSON.stringify({
    device_id: Number(deviceId),
    command,
  }));

  // Red de seguridad: ninguna transmision queda viva mas de 3 minutos aunque
  // el navegador nunca mande el STOP_STREAM (pestaña cerrada, red caida...).
  if (command_type === 'START_STREAM') {
    armStreamWatchdog(Number(deviceId));
    // Se anota quien abrio la vista, para poder decirselo al siguiente que llegue.
    const [u] = await pool.query<any[]>(`SELECT full_name FROM users WHERE id = ?`, [req.user!.uid]);
    registrarSesion(Number(deviceId), {
      userId: req.user!.uid,
      nombre: (u as any[])[0]?.full_name || 'otro usuario',
      desde: Date.now(),
      modo: stream ? 'relay' : 'p2p',
      whep: stream?.whep,
    });
  } else if (command_type === 'STOP_STREAM') {
    disarmStreamWatchdog(Number(deviceId));
  }

  res.json({ command_id: (result as any).insertId, ...(stream ? { stream } : {}) });
}

/**
 * Foto ya, en varios equipos a la vez.
 *
 * Antes solo se podia pedir entrando al detalle de cada equipo, uno por uno: una
 * ronda de evidencia de toda la flota eran seis pantallas y seis esperas. Sin
 * device_ids se le pide a todos los que no estan dados de baja.
 */
/** Manda una orden a un equipo y devuelve su id. */
async function enviarOrden(
  deviceId: number,
  tipo: string,
  payload: any,
  userId: number | null,
  scheduleId: number | null = null,
) {
  const [ins] = await pool.query<any>(
    `INSERT INTO commands (device_id, command_type, payload, schedule_id, priority, created_by, expires_at)
     VALUES (?, ?, ?, ?, 1, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [deviceId, tipo, JSON.stringify(payload ?? null), scheduleId, userId]
  );
  const id = (ins as any).insertId;
  await redis.publish('device:command', JSON.stringify({
    device_id: deviceId,
    command: { id, command_type: tipo, payload: payload ?? null },
  }));
  return id;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cuanto se le da a la camara para abrirse y asentar enfoque y exposicion antes
// de disparar, y cuanto se espera despues para que la foto suba antes de cortar.
const ESPERA_CAMARA_MS = 6000;
const ESPERA_SUBIDA_MS = 7000;

/**
 * Foto tomada DESDE la vista en vivo, para que todas salgan iguales.
 *
 * El problema que resuelve: en los telefonos hay dos formas de tomar una foto y
 * dan resultados distintos. Con la vista en vivo abierta la foto sale de la
 * sesion de camara que ya lleva rato funcionando -enfoque y exposicion
 * asentados, encuadre del sitio aplicado, orientacion la del visor-. Sin visor,
 * las APK anteriores a la v0.12.0 abren la camara en frio y disparan al
 * instante: sale desenfocada y con otro encuadre.
 *
 * En vez de esperar a que alguien pueda ir a cada sitio a instalar la APK nueva,
 * el servidor hace lo mismo que haria una persona: abre la vista, toma la foto y
 * cierra. Asi TODAS las fotos salen por el mismo camino.
 *
 * No cuesta datos moviles extra: si nadie esta mirando, la conexion de video
 * nunca llega a establecerse y el telefono no transmite nada. Solo viaja el
 * ofrecimiento inicial, que son un par de kilobytes.
 *
 * NO se hace en la Raspberry ni en las camaras IP: ahi el agente CORTA la
 * transmision para poder tomar la foto (es el mismo sensor), asi que abrir el
 * stream antes no aportaria nada y si gastaria ancho de banda de subida.
 */
export async function capturaPorStream(
  eq: any,
  opciones: { userId?: number | null; scheduleId?: number | null; extra?: any } = {},
) {
  const userId = opciones.userId ?? null;
  const scheduleId = opciones.scheduleId ?? null;
  const encuadre = await encuadreDe(eq.id);
  const yaAbierta = sesionDeVista(eq.id);

  try {
    if (!yaAbierta) {
      await enviarOrden(eq.id, 'START_STREAM', encuadre, userId);
      armStreamWatchdog(eq.id);
      registrarSesion(eq.id, {
        userId,
        nombre: scheduleId ? 'una foto programada' : 'una captura automática',
        desde: Date.now(),
        modo: 'p2p',
      });
      await dormir(ESPERA_CAMARA_MS);
    }

    // La orientacion del visor viaja en la orden: es lo que hace que la foto
    // quede como se ve en la vista en vivo.
    const giro = Number(eq.stream_rotation) || 0;
    await enviarOrden(
      eq.id,
      'TAKE_PHOTO',
      { ...(opciones.extra ?? {}), ...encuadre, ...(giro ? { rotation: giro } : {}) },
      userId,
      scheduleId,
    );

    if (!yaAbierta) {
      await dormir(ESPERA_SUBIDA_MS);
      // Si mientras tanto una persona abrio el visor, no se le corta.
      const ahora = sesionDeVista(eq.id);
      if (!ahora || ahora.userId === userId) {
        await stopStream(eq.id, 'captura terminada');
      }
    }
  } catch (err) {
    console.error(`[captura] equipo ${eq.id}:`, (err as any)?.message);
    // Que no quede una transmision colgada por un fallo a media orquestacion.
    if (!yaAbierta) await stopStream(eq.id, 'fallo en la captura').catch(() => {});
  }
}

export async function capturarAhora(req: Request, res: Response) {
  const schema = z.object({
    device_ids: z.array(z.number()).optional(),
    // Por omision la foto se toma desde la vista en vivo, para que todas salgan
    // iguales. `via_stream: false` vuelve a la captura directa de siempre.
    via_stream: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const columnas = `id, name, online, app_version, stream_rotation`;
  let equipos: any[];
  if (parsed.data.device_ids?.length) {
    const [filas] = await pool.query<any[]>(
      `SELECT ${columnas} FROM devices WHERE id IN (?)`,
      [parsed.data.device_ids]
    );
    equipos = filas as any[];
  } else {
    const [filas] = await pool.query<any[]>(
      `SELECT ${columnas} FROM devices WHERE status NOT IN ('inactive','maintenance') ORDER BY name`
    );
    equipos = filas as any[];
  }

  if (equipos.length === 0) return res.status(404).json({ error: 'sin_equipos' });

  const porStream = parsed.data.via_stream !== false;
  const resultado: { device_id: number; name: string; online: boolean; via: string }[] = [];

  for (const eq of equipos) {
    // La Raspberry y las camaras IP van por el camino directo: ahi la foto ya
    // sale de la misma configuracion, y abrir el stream solo gastaria subida.
    const usaVisor = porStream && !usaServidorDeMedios(eq.app_version) && !!eq.online;

    if (usaVisor) {
      // En segundo plano: son ~13 segundos por equipo y el navegador no puede
      // quedarse esperando. Todos arrancan a la vez, no en fila.
      void capturaPorStream(eq, { userId: req.user!.uid });
    } else {
      await enviarOrden(eq.id, 'TAKE_PHOTO', await encuadreDe(eq.id), req.user!.uid);
    }

    resultado.push({
      device_id: eq.id,
      name: eq.name,
      online: !!eq.online,
      via: usaVisor ? 'vista en vivo' : 'directa',
    });
  }

  // Los equipos apagados reciben la orden cuando vuelvan, si no vencio antes:
  // se avisa cuantos son para que nadie espere una foto que no va a llegar.
  res.json({
    enviados: resultado.length,
    en_linea: resultado.filter(r => r.online).length,
    por_vista_en_vivo: resultado.filter(r => r.via === 'vista en vivo').length,
    segundos_aprox: resultado.some(r => r.via === 'vista en vivo')
      ? Math.round((ESPERA_CAMARA_MS + ESPERA_SUBIDA_MS) / 1000)
      : 0,
    equipos: resultado,
  });
}

// --- PHOTOS ---
export async function listPhotos(req: Request, res: Response) {
  const { device_id, campaign_id, from, to, source, page = '1', limit = '20' } = req.query;
  let sql = `SELECT p.*, d.name as device_name,
                    d.overlay_x, d.overlay_y, d.overlay_enabled, d.overlay_style
             FROM photos p JOIN devices d ON p.device_id = d.id WHERE 1=1`;
  const params: any[] = [];

  // Mismo alcance que en la lista de equipos: una foto pertenece a su equipo.
  if (req.servicio?.owner) { sql += ` AND d.owner = ?`; params.push(req.servicio.owner); }

  if (device_id) { sql += ` AND p.device_id = ?`; params.push(device_id); }
  if (campaign_id) { sql += ` AND p.campaign_id = ?`; params.push(campaign_id); }
  if (from) { sql += ` AND p.taken_at >= ?`; params.push(from); }
  if (to) { sql += ` AND p.taken_at <= ?`; params.push(to); }
  if (source) { sql += ` AND p.source = ?`; params.push(source); }

  const offset = (Number(page) - 1) * Number(limit);
  sql += ` ORDER BY p.taken_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);

  const [rows] = await pool.query(sql, params);

  const [countResult] = await pool.query<any[]>(
    // El conteo lleva el MISMO alcance que la lista. Sin esto, una llave de
    // instancia recibia sus pocas fotos pero un total de toda la flota: no ve el
    // contenido ajeno, pero sabe cuanto hay, y la paginacion se vuelve mentira.
    `SELECT COUNT(*) as total FROM photos p JOIN devices d ON d.id = p.device_id WHERE 1=1` +
    (req.servicio?.owner ? ` AND d.owner = ${pool.escape(req.servicio.owner)}` : '') +
    (device_id ? ` AND p.device_id = ${Number(device_id)}` : '') +
    (campaign_id ? ` AND p.campaign_id = ${Number(campaign_id)}` : ''),
  );

  // Las rutas salen FIRMADAS: /storage exige firma desde el 2026-09-14.
  res.json({ photos: firmarFilas(rows as any[]), total: (countResult as any[])[0]?.total || 0 });
}

// Elimina una foto tomada por error: borra archivos (full + thumb) y la fila.
// La FK ON DELETE CASCADE elimina tambien su verificacion si existiera.
export async function deletePhoto(req: Request, res: Response) {
  const [rows] = await pool.query<any[]>(
    `SELECT storage_path, thumbnail_path FROM photos WHERE id = ?`,
    [req.params.id]
  );
  const photo = (rows as any[])[0];
  if (!photo) return res.status(404).json({ error: 'not_found' });

  await deleteStored(photo.storage_path);
  if (photo.thumbnail_path) await deleteStored(photo.thumbnail_path);
  await pool.query(`DELETE FROM photos WHERE id = ?`, [req.params.id]);

  res.json({ ok: true });
}

// Registros remotos de un device (para diagnostico de equipos en campo).
export async function listDeviceLogs(req: Request, res: Response) {
  const { level, limit = '100' } = req.query;
  let sql = `SELECT id, level, category, message, metadata, logged_at
             FROM device_logs WHERE device_id = ?`;
  const params: any[] = [req.params.id];

  if (level && level !== 'all') {
    sql += ` AND level = ?`;
    params.push(level);
  }
  sql += ` ORDER BY logged_at DESC LIMIT ?`;
  params.push(Math.min(Number(limit) || 100, 500));

  const [rows] = await pool.query(sql, params);
  res.json({ logs: rows });
}

// --- SCHEDULES ---
export async function listSchedules(req: Request, res: Response) {
  const [rows] = await pool.query(
    `SELECT s.*, d.name as device_name, g.name as group_name, c.name as campaign_name,
       (SELECT COUNT(*) FROM photos p WHERE p.schedule_id = s.id) as fotos,
       (SELECT COUNT(*) FROM photos p WHERE p.schedule_id = s.id
          AND p.taken_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as fotos_semana
     FROM schedules s
     LEFT JOIN devices d ON s.device_id = d.id
     LEFT JOIN device_groups g ON s.group_id = g.id
     LEFT JOIN campaigns c ON s.campaign_id = c.id
     ORDER BY s.active DESC, s.name ASC`
  );
  res.json({ schedules: rows });
}

const ventanaSchema = z.object({
  ini: z.string().regex(/^\d{1,2}:\d{2}$/),
  fin: z.string().regex(/^\d{1,2}:\d{2}$/),
});

const scheduleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  device_id: z.number().nullable().optional(),
  group_id: z.number().nullable().optional(),
  campaign_id: z.number().nullable().optional(),
  frequency_type: z.enum(['interval', 'cron', 'specific_times', 'random_windows']),
  interval_minutes: z.number().int().min(1).optional(),
  cron_expression: z.string().optional(),
  specific_times: z.array(z.string()).optional(),
  windows: z.array(ventanaSchema).optional(),
  timezone: z.string().default('America/Mexico_City'),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
});

/**
 * El schedule debe traer los datos de su tipo de frecuencia.
 *
 * Sin equipo, grupo ni campana NO es un error: significa "toda la flota", que es
 * lo que se quiere casi siempre con seis equipos. No hay ningun grupo dado de
 * alta, asi que obligar a elegir destino solo dejaba la opcion de uno por uno.
 */
function revisarSchedule(d: any): string | null {
  // Al editar, estos campos vienen de la base y segun el driver pueden llegar
  // como texto en vez de arreglo.
  const comoLista = (v: any) => (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);

  if (d.frequency_type === 'interval' && !d.interval_minutes) return 'falta_intervalo';
  if (d.frequency_type === 'cron' && !d.cron_expression) return 'falta_cron';
  if (d.frequency_type === 'specific_times' && !comoLista(d.specific_times)?.length) return 'faltan_horas';
  if (d.frequency_type === 'random_windows' && !ventanasValidas(comoLista(d.windows))) return 'faltan_franjas';
  return null;
}

export async function createSchedule(req: Request, res: Response) {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });

  const d = parsed.data;
  const falla = revisarSchedule(d);
  if (falla) return res.status(400).json({ error: falla });

  // El primer disparo se calcula igual que los siguientes. Antes se guardaba la
  // hora actual para todo lo que no fuera un intervalo, asi que un horario de
  // "8 de la manana" tomaba una foto en el instante mismo de crearlo.
  const nextFire = proximoDisparo(d, false);

  const [result] = await pool.query<any>(
    `INSERT INTO schedules (name, description, device_id, group_id, campaign_id, frequency_type,
       interval_minutes, cron_expression, specific_times, windows, timezone, valid_from, valid_until, next_fire_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.name, d.description ?? null, d.device_id ?? null, d.group_id ?? null, d.campaign_id ?? null,
     d.frequency_type, d.interval_minutes ?? null, d.cron_expression ?? null,
     d.specific_times ? JSON.stringify(d.specific_times) : null,
     d.windows ? JSON.stringify(d.windows) : null,
     d.timezone, d.valid_from ?? null, d.valid_until ?? null, nextFire, req.user!.uid]
  );

  res.json({ schedule_id: (result as any).insertId, next_fire_at: nextFire });
}

export async function updateSchedule(req: Request, res: Response) {
  const parsed = scheduleSchema.partial().extend({ active: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });

  const cambios = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (cambios.length === 0) return res.status(400).json({ error: 'no_fields' });

  const [filas] = await pool.query<any[]>(`SELECT * FROM schedules WHERE id = ?`, [req.params.id]);
  const actual = (filas as any[])[0];
  if (!actual) return res.status(404).json({ error: 'not_found' });

  // Se valida y se reprograma sobre el schedule COMPLETO (lo guardado mas lo que
  // cambia), no sobre el parche suelto: si no, cambiar solo las franjas dejaba el
  // proximo disparo apuntando a las franjas viejas.
  const fusion: any = { ...actual, ...parsed.data };
  const falla = revisarSchedule(fusion);
  if (falla) return res.status(400).json({ error: falla });

  const campos = cambios.map(([k]) => `${k} = ?`);
  const valores: any[] = cambios.map(([k, v]) =>
    (k === 'specific_times' || k === 'windows') ? JSON.stringify(v) : v
  );

  // Reprogramar cuando cambia el cuando, o cuando se reactiva un schedule
  // pausado (su next_fire_at quedo en el pasado y no significa nada).
  const cambioElCuando = cambios.some(([k]) =>
    ['frequency_type', 'interval_minutes', 'cron_expression', 'specific_times', 'windows', 'timezone'].includes(k)
  );
  const seReactiva = parsed.data.active === true && !actual.active;

  if (cambioElCuando || seReactiva) {
    campos.push('next_fire_at = ?');
    valores.push(proximoDisparo(fusion, false));
  }

  await pool.query(`UPDATE schedules SET ${campos.join(', ')} WHERE id = ?`, [...valores, req.params.id]);
  res.json({ ok: true });
}

export async function deleteSchedule(req: Request, res: Response) {
  await pool.query(`DELETE FROM schedules WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
}

// --- CAMPAIGNS ---
export async function listCampaigns(req: Request, res: Response) {
  const [rows] = await pool.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM campaign_devices cd WHERE cd.campaign_id = c.id) as device_count,
       (SELECT COUNT(*) FROM photos p WHERE p.campaign_id = c.id) as photo_count
     FROM campaigns c ORDER BY c.created_at DESC`
  );
  // creative_path se muestra con <img> en la pantalla de campanas: va firmada.
  res.json({ campaigns: firmarFilas(rows as any[]) });
}

export async function createCampaign(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().min(1),
    advertiser: z.string().optional(),
    start_date: z.string(),
    end_date: z.string(),
    verification_enabled: z.boolean().default(false),
    expected_text: z.string().optional(),
    min_ssim_score: z.number().default(0.7),
    max_phash_distance: z.number().default(10),
    device_ids: z.array(z.number()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const d = parsed.data;

  const [result] = await pool.query<any>(
    `INSERT INTO campaigns (name, advertiser, start_date, end_date, verification_enabled,
       expected_text, min_ssim_score, max_phash_distance, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.name, d.advertiser ?? null, d.start_date, d.end_date, d.verification_enabled,
     d.expected_text ?? null, d.min_ssim_score, d.max_phash_distance, req.user!.uid]
  );

  const campaignId = (result as any).insertId;

  if (d.device_ids && d.device_ids.length > 0) {
    const values = d.device_ids.map(did => [campaignId, did]);
    await pool.query(
      `INSERT INTO campaign_devices (campaign_id, device_id) VALUES ?`,
      [values]
    );
  }

  res.json({ campaign_id: campaignId });
}

/**
 * Sube la creatividad de referencia de una campana.
 *
 * Es la imagen contra la que se compara lo que hay en la pantalla. Sin ella la
 * campana no puede verificarse ni buscarse: el sistema no sabe que esta buscando.
 * Faltaba en la pantalla de campanas, asi que la unica campana existente llevaba
 * la verificacion activada sin poder hacer nada.
 *
 * Se guarda con la foto del sitio, no en la base: son imagenes de varios cientos
 * de kilobytes.
 */
export async function subirCreatividad(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'sin_archivo' });

  const campaignId = Number(req.params.id);
  const [filas] = await pool.query<any[]>(`SELECT id FROM campaigns WHERE id = ?`, [campaignId]);
  if (!(filas as any[])[0]) return res.status(404).json({ error: 'not_found' });

  const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
  // Se normaliza a un tamano razonable: la referencia se usa para comparar
  // formas y color, no hace falta que pese lo que la original.
  const imagen = await sharp(req.file.buffer)
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  const ruta = await storeBuffer(
    `creatividades/${campaignId}/referencia.${ext}`,
    imagen,
    req.file.mimetype
  );

  await pool.query(`UPDATE campaigns SET creative_path = ? WHERE id = ?`, [ruta, campaignId]);
  // Firmada tambien aqui: la vista previa se pinta con esta misma respuesta.
  res.json({ ok: true, creative_path: firmar(ruta) });
}

/** Editar una campana: datos, vigencia, verificacion y equipos. */
export async function actualizarCampana(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().min(1).optional(),
    advertiser: z.string().nullable().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    active: z.boolean().optional(),
    verification_enabled: z.boolean().optional(),
    expected_text: z.string().nullable().optional(),
    device_ids: z.array(z.number()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });

  const d = parsed.data;
  const campaignId = Number(req.params.id);

  const campos = Object.entries(d).filter(([k, v]) => k !== 'device_ids' && v !== undefined);
  if (campos.length) {
    await pool.query(
      `UPDATE campaigns SET ${campos.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...campos.map(([, v]) => v), campaignId]
    );
  }

  // Los equipos se reemplazan enteros: es lo que espera quien edita la lista.
  if (d.device_ids) {
    await pool.query(`DELETE FROM campaign_devices WHERE campaign_id = ?`, [campaignId]);
    if (d.device_ids.length) {
      await pool.query(
        `INSERT INTO campaign_devices (campaign_id, device_id) VALUES ?`,
        [d.device_ids.map((id) => [campaignId, id])]
      );
    }
  }

  res.json({ ok: true });
}

export async function getCampaign(req: Request, res: Response) {
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM campaigns WHERE id = ?`,
    [req.params.id]
  );
  const campaign = (rows as any[])[0];
  if (!campaign) return res.status(404).json({ error: 'not_found' });

  const [devices] = await pool.query(
    `SELECT d.id, d.name, d.billboard_code
     FROM devices d JOIN campaign_devices cd ON d.id = cd.device_id
     WHERE cd.campaign_id = ?`,
    [req.params.id]
  );

  res.json({ campaign, devices });
}

// --- VERIFICATIONS ---
export async function listVerifications(req: Request, res: Response) {
  const { campaign_id, is_correct, page = '1', limit = '20' } = req.query;
  let sql = `SELECT v.*, p.storage_path, p.thumbnail_path, p.taken_at, d.name as device_name
             FROM verifications v
             JOIN photos p ON v.photo_id = p.id
             JOIN devices d ON p.device_id = d.id
             WHERE 1=1`;
  const params: any[] = [];

  if (campaign_id) { sql += ` AND v.campaign_id = ?`; params.push(campaign_id); }
  if (is_correct !== undefined) { sql += ` AND v.is_correct = ?`; params.push(is_correct === 'true'); }

  const offset = (Number(page) - 1) * Number(limit);
  sql += ` ORDER BY v.processed_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);

  const [rows] = await pool.query(sql, params);
  res.json({ verifications: firmarFilas(rows as any[]) });
}
