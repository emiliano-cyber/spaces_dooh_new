// backend/src/controllers/monitoreo.controller.ts
//
// Monitoreo de la pantalla: el equipo la vigila por si mismo y solo avisa cuando
// algo cambia de estado.
//
//   Camara -> analisis en el equipo -> todo bien -> nada (un resumen de cientos
//                                                    de bytes en el latido)
//                                   -> falla confirmada en varias vueltas ->
//                                      alerta + UNA foto de evidencia
//                                   -> falla que se arreglo -> recuperacion + foto
//
// Aqui se guarda la configuracion de cada pantalla (esquinas, gabinetes,
// horario), se reciben las alertas y se lleva el historial. La deteccion vive en
// el equipo (android/.../pantalla/): ver SaludAnalisis.kt para que detecta y como.
import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { uploadPhoto } from '../services/photoStorage.service';
import { firmar } from '../utils/firmaArchivos';
import { configDe as configCreativos, fotosDeHoy as fotosCreativosDeHoy } from './creativos.controller';
import { encuadreDe } from './dashboard.controller';

const APRENDIZAJE_MS = 24 * 3600 * 1000;
/** Una falla descartada a mano no vuelve a sonar en este plazo. */
const SILENCIO_DIAS = 7;

export const TIPOS = ['zona_apagada', 'zona_congelada', 'pantalla_apagada', 'pantalla_congelada', 'camara_movida', 'sin_imagen'] as const;

export const NOMBRES: Record<string, string> = {
  zona_apagada: 'Posible gabinete apagado',
  zona_congelada: 'Posible gabinete congelado',
  pantalla_apagada: 'Pantalla apagada en horario',
  pantalla_congelada: 'Pantalla congelada',
  camara_movida: 'Cámara movida',
  sin_imagen: 'Sin imagen',
};

const HORA = /^([01]\d|2[0-4]):[0-5]\d$/;
const punto = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
export const pantallaSchema = z.object({
  esquinas: z.tuple([punto, punto, punto, punto]),
  filas: z.number().int().min(1).max(20),
  columnas: z.number().int().min(1).max(40),
  excluir: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])).max(400).default([]),
  horario: z.object({
    inicio: z.string().regex(HORA),
    fin: z.string().regex(HORA),
  }).default({ inicio: '06:00', fin: '24:00' }),
});

function json(v: any) {
  if (v == null) return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
}

function clave(tipo: string, fila: number | null, columna: number | null) {
  return fila == null || columna == null ? tipo : `${tipo}:${fila}:${columna}`;
}

async function saludDe(deviceId: number) {
  const [filas] = await pool.query<any[]>(
    `SELECT salud_watch, salud_desde, salud_cada_min, salud_confirmaciones, salud_umbral, salud_max_dia,
            creative_recorrido_seg, creative_paso_seg
     FROM devices WHERE id = ?`, [deviceId]);
  const d = (filas as any[])[0];
  if (!d) return null;
  const desde = d.salud_desde ? new Date(d.salud_desde).getTime() : null;
  return {
    vigilar: !!d.salud_watch,
    desde: d.salud_desde,
    aprendiendo: !!desde && Date.now() - desde < APRENDIZAJE_MS,
    cada_min: d.salud_cada_min,
    confirmaciones: d.salud_confirmaciones,
    umbral: Number(d.salud_umbral),
    max_dia: d.salud_max_dia,
    recorrido_seg: d.creative_recorrido_seg,
    paso_seg: d.creative_paso_seg,
  };
}

async function alertasDeHoy(deviceId: number) {
  const [f] = await pool.query<any[]>(
    `SELECT COUNT(*) n FROM pantalla_fallas WHERE device_id = ? AND detectada_en >= CURDATE()`, [deviceId]);
  return Number((f as any[])[0]?.n || 0);
}

// --- Equipo -------------------------------------------------------------------

/**
 * Todo lo que el equipo necesita antes de una vuelta. Unos cientos de bytes.
 * Reemplaza a /api/device/creativos para la APK 0.15.0; la Raspberry sigue con
 * aquel hasta que tenga el mismo analisis.
 */
export async function paraElEquipo(req: Request, res: Response) {
  const did = req.device!.did;
  const [filas] = await pool.query<any[]>(`SELECT pantalla, stream_rotation FROM devices WHERE id = ?`, [did]);
  const d = (filas as any[])[0];
  if (!d) return res.status(404).json({ error: 'not_found' });

  const creativos = await configCreativos(did);
  const salud = await saludDe(did);

  const [abiertas] = await pool.query<any[]>(
    `SELECT id, tipo, fila, columna FROM pantalla_fallas WHERE device_id = ? AND estado = 'abierta'`, [did]);
  const [descartadas] = await pool.query<any[]>(
    `SELECT DISTINCT tipo, fila, columna FROM pantalla_fallas
     WHERE device_id = ? AND estado = 'descartada' AND recuperada_en >= NOW() - INTERVAL ? DAY`, [did, SILENCIO_DIAS]);

  res.json({
    pantalla: json(d.pantalla),
    encuadre: { ...(await encuadreDe(did)), rotation: Number(d.stream_rotation) || 0 },
    creativos: creativos && {
      ...creativos,
      restantes_hoy: Math.max(0, creativos.max_dia - (await fotosCreativosDeHoy(did))),
    },
    salud: salud && {
      ...salud,
      restantes_hoy: Math.max(0, salud.max_dia - (await alertasDeHoy(did))),
      abiertas: (abiertas as any[]).map((a) => ({ id: a.id, tipo: a.tipo, fila: a.fila, columna: a.columna })),
      silenciadas: (descartadas as any[]).map((a) => clave(a.tipo, a.fila, a.columna)),
    },
  });
}

/** El resumen de la ultima vuelta, que llega pegado al reporte de estado. */
export async function registrarResumen(deviceId: number, salud: any) {
  await pool.query(`UPDATE devices SET salud_ultimo = ? WHERE id = ?`,
    [JSON.stringify({ ...salud, recibido: new Date().toISOString() }), deviceId]);
}

/**
 * El equipo abre o cierra una falla. Solo llega cuando algo cambia de estado,
 * con su foto de evidencia.
 *
 * Aunque el equipo ya evita repetir, aqui tambien: si ya hay una abierta igual
 * (mismo tipo y gabinete) se devuelve esa. Un reintento tras un corte de red no
 * debe duplicar la alerta.
 */
export async function reportarFalla(req: Request, res: Response) {
  const did = req.device!.did;
  const opcional = (v: unknown) => (v === '' || v == null ? undefined : v);
  const schema = z.object({
    evento: z.enum(['abrir', 'recuperar']),
    tipo: z.enum(TIPOS),
    fila: z.preprocess(opcional, z.coerce.number().int().min(0).max(40).optional()),
    columna: z.preprocess(opcional, z.coerce.number().int().min(0).max(40).optional()),
    confianza: z.preprocess(opcional, z.coerce.number().min(0).max(1).default(0)),
    detectada_en: z.preprocess(opcional, z.coerce.date().optional()),
    falla_id: z.preprocess(opcional, z.coerce.number().int().optional()),
    detalle: z.string().max(4000).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', detalle: parsed.error.issues });
  const e = parsed.data;
  const fila = e.fila ?? null;
  const columna = e.columna ?? null;

  // La alerta importa mas que su foto: si la evidencia llega dañada (un corte a
  // media subida), la falla se registra igual, sin foto.
  const guardarFoto = async () => {
    if (!req.file) return null;
    try {
      const r = await uploadPhoto({
        deviceId: did, fileBuffer: req.file.buffer, mimetype: req.file.mimetype,
        taken_at: e.detectada_en ?? new Date(), source: 'falla', watermark_baked: true,
      });
      return r.photo_id;
    } catch (err) {
      console.error('[monitoreo] evidencia ilegible, la falla se guarda sin foto:', (err as any)?.message);
      return null;
    }
  };

  const [geo] = await pool.query<any[]>(`SELECT name, pantalla FROM devices WHERE id = ?`, [did]);
  const pantalla = json((geo as any[])[0]?.pantalla);
  const gabinete = fila != null && columna != null && pantalla?.columnas ? fila * pantalla.columnas + columna + 1 : null;

  if (e.evento === 'abrir') {
    const [ya] = await pool.query<any[]>(
      `SELECT id FROM pantalla_fallas WHERE device_id = ? AND estado = 'abierta' AND tipo = ?
         AND fila <=> ? AND columna <=> ? LIMIT 1`, [did, e.tipo, fila, columna]);
    if ((ya as any[]).length) return res.json({ id: (ya as any[])[0].id, repetida: true });

    const salud = await saludDe(did);
    if (salud && (await alertasDeHoy(did)) >= salud.max_dia) {
      return res.status(429).json({ error: 'tope_diario' });
    }

    const photoId = await guardarFoto();
    const [r] = await pool.query<any>(
      `INSERT INTO pantalla_fallas (device_id, tipo, fila, columna, gabinete, confianza, detectada_en, photo_id, detalle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [did, e.tipo, fila, columna, gabinete, e.confianza, e.detectada_en ?? new Date(), photoId, e.detalle ?? null]);
    const id = (r as any).insertId;
    await avisar(did, id, 'abierta');
    return res.json({ id });
  }

  // Recuperar: por numero si viene, si no, la abierta del mismo tipo y gabinete.
  const [cual] = await pool.query<any[]>(
    e.falla_id
      ? `SELECT id FROM pantalla_fallas WHERE id = ? AND device_id = ? AND estado = 'abierta'`
      : `SELECT id FROM pantalla_fallas WHERE device_id = ? AND estado = 'abierta' AND tipo = ? AND fila <=> ? AND columna <=> ? LIMIT 1`,
    e.falla_id ? [e.falla_id, did] : [did, e.tipo, fila, columna]);
  const abierta = (cual as any[])[0];
  // Ya cerrada (a mano, o un reintento): no es un error para el equipo.
  if (!abierta) return res.json({ id: e.falla_id ?? 0, ya_cerrada: true });
  const photoId = await guardarFoto();
  await pool.query(
    `UPDATE pantalla_fallas SET estado = 'recuperada', recuperada_en = NOW(), cerrada_por = 'equipo',
       photo_recuperacion_id = ? WHERE id = ?`, [photoId, abierta.id]);
  await avisar(did, abierta.id, 'recuperada');
  res.json({ id: abierta.id });
}

/** Aviso en vivo a los dashboards abiertos. */
async function avisar(deviceId: number, fallaId: number, estado: string) {
  try {
    const [f] = await pool.query<any[]>(
      `SELECT f.*, d.name AS equipo FROM pantalla_fallas f JOIN devices d ON d.id = f.device_id WHERE f.id = ?`, [fallaId]);
    const falla = (f as any[])[0];
    await redis.publish('pantalla:falla', JSON.stringify({
      device_id: deviceId, id: fallaId, estado, tipo: falla?.tipo, nombre: NOMBRES[falla?.tipo] ?? falla?.tipo,
      equipo: falla?.equipo, gabinete: falla?.gabinete,
    }));
  } catch (err) {
    console.error('[monitoreo] no se pudo avisar:', (err as any)?.message);
  }
}

// --- Dashboard ------------------------------------------------------------------

const SELECT_FALLAS = `
  SELECT f.id, f.device_id, d.name AS equipo, f.tipo, f.fila, f.columna, f.gabinete, f.confianza, f.estado,
         f.detectada_en, f.recuperada_en, f.cerrada_por, f.nota, f.detalle,
         p.storage_path AS evidencia, p.thumbnail_path AS evidencia_mini,
         pr.storage_path AS evidencia_recuperacion, pr.thumbnail_path AS evidencia_recuperacion_mini
  FROM pantalla_fallas f
  JOIN devices d ON d.id = f.device_id
  LEFT JOIN photos p ON p.id = f.photo_id
  LEFT JOIN photos pr ON pr.id = f.photo_recuperacion_id`;

function presentar(filas: any[]) {
  return filas.map((f) => ({
    ...f,
    nombre: NOMBRES[f.tipo] ?? f.tipo,
    detalle: json(f.detalle),
    evidencia: f.evidencia ? firmar(f.evidencia) : null,
    evidencia_mini: f.evidencia_mini ? firmar(f.evidencia_mini) : null,
    evidencia_recuperacion: f.evidencia_recuperacion ? firmar(f.evidencia_recuperacion) : null,
    evidencia_recuperacion_mini: f.evidencia_recuperacion_mini ? firmar(f.evidencia_recuperacion_mini) : null,
  }));
}

/** La pantalla de un equipo: configuracion, ultima vuelta e historial. */
export async function deEquipo(req: Request, res: Response) {
  const did = Number(req.params.id);
  const [filas] = await pool.query<any[]>(`SELECT pantalla, salud_ultimo FROM devices WHERE id = ?`, [did]);
  const d = (filas as any[])[0];
  if (!d) return res.status(404).json({ error: 'not_found' });
  const [fallas] = await pool.query<any[]>(`${SELECT_FALLAS} WHERE f.device_id = ? ORDER BY f.detectada_en DESC LIMIT 100`, [did]);
  res.json({
    pantalla: json(d.pantalla),
    salud: await saludDe(did),
    ultimo: json(d.salud_ultimo),
    fallas: presentar(fallas as any[]),
  });
}

/**
 * Marcar la pantalla. Otras esquinas u otra cuadricula son otra imagen: lo que
 * se aprendio (creativos, zonas que nunca cambian) ya no vale y se empieza de
 * cero. Solo el horario o las zonas excluidas NO reinician nada.
 */
export async function configurarPantalla(req: Request, res: Response) {
  const parsed = pantallaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', detalle: parsed.error.issues });
  const nueva = parsed.data;
  const did = Number(req.params.id);

  const [filas] = await pool.query<any[]>(`SELECT pantalla FROM devices WHERE id = ?`, [did]);
  if (!(filas as any[]).length) return res.status(404).json({ error: 'not_found' });
  const antes = json((filas as any[])[0].pantalla);
  const cambioImagen = !antes
    || JSON.stringify(antes.esquinas) !== JSON.stringify(nueva.esquinas)
    || antes.filas !== nueva.filas || antes.columnas !== nueva.columnas;

  await pool.query(`UPDATE devices SET pantalla = ? WHERE id = ?`, [JSON.stringify(nueva), did]);
  if (cambioImagen) {
    await pool.query(
      `UPDATE devices SET creative_desde = IF(creative_watch, NOW(), creative_desde),
                          salud_desde = IF(salud_watch, NOW(), salud_desde) WHERE id = ?`, [did]);
    await pool.query(`DELETE FROM device_creatives WHERE device_id = ?`, [did]);
  }
  res.json({ ok: true, reiniciado: cambioImagen });
}

export async function configurarSalud(req: Request, res: Response) {
  const schema = z.object({
    vigilar: z.boolean().optional(),
    cada_min: z.number().int().min(30).max(720).optional(),
    confirmaciones: z.number().int().min(1).max(6).optional(),
    umbral: z.number().min(0.3).max(0.95).optional(),
    max_dia: z.number().int().min(1).max(50).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const d = parsed.data;
  const campos: string[] = [];
  const valores: any[] = [];
  if (d.vigilar !== undefined) {
    campos.push('salud_watch = ?', 'salud_desde = ?');
    valores.push(d.vigilar, d.vigilar ? new Date() : null);
  }
  if (d.cada_min !== undefined) { campos.push('salud_cada_min = ?'); valores.push(d.cada_min); }
  if (d.confirmaciones !== undefined) { campos.push('salud_confirmaciones = ?'); valores.push(d.confirmaciones); }
  if (d.umbral !== undefined) { campos.push('salud_umbral = ?'); valores.push(d.umbral); }
  if (d.max_dia !== undefined) { campos.push('salud_max_dia = ?'); valores.push(d.max_dia); }
  if (!campos.length) return res.status(400).json({ error: 'no_fields' });
  await pool.query(`UPDATE devices SET ${campos.join(', ')} WHERE id = ?`, [...valores, req.params.id]);
  res.json({ ok: true, salud: await saludDe(Number(req.params.id)) });
}

/** Historial de la flota, para la pagina de alertas. */
export async function listar(req: Request, res: Response) {
  const schema = z.object({
    estado: z.enum(['abierta', 'recuperada', 'descartada']).optional(),
    device_id: z.coerce.number().int().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  });
  const q = schema.parse(req.query);
  const where: string[] = [];
  const vals: any[] = [];
  if (q.estado) { where.push('f.estado = ?'); vals.push(q.estado); }
  if (q.device_id) { where.push('f.device_id = ?'); vals.push(q.device_id); }
  const [filas] = await pool.query<any[]>(
    `${SELECT_FALLAS} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY f.estado = 'abierta' DESC, f.detectada_en DESC LIMIT ?`,
    [...vals, q.limit]);
  const [cuenta] = await pool.query<any[]>(`SELECT COUNT(*) n FROM pantalla_fallas WHERE estado = 'abierta'`);
  res.json({ abiertas: Number((cuenta as any[])[0]?.n || 0), fallas: presentar(filas as any[]) });
}

/**
 * Cerrar a mano: "descartada" (no era una falla: el equipo no vuelve a avisar de
 * ESA zona en SILENCIO_DIAS) o "recuperada" (se arreglo y ya no hace falta
 * esperar a que el equipo lo compruebe).
 */
export async function actualizar(req: Request, res: Response) {
  const schema = z.object({
    estado: z.enum(['recuperada', 'descartada']),
    nota: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const [r] = await pool.query<any>(
    `UPDATE pantalla_fallas SET estado = ?, recuperada_en = NOW(), cerrada_por = 'usuario', user_id = ?, nota = ?
     WHERE id = ? AND estado = 'abierta'`,
    [parsed.data.estado, req.user!.uid, parsed.data.nota ?? null, req.params.id]);
  if (!(r as any).affectedRows) return res.status(404).json({ error: 'no_abierta' });
  const [f] = await pool.query<any[]>(`SELECT device_id FROM pantalla_fallas WHERE id = ?`, [req.params.id]);
  await avisar((f as any[])[0].device_id, Number(req.params.id), parsed.data.estado);
  res.json({ ok: true });
}
