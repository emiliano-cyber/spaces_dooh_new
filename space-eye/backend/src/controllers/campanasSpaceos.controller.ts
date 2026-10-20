// backend/src/controllers/campanasSpaceos.controller.ts
//
// Las campanas que se venden en SPACE OS, en los equipos de su pantalla.
//
// SPACE OS es quien sabe que creativo sale en que pantalla y cuando (sus
// reservas). Cada pocos minutos manda aqui su lista COMPLETA de lo vigente:
// cada par campana-creativo es una campana de Space Eye (una referencia por
// campana), ligada a los equipos cuyo codigo de pantalla coincide. Lo que ya no
// viene se apaga; nada se borra (las fotos de prueba siguen ligadas).
//
// El equipo recibe sus campanas en /api/device/monitoreo, baja la referencia
// UNA vez (reducida aqui, unos 50 KB) y, cuando la reconoce en su pantalla, sube
// una foto de prueba ligada a la campana: una por campana al dia. La verificacion
// de siempre la revisa.
import { Request, Response } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { pool } from '../config/database';
import { leerStored } from '../services/photoStorage.service';

// 'spaceos:<empresa>': cada empresa de la instancia manda SU lista y solo apaga
// lo suyo.
const ORIGEN = /^spaceos(:[A-Za-z0-9-]{1,40})?$/;
// Ancho de la referencia que baja el equipo: el doble de la pantalla con la que
// compara (320 px), para que al reducirla alla no pierda detalle.
const ANCHO_REFERENCIA = 640;

const esquema = z.object({
  origen: z.string().regex(ORIGEN),
  campanas: z.array(z.object({
    origen_id: z.string().min(1).max(160),
    nombre: z.string().min(1).max(200),
    anunciante: z.string().max(200).nullable().optional(),
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Codigos de pantalla (sitios.codigo_proveedor en SPACE OS); se comparan
    // con devices.billboard_code sin mayusculas ni espacios, como alla.
    codigos: z.array(z.string().max(120)).max(500),
    // Huella del arte en SPACE OS: si cambia, hay que volver a subirlo.
    sha: z.string().regex(/^[0-9a-f]{64}$/),
  })).max(2000),
});

const limpio = (c: string) => c.trim().toLowerCase();

// La verificacion con IA necesita el ai-worker, y la pila de Space Eye de cada
// empresa (infra/eyes) NO lo trae: con la verificacion encendida, las fotos de
// prueba se quedaban en "pendiente" para siempre. Se enciende solo donde hay
// verificador (VERIFICACION_IA=1); sin el, la foto de prueba llega igual y se
// revisa a ojo.
const verificarConIa = () => process.env.VERIFICACION_IA === '1';

/**
 * POST /api/campaigns/sincronizar — la lista completa de un origen.
 *
 * Responde, por campana, su id aqui y si le falta el arte (nueva o cambiado):
 * quien sincroniza lo sube despues con POST /api/campaigns/:id/creative.
 */
export async function sincronizar(req: Request, res: Response) {
  const parsed = esquema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  const { origen, campanas } = parsed.data;
  // Con la llave de una empresa, solo sus equipos.
  const dueno = req.servicio?.owner ?? null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const salida: { origen_id: string; id: number; necesita_creativo: boolean; equipos: number }[] = [];

    for (const c of campanas) {
      await conn.query(
        `INSERT INTO campaigns (name, advertiser, start_date, end_date, verification_enabled, active, origen, origen_id)
         VALUES (?, ?, ?, ?, ?, TRUE, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), advertiser = VALUES(advertiser),
           start_date = VALUES(start_date), end_date = VALUES(end_date), active = TRUE,
           verification_enabled = VALUES(verification_enabled)`,
        [c.nombre, c.anunciante ?? null, c.desde, c.hasta, verificarConIa(), origen, c.origen_id]
      );
      const [f] = await conn.query<any[]>(
        `SELECT id, creative_path, origen_sha FROM campaigns WHERE origen = ? AND origen_id = ?`,
        [origen, c.origen_id]
      );
      const fila = (f as any[])[0];

      const codigos = [...new Set(c.codigos.map(limpio).filter(Boolean))];
      let equipos: number[] = [];
      if (codigos.length) {
        const [d] = await conn.query<any[]>(
          `SELECT id FROM devices WHERE LOWER(TRIM(billboard_code)) IN (?) AND (? IS NULL OR owner = ?)`,
          [codigos, dueno, dueno]
        );
        equipos = (d as any[]).map((x) => Number(x.id));
      }
      // Los equipos se reemplazan enteros: la pantalla de una reserva puede cambiar.
      await conn.query(`DELETE FROM campaign_devices WHERE campaign_id = ?`, [fila.id]);
      if (equipos.length) {
        await conn.query(`INSERT INTO campaign_devices (campaign_id, device_id) VALUES ?`,
          [equipos.map((d) => [fila.id, d])]);
      }
      salida.push({
        origen_id: c.origen_id,
        id: Number(fila.id),
        necesita_creativo: !fila.creative_path || fila.origen_sha !== c.sha,
        equipos: equipos.length,
      });
    }

    // Lo que ya no viene (cancelada, vencida, creativo retirado): se apaga.
    const vigentes = campanas.map((c) => c.origen_id);
    const [apagadas] = await conn.query<any>(
      vigentes.length
        ? `UPDATE campaigns SET active = FALSE WHERE origen = ? AND active = TRUE AND origen_id NOT IN (?)`
        : `UPDATE campaigns SET active = FALSE WHERE origen = ? AND active = TRUE`,
      vigentes.length ? [origen, vigentes] : [origen]
    );

    await conn.commit();
    res.json({ campanas: salida, apagadas: Number((apagadas as any).affectedRows) || 0 });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Las campanas que un equipo tiene que reconocer hoy, para su configuracion de
 * vigilancia. Solo las que tienen arte. `foto_hoy`: ya llego su prueba de hoy
 * (asi un reinicio del equipo no la repite).
 */
export async function campanasDelEquipo(deviceId: number) {
  const [filas] = await pool.query<any[]>(
    `SELECT c.id, c.creative_sha,
            EXISTS (SELECT 1 FROM photos p WHERE p.device_id = cd.device_id AND p.campaign_id = c.id
                      AND p.source = 'campana' AND p.uploaded_at >= CURDATE()) AS foto_hoy
       FROM campaigns c JOIN campaign_devices cd ON cd.campaign_id = c.id
      WHERE cd.device_id = ? AND c.active = TRUE AND c.creative_path IS NOT NULL
        AND CURDATE() BETWEEN c.start_date AND c.end_date
      ORDER BY c.id
      LIMIT 50`,
    [deviceId]
  );
  return (filas as any[]).map((f) => ({
    id: Number(f.id),
    sha: f.creative_sha || String(f.id),
    foto_hoy: !!f.foto_hoy,
  }));
}

// La referencia reducida, por ruta y huella: la piden todos los equipos de la
// campana y no cambia hasta que cambia el arte.
const reducidas = new Map<string, Buffer>();

/** GET /api/device/campanas/:id/referencia — el arte reducido, solo para sus equipos. */
export async function referenciaParaEquipo(req: Request, res: Response) {
  const did = req.device!.did;
  const id = Number(req.params.id);
  const [f] = await pool.query<any[]>(
    `SELECT c.creative_path, c.creative_sha FROM campaigns c
       JOIN campaign_devices cd ON cd.campaign_id = c.id AND cd.device_id = ?
      WHERE c.id = ? AND c.creative_path IS NOT NULL`,
    [did, id]
  );
  const fila = (f as any[])[0];
  if (!fila) return res.status(404).json({ error: 'not_found' });

  const llave = `${fila.creative_path}|${fila.creative_sha || ''}`;
  let jpeg = reducidas.get(llave);
  if (!jpeg) {
    jpeg = await sharp(await leerStored(fila.creative_path))
      .rotate()
      .resize(ANCHO_REFERENCIA, ANCHO_REFERENCIA, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#000' })
      .jpeg({ quality: 82 })
      .toBuffer();
    if (reducidas.size > 200) reducidas.clear();
    reducidas.set(llave, jpeg);
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('X-Huella', fila.creative_sha || '');
  res.send(jpeg);
}
