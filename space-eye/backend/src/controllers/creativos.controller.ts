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
import { equipoAjeno } from '../utils/dueno';
import { z } from 'zod';
import { firmarFilas } from '../utils/firmaArchivos';
import { encuadreDe } from './dashboard.controller';

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
            creative_recorrido_seg, creative_paso_seg, creative_tolerancia, aprendizaje_min,
            creative_envio_min, creative_refoto_h
     FROM devices WHERE id = ?`,
    [deviceId]
  );
  const d = (filas as any[])[0];
  if (!d) return null;

  // Al principio solo aprende: registra el loop sin fotografiar nada. Si no, el
  // primer recorrido subiria 12 fotos de golpe de creativos que llevaban ahi
  // semanas. Cuanto, lo dice aprendizaje_min (migracion 019; antes, 24 h fijas).
  // Con 0 el servidor no marca aprendizaje: el equipo igual aprende su primera
  // vuelta por su cuenta antes de fotografiar.
  const desde = d.creative_desde ? new Date(d.creative_desde).getTime() : null;
  const aprendizajeMin = Number(d.aprendizaje_min ?? 120);
  const aprendiendo = aprendizajeMin > 0 && !!desde && (Date.now() - desde) < aprendizajeMin * 60_000;

  return {
    vigilar: !!d.creative_watch,
    aprendiendo,
    aprendizaje_min: aprendizajeMin,
    // Desde cuando vigila: el dashboard lo usa para decir hasta cuando aprende.
    desde: d.creative_desde,
    max_dia: d.creative_max_dia,
    cada_min: d.creative_cada_min,
    // Cuando mandar las fotos nuevas: 0 al momento, o juntas cada N min (023).
    envio_min: Number(d.creative_envio_min ?? 0),
    // Cada cuantas horas se acepta OTRA foto del mismo creativo, para que la
    // ficha pueda ensenar como se ve ahora y no solo como aparecio (029).
    // 0 = nunca: la repetida se descarta, que es lo que se hacia antes.
    refoto_h: Number(d.creative_refoto_h ?? 24),
    recorrido_seg: d.creative_recorrido_seg,
    paso_seg: d.creative_paso_seg,
    tolerancia: d.creative_tolerancia,
  };
}

/** Cuantas fotos de creativo nuevo lleva hoy el equipo (para el tope diario). */
export async function fotosDeHoy(deviceId: number): Promise<number> {
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

  // El encuadre del sitio, el mismo que viaja en cada orden de foto. La APK no
  // tiene otra forma de saberlo: sin esto, la vigilancia miraria con el lente y
  // el zoom por defecto y fotografiaria otra cosa que las fotos programadas.
  // La Raspberry lo ignora.
  const [giro] = await pool.query<any[]>(`SELECT stream_rotation FROM devices WHERE id = ?`, [did]);
  const rotation = Number((giro as any[])[0]?.stream_rotation) || 0;

  res.json({
    config,
    restantes_hoy: Math.max(0, config.max_dia - (await fotosDeHoy(did))),
    conocidas: (filas as any[]).map((f: any) => f.phash),
    encuadre: { ...(await encuadreDe(did)), rotation },
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
  const candidatas = limpias(nuevas);
  if (!yaVistas.length && !candidatas.length) return;

  const [conocidas] = await pool.query<any[]>(
    `SELECT phash FROM device_creatives WHERE device_id = ?`,
    [deviceId]
  );
  const catalogo = (conocidas as any[]).map((f: any) => f.phash);
  const cfg = await configDe(deviceId);
  const tolerancia = cfg?.tolerancia ?? 24;

  // Las vistas se buscan por PARECIDO, no por igualdad. El equipo reconoce con
  // tolerancia y reporta la huella de su vistazo, que casi nunca coincide bit a
  // bit con la del catalogo; con un `IN (...)` exacto el creativo nunca se
  // marcaba como visto, y en la Raspberry 234 de 239 se quedaron en 1 vista.
  const refrescar = new Set<string>();
  for (const h of yaVistas) {
    const c = catalogo.find((x) => distancia(x, h) <= tolerancia);
    if (c) refrescar.add(c);
  }
  if (refrescar.size) {
    await pool.query(
      `UPDATE device_creatives SET vistas = vistas + 1, ultima_vez = NOW()
       WHERE device_id = ? AND phash IN (?)`,
      [deviceId, [...refrescar]]
    );
  }

  if (!candidatas.length) return;

  // Por que estas no traeran foto. El catalogo y la galeria se llenan por
  // caminos distintos -la huella viaja siempre, la foto solo si el equipo podia
  // tomarla- y hasta ahora la tarjeta sin imagen no decia nada. Se guarda el
  // motivo para poder decirlo (migracion 028).
  const sinFoto = aprendiendo
    ? 'aprendizaje'
    : (cfg?.envio_min ?? 0) > 0
      ? 'envio_agrupado'
      : (await fotosDeHoy(deviceId)) >= Number(cfg?.max_dia ?? 12)
        ? 'tope_del_dia'
        // Si no fue ninguna de las tres, la foto salio y no llego: la subida
        // fallo. Es el unico caso de los cuatro que hay que mirar.
        : 'no_subio';

  // Segundo filtro: el equipo pudo perder su catalogo local (reinstalacion) o
  // reportar como nueva una huella que solo difiere en unos bits de otra que ya
  // teniamos. Sin esto, cada reinstalacion volveria a "descubrir" el loop entero.

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
      `INSERT INTO device_creatives (device_id, phash, aprendido, sin_foto) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE vistas = vistas + 1, ultima_vez = NOW(),
         -- Si la foto ya llego (viaja por su cuenta y suele ganarle a la
         -- huella), no hay nada que explicar.
         sin_foto = IF(photo_id IS NULL, COALESCE(sin_foto, VALUES(sin_foto)), NULL)`,
      [deviceId, h, aprendiendo ? 1 : 0, sinFoto]
    );
    catalogo.push(h);
  }
}

/**
 * Esta huella, ¿ya esta en el catalogo del sitio?
 *
 * El equipo reconoce por ESQUINAS (ORB), no por la huella: son dos criterios
 * distintos y el segundo caza lo que al primero se le va. Una pantalla en blanco
 * no tiene esquinas que casar, asi que el equipo la da por "nueva" cada vez que
 * la ve; su huella, en cambio, es casi la misma todos los dias. Le paso a
 * TLALPAN el 25 y el 26 de oct de 2026: dos fotos de la pantalla apagada
 * etiquetadas "Creativo nuevo", a 7 y 14 bits una de otra, con una tolerancia
 * de 24.
 *
 * `registrarRecorrido` ya hacia esta comparacion para no ensuciar el catalogo,
 * pero la FOTO entraba por otra puerta (`ligarFoto`, que compara la huella
 * exacta) y se quedaba en la galeria diciendo lo que no era. Esto es la misma
 * regla, aplicada tambien en esa puerta.
 *
 * Devuelve la huella del catalogo mas parecida dentro de la tolerancia del
 * sitio, o null si de verdad no la conociamos.
 */
/**
 * Un creativo del catalogo que ya conociamos, con lo que hace falta para
 * decidir que hacer con la foto que acaba de llegar.
 */
export type Conocida = {
  phash: string;
  /** Bits de diferencia con la huella que llego (dentro de la tolerancia). */
  bits: number;
  /** La foto del hallazgo. Si es null, la ficha todavia no tiene ninguna. */
  photo_id: number | null;
  /** La ultima que aceptamos, si ya hubo mas de una. */
  photo_id_ultima: number | null;
  /** Cuando se tomo la mas reciente de las dos. */
  foto_en: Date | null;
};

export async function yaConocida(
  deviceId: number,
  phash: string,
): Promise<Conocida | null> {
  if (!HUELLA.test(phash || '')) return null;
  const h = phash.toLowerCase();

  // La fecha es la de la foto MAS reciente que tengamos de ese creativo -la
  // repetida si la hay, si no la del hallazgo-, y es lo que decide si toca
  // refrescarla (029).
  const [filas] = await pool.query<any[]>(
    `SELECT c.phash, c.photo_id, c.photo_id_ultima,
            COALESCE(u.taken_at, p.taken_at) AS foto_en
       FROM device_creatives c
       LEFT JOIN photos p ON p.id = c.photo_id
       LEFT JOIN photos u ON u.id = c.photo_id_ultima
      WHERE c.device_id = ?`,
    [deviceId]
  );
  const cfg = await configDe(deviceId);
  const tolerancia = cfg?.tolerancia ?? 24;

  let mejor: Conocida | null = null;
  for (const f of filas as any[]) {
    const bits = distancia(f.phash, h);
    if (bits <= tolerancia && (!mejor || bits < mejor.bits)) {
      mejor = {
        phash: f.phash,
        bits,
        photo_id: f.photo_id ?? null,
        photo_id_ultima: f.photo_id_ultima ?? null,
        foto_en: f.foto_en ? new Date(f.foto_en) : null,
      };
    }
  }
  return mejor;
}

/**
 * ¿Toca aceptar OTRA foto de este creativo?
 *
 * La primera foto no se discute: si la ficha no tiene ninguna, esta se queda.
 * A partir de ahi se raciona, porque cada foto son datos moviles del sitio y
 * el equipo puede estar mandando la misma pantalla una y otra vez -es
 * exactamente lo que hacia TLALPAN con la pantalla apagada-. Con
 * `creative_refoto_h` horas de por medio, la ficha ensena como se ve hoy sin
 * que eso cueste una foto por vuelta.
 *
 * Con refoto_h = 0 nunca se repite: el comportamiento anterior a la 029.
 */
export function tocaRefoto(c: Conocida, refotoH: number, ahora = Date.now()): boolean {
  if (!c.photo_id) return true;
  if (!(refotoH > 0)) return false;
  // Sin fecha no sabemos cuanto hace (la foto pudo borrarse de `photos`): se
  // deja pasar una, que es el lado que deja la ficha completa.
  if (!c.foto_en) return true;
  return ahora - c.foto_en.getTime() >= refotoH * 3_600_000;
}

/** Se volvio a ver: solo refresca la fecha y la cuenta. */
export async function refrescarCreativo(deviceId: number, phash: string) {
  await pool.query(
    `UPDATE device_creatives SET vistas = vistas + 1, ultima_vez = NOW()
     WHERE device_id = ? AND phash = ?`,
    [deviceId, phash]
  );
}

/**
 * Liga la foto de evidencia con el creativo que la disparo.
 *
 * La foto llega ANTES que el creativo: el equipo la sube en el momento de
 * detectarlo, y la huella viaja despues, pegada al siguiente reporte de estado.
 * Antes esto era un UPDATE a secas, que en ese orden no encontraba la fila, y
 * ninguna de las ~200 fotos de creativo nuevo de la Raspberry quedo ligada. Por
 * eso aqui se crea la fila si no existe; cuando llegue el recorrido, la vera
 * como ya conocida.
 */
export async function ligarFoto(deviceId: number, phash: string, photoId: number) {
  if (!HUELLA.test(phash || '')) return;
  // `photo_id` es la del hallazgo y no se pisa nunca: es la evidencia de que
  // ese anuncio aparecio ese dia. La nueva va a `photo_id_ultima`, para que la
  // ficha pueda ensenar las dos (029) -como aparecio y como se ve ahora-.
  //
  // `NULLIF` evita el caso bobo de la primera: cuando esta es la foto del
  // hallazgo, la "ultima" seria ella misma y la ficha ensenaria dos veces la
  // misma imagen. Mientras solo haya una, `photo_id_ultima` se queda en NULL.
  await pool.query(
    `INSERT INTO device_creatives (device_id, phash, photo_id) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE photo_id = IFNULL(photo_id, VALUES(photo_id)),
       photo_id_ultima = NULLIF(VALUES(photo_id), IFNULL(photo_id, VALUES(photo_id))),
       ultima_vez = NOW(), sin_foto = NULL`,
    [deviceId, phash.toLowerCase(), photoId]
  );
}

// --- Dashboard --------------------------------------------------------------

export async function listarDeEquipo(req: Request, res: Response) {
  const did = Number(req.params.id);
  if (await equipoAjeno(req, did)) return res.status(404).json({ error: 'not_found' });

  // Dos LEFT JOIN a `photos`: la del hallazgo y la mas reciente. Las columnas
  // de la segunda van con prefijo `ultima_` para no pisar a las de la primera,
  // que es lo que la ficha ya pintaba.
  const [filas] = await pool.query<any[]>(
    `SELECT c.*, p.thumbnail_path, p.storage_path, p.taken_at,
            u.thumbnail_path AS ultima_thumbnail_path,
            u.storage_path  AS ultima_storage_path,
            u.taken_at      AS ultima_taken_at
     FROM device_creatives c
     LEFT JOIN photos p ON p.id = c.photo_id
     LEFT JOIN photos u ON u.id = c.photo_id_ultima
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
    // 0 = continuo: el equipo mira todo el dia dentro del horario (APK 0.15.2+).
    cada_min: z.union([z.literal(0), z.number().int().min(30).max(1440)]).optional(),
    recorrido_seg: z.number().int().min(60).max(900).optional(),
    paso_seg: z.number().int().min(5).max(60).optional(),
    tolerancia: z.number().int().min(0).max(128).optional(),
    // 0 = al momento; si no, juntas cada N minutos (el panel ofrece 2/4/8/12 h).
    envio_min: z.number().int().min(0).max(1440).optional(),
    // Horas entre fotos del MISMO creativo (029). 0 = no repetir; el techo de
    // una semana es para que nadie lo deje en un numero que no vuelve nunca.
    refoto_h: z.number().int().min(0).max(168).optional(),
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
  if (d.envio_min !== undefined) { campos.push('creative_envio_min = ?'); valores.push(d.envio_min); }
  if (d.refoto_h !== undefined) { campos.push('creative_refoto_h = ?'); valores.push(d.refoto_h); }

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
