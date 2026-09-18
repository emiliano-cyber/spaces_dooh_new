// backend/src/controllers/creativos.controller.ts
//
// Los creativos que rota cada pantalla, reconocidos por su huella visual.
//
// El equipo hace el trabajo pesado: mira la pantalla, calcula huellas y decide
// que es nuevo (tiene que decidirlo el, porque el creativo dura 20 segundos y no
// da tiempo de consultar al servidor y volver). Aqui se guarda el catalogo, se
// entrega la configuracion, y se hace de segundo filtro por si el equipo perdio
// su copia local o reporta una huella que en realidad ya conociamos.
import { Request, Response } from 'express';
import { pool } from '../config/database';
import { z } from 'zod';
import { firmarFilas } from '../utils/firmaArchivos';

/** Bits distintos entre dos huellas de 256 bits en hexadecimal. */
export function distancia(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 256;
  let d = 0;
  // De 4 en 4 caracteres (16 bits) para no depender de BigInt.
  for (let i = 0; i < a.length; i += 4) {
    let x = parseInt(a.slice(i, i + 4), 16) ^ parseInt(b.slice(i, i + 4), 16);
    while (x) { d += x & 1; x >>>= 1; }
  }
  return d;
}

const HUELLA = /^[0-9a-f]{64}$/i;

/** La configuracion de vigilancia del equipo, tal como se la lleva el agente. */
export async function configDe(deviceId: number) {
  const [filas] = await pool.query<any[]>(
    `SELECT creative_watch, creative_desde, creative_max_dia, creative_cada_min,
            creative_recorrido_seg, creative_paso_seg, creative_tolerancia
     FROM devices WHERE id = ?`,
    [deviceId]
  );
  const d = (filas as any[])[0];
  if (!d) return null;

  // Las primeras 24 horas solo aprende: registra el loop de dia y de noche sin
  // fotografiar nada. Si no, el primer recorrido subiria 12 fotos de golpe de
  // creativos que llevaban ahi semanas.
  const desde = d.creative_desde ? new Date(d.creative_desde).getTime() : null;
  const aprendiendo = !!desde && (Date.now() - desde) < 24 * 3600 * 1000;

  return {
    vigilar: !!d.creative_watch,
    aprendiendo,
    max_dia: d.creative_max_dia,
    cada_min: d.creative_cada_min,
    recorrido_seg: d.creative_recorrido_seg,
    paso_seg: d.creative_paso_seg,
    tolerancia: d.creative_tolerancia,
  };
}

/** Cuantas fotos de creativo nuevo lleva hoy el equipo (para el tope diario). */
async function fotosDeHoy(deviceId: number): Promise<number> {
  const [filas] = await pool.query<any[]>(
    `SELECT COUNT(*) n FROM photos
     WHERE device_id = ? AND source = 'creative_change' AND taken_at >= CURDATE()`,
    [deviceId]
  );
  return Number((filas as any[])[0]?.n || 0);
}

/**
 * Lo que el agente pide antes de cada recorrido: su configuracion y el catalogo
 * de huellas que ya conoce el sitio.
 *
 * El catalogo pesa 64 bytes por creativo (una docena, menos de un kilobyte): es
 * la unica forma de que un equipo recien reinstalado no vuelva a fotografiar los
 * doce creativos que ya estaban ahi.
 */
export async function paraElEquipo(req: Request, res: Response) {
  const did = req.device!.did;
  const config = await configDe(did);
  if (!config) return res.status(404).json({ error: 'not_found' });

  const [filas] = await pool.query<any[]>(
    `SELECT phash FROM device_creatives WHERE device_id = ? ORDER BY ultima_vez DESC LIMIT 200`,
    [did]
  );

  res.json({
    config,
    restantes_hoy: Math.max(0, config.max_dia - (await fotosDeHoy(did))),
    conocidas: (filas as any[]).map((f: any) => f.phash),
  });
}

/**
 * El resultado de un recorrido, que llega pegado al reporte de estado.
 *
 * `vistas` son huellas del catalogo que se volvieron a ver (solo refrescan la
 * fecha, para saber que sigue en rotacion). `nuevas` son las que el equipo no
 * reconocio; de esas normalmente ya viene la foto por su cuenta.
 */
export async function registrarRecorrido(
  deviceId: number,
  vistas: string[],
  nuevas: string[],
  aprendiendo: boolean,
) {
  const limpias = (lista: string[]) =>
    [...new Set((lista || []).filter((h) => HUELLA.test(h)).map((h) => h.toLowerCase()))].slice(0, 60);

  const yaVistas = limpias(vistas);
  if (yaVistas.length) {
    await pool.query(
      `UPDATE device_creatives SET vistas = vistas + 1, ultima_vez = NOW()
       WHERE device_id = ? AND phash IN (?)`,
      [deviceId, yaVistas]
    );
  }

  const candidatas = limpias(nuevas);
  if (!candidatas.length) return;

  // Segundo filtro: el equipo pudo perder su catalogo local (reinstalacion) o
  // reportar como nueva una huella que solo difiere en unos bits de otra que ya
  // teniamos. Sin esto, cada reinstalacion volveria a "descubrir" el loop entero.
  const [conocidas] = await pool.query<any[]>(
    `SELECT phash FROM device_creatives WHERE device_id = ?`,
    [deviceId]
  );
  const catalogo = (conocidas as any[]).map((f: any) => f.phash);
  const cfg = await configDe(deviceId);
  const tolerancia = cfg?.tolerancia ?? 24;

  for (const h of candidatas) {
    const parecida = catalogo.find((c) => distancia(c, h) <= tolerancia);
    if (parecida) {
      await pool.query(
        `UPDATE device_creatives SET vistas = vistas + 1, ultima_vez = NOW()
         WHERE device_id = ? AND phash = ?`,
        [deviceId, parecida]
      );
      continue;
    }
    await pool.query(
      `INSERT INTO device_creatives (device_id, phash, aprendido) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE vistas = vistas + 1, ultima_vez = NOW()`,
      [deviceId, h, aprendiendo ? 1 : 0]
    );
    catalogo.push(h);
  }
}

/** Liga la foto de evidencia con el creativo que la disparo. */
export async function ligarFoto(deviceId: number, phash: string, photoId: number) {
  if (!HUELLA.test(phash || '')) return;
  await pool.query(
    `UPDATE device_creatives SET photo_id = ?, ultima_vez = NOW()
     WHERE device_id = ? AND phash = ? AND photo_id IS NULL`,
    [photoId, deviceId, phash.toLowerCase()]
  );
}

// --- Dashboard --------------------------------------------------------------

export async function listarDeEquipo(req: Request, res: Response) {
  const did = Number(req.params.id);

  const [filas] = await pool.query<any[]>(
    `SELECT c.*, p.thumbnail_path, p.storage_path, p.taken_at
     FROM device_creatives c
     LEFT JOIN photos p ON p.id = c.photo_id
     WHERE c.device_id = ?
     ORDER BY c.ultima_vez DESC`,
    [did]
  );

  const config = await configDe(did);
  res.json({
    config,
    fotos_hoy: await fotosDeHoy(did),
    creativos: firmarFilas(filas as any[]),
  });
}

export async function configurar(req: Request, res: Response) {
  const schema = z.object({
    vigilar: z.boolean().optional(),
    max_dia: z.number().int().min(0).max(100).optional(),
    cada_min: z.number().int().min(30).max(1440).optional(),
    recorrido_seg: z.number().int().min(60).max(900).optional(),
    paso_seg: z.number().int().min(5).max(60).optional(),
    tolerancia: z.number().int().min(0).max(128).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const d = parsed.data;
  const campos: string[] = [];
  const valores: any[] = [];

  if (d.vigilar !== undefined) {
    campos.push('creative_watch = ?');
    valores.push(d.vigilar);
    // Encenderla arranca de cero el plazo de aprendizaje: el sitio pudo cambiar
    // por completo desde la ultima vez que se vigilo.
    campos.push('creative_desde = ?');
    valores.push(d.vigilar ? new Date() : null);
  }
  if (d.max_dia !== undefined) { campos.push('creative_max_dia = ?'); valores.push(d.max_dia); }
  if (d.cada_min !== undefined) { campos.push('creative_cada_min = ?'); valores.push(d.cada_min); }
  if (d.recorrido_seg !== undefined) { campos.push('creative_recorrido_seg = ?'); valores.push(d.recorrido_seg); }
  if (d.paso_seg !== undefined) { campos.push('creative_paso_seg = ?'); valores.push(d.paso_seg); }
  if (d.tolerancia !== undefined) { campos.push('creative_tolerancia = ?'); valores.push(d.tolerancia); }

  if (!campos.length) return res.status(400).json({ error: 'no_fields' });

  await pool.query(`UPDATE devices SET ${campos.join(', ')} WHERE id = ?`, [...valores, req.params.id]);
  res.json({ ok: true, config: await configDe(Number(req.params.id)) });
}

/** "Esto no era un creativo nuevo": deja de contarlo como hallazgo. */
export async function descartar(req: Request, res: Response) {
  const schema = z.object({ descartado: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  await pool.query(
    `UPDATE device_creatives SET descartado = ? WHERE id = ?`,
    [parsed.data.descartado, req.params.id]
  );
  res.json({ ok: true });
}

/** Olvidar el catalogo y volver a aprender (cambio de pantalla, de encuadre...). */
export async function reaprender(req: Request, res: Response) {
  const did = Number(req.params.id);
  await pool.query(`DELETE FROM device_creatives WHERE device_id = ?`, [did]);
  await pool.query(`UPDATE devices SET creative_desde = NOW() WHERE id = ?`, [did]);
  res.json({ ok: true });
}
