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
import { leerStored } from '../services/photoStorage.service';
import {
  enderezarPantalla, medirPantalla, bloquesDe, parecidoPorBloques, type Medida, type Gris, type Punto,
} from '../utils/enderezar';
import { calcular } from '../utils/huella';
import { equipoAjeno } from '../utils/dueno';
import { z } from 'zod';
import { firmarFilas } from '../utils/firmaArchivos';
import { encuadreDe } from './dashboard.controller';
import { ordenarEquipo } from '../utils/espejo';

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
            creative_fotos_dia,
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
    fotos_dia: d.creative_fotos_dia,
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
// --- La auditoria por DIA (migracion 033) -----------------------------------
//
// El equipo reporta en cada vuelta las huellas que reconocio. Ese dato se
// estaba sumando a un contador de por vida, que no sirve para auditar: no dice
// si el anuncio estuvo en rotacion AYER. Aqui se guarda por dia, y con su
// denominador.
//
// `revisiones` sube una vez por vuelta para TODOS los creativos que el catalogo
// tiene ese dia, no solo para los vistos: el denominador de «salio en 37 de 96»
// tiene que ser el mismo para los dos anuncios que se comparan, o la cuenta
// miente a favor del que se vio mas.
async function anotarElDia(deviceId: number, vistos: string[], catalogo: string[]) {
  if (!catalogo.length) return;
  // Una sola sentencia para los dos contadores: la fila del dia se crea sola la
  // primera vez que ese creativo aparece en el reporte.
  const filas = catalogo.map(() => '(?, ?, CURDATE(), 0, 0)').join(', ');
  await pool.query(
    `INSERT INTO device_creative_dias (device_id, phash, dia, apariciones, revisiones)
     VALUES ${filas}
     ON DUPLICATE KEY UPDATE revisiones = revisiones + 1`,
    catalogo.flatMap((h) => [deviceId, h]));
  // `revisiones` no sube en el INSERT de la fila nueva (empieza en 0 y la
  // primera vuelta cuenta), asi que se pone a 1 a las recien creadas.
  await pool.query(
    `UPDATE device_creative_dias SET revisiones = 1
      WHERE device_id = ? AND dia = CURDATE() AND revisiones = 0`, [deviceId]);
  if (!vistos.length) return;
  await pool.query(
    `UPDATE device_creative_dias SET apariciones = apariciones + 1
      WHERE device_id = ? AND dia = CURDATE() AND phash IN (?)`, [deviceId, vistos]);
}

/**
 * Cuantas fotos de auditoria diaria lleva PEDIDAS hoy este equipo.
 *
 * Se cuentan las ORDENES y no las fotos que llegaron, y la diferencia importa:
 * entre que se pide una y llega pasan segundos, pero si se contaran las
 * llegadas, un equipo lento o apagado dejaria el contador en cero y el servidor
 * seguiria pidiendo fotos que nadie va a tomar. El tope es de gasto, y el gasto
 * se compromete al pedirla.
 */
async function refotosDeHoy(deviceId: number): Promise<number> {
  const [f] = await pool.query<any[]>(
    `SELECT COUNT(*) n FROM commands
      WHERE device_id = ? AND command_type = 'TAKE_PHOTO' AND created_at >= CURDATE()
        AND JSON_EXTRACT(payload, '$.motivo') = 'refoto'`, [deviceId]);
  return Number((f as any[])[0]?.n || 0);
}

/**
 * La foto del dia: si un creativo que ACABA de verse no tiene la de hoy, se le
 * pide una al equipo en este momento.
 *
 * Por que ahora y no por horario: el servidor sabe que ese anuncio esta en
 * pantalla AHORA mismo, porque el equipo acaba de reportarlo. Pedida en
 * cualquier otro momento, la foto saldria del anuncio que tocara.
 *
 * No acierta siempre -el bucle avanza mientras la orden viaja-, y no hace
 * falta: la foto que llegue se identifica por su huella y se le cuelga al
 * creativo que de verdad salga en ella (`refrescarConFoto`). Con el bucle
 * girando, en un dia se cubre la rotacion entera.
 *
 * UNA sola orden por reporte, y con tope diario: cada foto son datos moviles
 * del equipo.
 */
async function pedirFotoDelDia(deviceId: number, vistos: string[], topeDia: number) {
  if (!vistos.length || topeDia <= 0) return;
  if ((await refotosDeHoy(deviceId)) >= topeDia) return;
  const [faltan] = await pool.query<any[]>(
    `SELECT c.phash FROM device_creatives c
       LEFT JOIN device_creative_dias d
              ON d.device_id = c.device_id AND d.phash = c.phash AND d.dia = CURDATE()
      WHERE c.device_id = ? AND c.phash IN (?) AND d.photo_id IS NULL
      LIMIT 1`, [deviceId, vistos]);
  if (!(faltan as any[]).length) return;
  await ordenarEquipo(deviceId, 'TAKE_PHOTO', { ...(await encuadreDe(deviceId)), motivo: 'refoto' });
}

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

  // A los creativos que no tienen foto se les busca una entre las que el equipo
  // ya subio y nadie llego a usar. No cuesta datos -esas fotos estan guardadas y
  // pagadas- y es lo unico que puede darle cara a un creativo que el equipo ya
  // no va a volver a fotografiar, porque su ORB lo reconoce sin dudar.
  //
  // Va AQUI y no al final a proposito: abajo hay un `return` para los recorridos
  // sin creativos nuevos, y esos son casi todos -TLALPAN reporta "0 nuevos" en
  // practicamente cada vuelta-. Puesto despues, el sitio que mas lo necesita
  // seria justo el que nunca lo ejecutaria.
  await adoptarHuerfanas(deviceId, tolerancia).catch(() => null);

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

  // La cuenta del dia, y la foto del dia. Ninguna de las dos puede tumbar el
  // reporte del equipo: es lo que trae tambien la salud de la pantalla.
  await anotarElDia(deviceId, [...refrescar], catalogo).catch((err) =>
    console.error('[creativos] no se pudo anotar el dia:', err?.message));
  await pedirFotoDelDia(deviceId, [...refrescar], Number(cfg?.fotos_dia ?? 6)).catch((err) =>
    console.error('[creativos] no se pudo pedir la foto del dia:', err?.message));

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
    // De quien es, si su arte esta registrado como campana (035). Va aqui y no
    // donde llega la foto porque la huella basta: un creativo que nunca
    // consiguio foto -los del aprendizaje- tambien queda identificado.
    await identificarYGuardar(deviceId, h);
    catalogo.push(h);
  }
}

/** Un creativo del catalogo que todavia no tiene imagen que ensenar. */
export type SinFoto = { phash: string };
/** Una foto que llego con su huella y que ningun creativo esta usando. */
export type Huerfana = { id: number; phash: string; taken_at: string | null };
/** A que creativo le toca cada foto rescatada. */
export type Adopcion = { phash: string; primera: number; ultima: number | null };

/**
 * Reparte las fotos sueltas entre los creativos que no tienen ninguna.
 *
 * Pura y exportada a proposito: es la parte que puede equivocarse en silencio.
 * Colgarle a un creativo la foto de OTRO anuncio seria peor que dejarlo sin
 * foto -el dashboard ensenaria como evidencia algo que nunca estuvo en esa
 * pantalla-, asi que cada creativo se queda con la foto MAS PARECIDA, no con la
 * primera que pase la tolerancia, y ninguna foto se usa dos veces.
 *
 * De las que le tocan a un creativo, la mas vieja es `primera` (la evidencia
 * del hallazgo, que es lo que la tarjeta ensena como "aparecio") y la mas nueva
 * es `ultima`, que es justo el par que la 029 sabe pintar.
 */
export function casarHuerfanas(
  creativos: SinFoto[], fotos: Huerfana[], tolerancia: number
): Adopcion[] {
  const libres = [...fotos];
  const salida: Adopcion[] = [];
  for (const c of creativos) {
    const suyas = libres
      .map((f) => ({ f, bits: distancia(c.phash, f.phash) }))
      .filter((x) => x.bits <= tolerancia);
    if (!suyas.length) continue;
    // La mas parecida manda; a igualdad de bits, la mas antigua.
    const mejor = suyas.reduce((m, x) => (x.bits < m.bits ? x : m), suyas[0]).bits;
    const delCreativo = suyas.filter((x) => x.bits === mejor).map((x) => x.f);
    const orden = [...delCreativo].sort((a, b) => String(a.taken_at ?? '').localeCompare(String(b.taken_at ?? '')));
    const primera = orden[0];
    const ultima = orden.length > 1 ? orden[orden.length - 1] : null;
    salida.push({ phash: c.phash, primera: primera.id, ultima: ultima ? ultima.id : null });
    for (const f of orden) {
      const i = libres.indexOf(f);
      if (i >= 0) libres.splice(i, 1);
    }
  }
  return salida;
}

/**
 * Le busca foto a los creativos del sitio que no tienen ninguna, entre las que
 * ya estan guardadas sin que nadie las use.
 *
 * Las dos cosas se llenan por caminos distintos -la huella viaja siempre, la
 * foto solo cuando el equipo puede tomarla- y hay tres formas de que una foto
 * quede sin dueno: el creativo se registro mientras el equipo aprendia (y el
 * aprendizaje no fotografia), la foto llego de una huella que el servidor ya
 * conocia y se descarto al ligarla, o alguien volvio a marcar la pantalla y el
 * catalogo se borro con `DELETE FROM device_creatives` (configurarPantalla),
 * que suelta todas sus fotos de golpe. En g500, el 29-oct-2026, eran 71 de 130.
 */
export async function adoptarHuerfanas(deviceId: number, tolerancia: number): Promise<number> {
  const [pendientes] = await pool.query<any[]>(
    `SELECT phash FROM device_creatives
      WHERE device_id = ? AND photo_id IS NULL AND descartado = 0`,
    [deviceId]
  );
  if (!(pendientes as any[]).length) return 0;

  // Sueltas: ni como foto del hallazgo ni como la de hoy. El tope es para que
  // un sitio con años de fotos no se traiga la galeria entera a memoria.
  const [sueltas] = await pool.query<any[]>(
    `SELECT p.id, p.phash, p.taken_at
       FROM photos p
       LEFT JOIN device_creatives c1 ON c1.photo_id = p.id
       LEFT JOIN device_creatives c2 ON c2.photo_id_ultima = p.id
      WHERE p.device_id = ? AND p.source = 'creative_change' AND p.phash IS NOT NULL
        AND c1.photo_id IS NULL AND c2.photo_id_ultima IS NULL
      ORDER BY p.taken_at DESC
      LIMIT 500`,
    [deviceId]
  );
  if (!(sueltas as any[]).length) return 0;

  const adopciones = casarHuerfanas(
    (pendientes as any[]).map((f) => ({ phash: String(f.phash) })),
    (sueltas as any[]).map((f) => ({ id: Number(f.id), phash: String(f.phash), taken_at: f.taken_at })),
    tolerancia
  );

  for (const a of adopciones) {
    await pool.query(
      `UPDATE device_creatives
          SET photo_id = ?, photo_id_ultima = ?, sin_foto = NULL
        WHERE device_id = ? AND phash = ? AND photo_id IS NULL`,
      [a.primera, a.ultima, deviceId, a.phash]
    ).catch(() => null);
  }
  if (adopciones.length) {
    await pool.query(
      `INSERT INTO device_logs (device_id, level, category, message) VALUES (?, 'info', 'creative', ?)`,
      [deviceId, `${adopciones.length} creativo(s) sin foto recuperaron la suya de entre las ya subidas`]
    ).catch(() => null);
  }
  return adopciones.length;
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

/**
 * Aprovecha una foto CUALQUIERA del sitio para poner al dia el catalogo.
 *
 * EL PROBLEMA QUE RESUELVE. Desde la 029 la ficha de un creativo puede ensenar
 * dos fotos: como aparecio y como se ve ahora. La segunda no llega nunca. La
 * unica foto que un equipo manda de un creativo es la del hallazgo: al que ya
 * conoce no lo vuelve a fotografiar, y `creative_refoto_h` no lo implementa
 * ningun agente -ni la APK ni el pi-agent-. Medido en g500 el 9-nov-2026: 323
 * creativos, 55 con su primera foto, CERO con la de ahora.
 *
 * POR QUE AQUI Y NO EN EL EQUIPO. Arreglarlo alla significa publicar una APK, y
 * las que hay estan en la calle. Pero el sitio YA toma fotos por horario, y en
 * ellas sale la misma pantalla: el servidor las endereza, les saca la huella y
 * reconoce el anuncio sin pedir un byte mas de datos moviles. La huella del
 * servidor casa con la del equipo casi bit a bit (npm run prueba:enderezar:
 * mediana de 2 bits sobre fotos reales, 24 de tolerancia).
 *
 * LO QUE NO HACE: dar de alta un creativo. Solo refresca los que el equipo ya
 * descubrio. Un creativo nuevo lo decide el equipo, con su catalogo y su tope
 * diario; si el servidor diera de alta por esta via, una foto por horario
 * tomada a mitad de una transicion entraria al catalogo como un anuncio que no
 * existe, y de paso se saltaria el tope.
 *
 * Devuelve la huella del creativo refrescado, o null si no habia nada que hacer.
 */
/** La pantalla de ese equipo, de frente y en gris, lista para medirla. */
export async function enderezarDeEquipo(deviceId: number, jpeg: Buffer): Promise<Gris | null> {
  const [filas] = await pool.query<any[]>(
    `SELECT pantalla, stream_rotation FROM devices WHERE id = ?`, [deviceId]);
  const d = (filas as any[])[0];
  if (!d?.pantalla) return null;
  let esquinas: [number, number][] | undefined;
  try {
    const pantalla = typeof d.pantalla === 'string' ? JSON.parse(d.pantalla) : d.pantalla;
    esquinas = pantalla?.esquinas;
  } catch { return null; }
  if (!Array.isArray(esquinas) || esquinas.length !== 4) return null;
  return enderezarPantalla(jpeg, esquinas, Number(d.stream_rotation) || 0);
}

export async function medirPantallaEnFoto(
  deviceId: number,
  jpeg: Buffer,
): Promise<(Medida & { phash: string | null; gris: Gris }) | null> {
  const gris = await enderezarDeEquipo(deviceId, jpeg);
  if (!gris) return null;
  // Sin huella no hay creativo: lente tapada o noche cerrada. Es la misma regla
  // con la que el equipo decide no gastar una foto.
  //
  // La foto enderezada SALE con la medida para que nadie tenga que volver a
  // enderezarla: es lo caro de este camino y da siempre lo mismo.
  return { ...medirPantalla(gris), phash: calcular(gris.datos, gris.ancho, gris.alto), gris };
}

export async function reconocerEnFoto(
  deviceId: number,
  jpeg: Buffer,
): Promise<{ conocida: Conocida; refoto_h: number } | null> {
  const cfg = await configDe(deviceId);
  if (!cfg?.vigilar) return null;

  const m = await medirPantallaEnFoto(deviceId, jpeg);
  if (!m?.phash || m.apagada) return null;

  const conocida = await yaConocida(deviceId, m.phash);
  if (!conocida) return null;
  return { conocida, refoto_h: cfg.refoto_h };
}

/**
 * Lo de arriba, y ademas lo guarda.
 *
 * Devuelve null si la foto NO casa con ningun creativo del catalogo; si casa,
 * devuelve con cual y si ademas se guardo como su foto de «ahora».
 *
 * Las dos cosas por separado y no una sola, porque son dos preguntas y quien
 * llama necesita las dos: «¿esta pantalla se ve como la conocemos?» -que es lo
 * que cierra una obstruccion- y «¿ademas tocaba refrescar su foto?» -que pasa
 * una vez cada `refoto_h` horas-. Devolver solo la segunda dejaba la
 * obstruccion abierta para siempre: casi ninguna foto toca refresco.
 */
/** Lo que resulto ensenar una foto cualquiera del sitio. */
export type Catalogada = {
  /** El creativo del catalogo: el de siempre, o el que se acaba de registrar. */
  phash: string;
  /** No estaba en el catalogo y lo encontro el servidor en ESTA foto. */
  nuevo: boolean;
  /** Ademas quedo como la foto de «ahora» de ese creativo. */
  refrescada: boolean;
};

/**
 * Deja apuntado en la foto QUE creativo salio en ella (migracion 034).
 *
 * Es una linea de SQL y es la que hace posible sacar los comprobantes de una
 * campana sin abrir las fotos una por una. El dato ya se calculaba en cada
 * subida desde la migracion 029 -hay que enderezar la pantalla y sacar la
 * huella para decidir si tocaba refoto- y se tiraba en cuanto se respondia.
 */
async function etiquetarFoto(photoId: number, phash: string) {
  await pool.query(`UPDATE photos SET creativo = ? WHERE id = ?`, [phash, photoId]).catch(() => null);
}

/**
 * La foto de HOY de ese creativo, si todavia no tenia una.
 *
 * `COALESCE` y no `VALUES`: la del dia es la PRIMERA buena del dia y no cambia
 * a lo largo de la tarde. Una fila que se repisa con cada foto hace que el
 * cuadro del dia ensene algo distinto cada vez que alguien lo abre, y que un
 * comprobante que ya se mando deje de corresponder con lo que se ve. El
 * refresco explicito -cada `creative_refoto_h` horas- si la cambia, porque
 * para eso existe.
 *
 * No cuesta datos moviles: la foto ya estaba subida y pagada. Es lo que hace
 * que un creativo tenga su foto de cada dia aunque nadie pida una refoto.
 */
async function fotoDelDiaSiFalta(deviceId: number, phash: string, photoId: number) {
  await pool.query(
    `INSERT INTO device_creative_dias (device_id, phash, dia, photo_id)
     VALUES (?, ?, CURDATE(), ?)
     ON DUPLICATE KEY UPDATE photo_id = COALESCE(photo_id, VALUES(photo_id))`,
    [deviceId, phash, photoId]).catch(() => null);
}

// Freno de emergencia, no una politica.
//
// Un sitio con programatica puede sacar decenas de creativos distintos en un
// dia y TODOS deben contarse: es justo lo que se pidio. Este tope solo existe
// para que una camara movida o una noche con reflejos no metan mil filas de
// basura mientras nadie mira. Si se alcanza se dice en el registro: es una
// senal de que algo esta mal en el sitio, no un limite que ajustar.
const NUEVOS_POR_DIA_TOPE = 100;

/**
 * Un creativo que NO estaba en el catalogo y aparecio en una foto por horario.
 *
 * POR QUE HACE FALTA. El equipo detecta cambios por esquinas (ORB) y eso se le
 * va con la programatica: Hivestack cambia el loop solo, y entre dos anuncios
 * distintos puede no haber esquinas que casar. La foto por horario SI lo
 * retrata, pero hasta ahora nadie la miraba contra el catalogo, asi que ese
 * anuncio no existia para el sistema: no se contaba, no tenia ficha y no
 * aparecia en ningun comprobante. Lo reporto el dueno el 24-nov-2026.
 *
 * No cuesta una sola foto nueva: la que se mira es la que ya llego.
 *
 * Antes de registrarlo se comprueba que lo que cambio este EN la pantalla y no
 * DELANTE. Sin eso, el primer camion que se estacione enfrente entraria al
 * catalogo como un anuncio -que es el bug que se arreglo el 23-nov para las
 * fotos de hallazgo, y seria el mismo bug otra vez por otra puerta-.
 */
async function registrarDeFoto(
  deviceId: number,
  jpeg: Buffer,
  photoId: number,
  phash: string,
  aprendiendo: boolean,
  yaDerecha: Gris,
): Promise<Catalogada | null> {
  const obs = await obstruccionEnFoto(deviceId, jpeg, yaDerecha).catch(() => null);
  if (obs?.obstruido) {
    await pool.query(
      `INSERT INTO device_logs (device_id, level, category, message) VALUES (?, 'warning', 'creative', ?)`,
      // Lo que se sabe y nada mas. Que la pantalla se parezca a un creativo
      // conocido y que su huella NO case admite dos lecturas -algo delante, o
      // el mismo anuncio con otra luz- y el registro no puede elegir una: lo
      // unico seguro es que esto no entra al catalogo como anuncio nuevo.
      [deviceId, `Foto del sitio NO catalogada: el ${Math.round(obs.parecido * 100)}% de la pantalla sigue siendo `
        + `un creativo conocido, pero su huella no casa. Puede ser algo delante de la pantalla, o el mismo `
        + `anuncio con otra luz. No se registra como nuevo.`]
    ).catch(() => null);
    return null;
  }

  const [cuenta] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM device_creatives
      WHERE device_id = ? AND descubierto = 'servidor' AND DATE(primera_vez) = CURDATE()`,
    [deviceId]);
  if (Number((cuenta as any[])[0]?.n ?? 0) >= NUEVOS_POR_DIA_TOPE) {
    await pool.query(
      `INSERT INTO device_logs (device_id, level, category, message) VALUES (?, 'error', 'creative', ?)`,
      [deviceId, `Freno: ${NUEVOS_POR_DIA_TOPE} creativos nuevos encontrados en fotos HOY. Dejo de catalogar `
        + `en este sitio hasta manana; revisa el encuadre de la camara.`]
    ).catch(() => null);
    return null;
  }

  await pool.query(
    `INSERT INTO device_creatives (device_id, phash, photo_id, aprendido, descubierto)
     VALUES (?, ?, ?, ?, 'servidor')
     ON DUPLICATE KEY UPDATE vistas = vistas + 1, ultima_vez = NOW(),
       photo_id = COALESCE(photo_id, VALUES(photo_id)), sin_foto = NULL`,
    [deviceId, phash, photoId, aprendiendo ? 1 : 0]);
  await etiquetarFoto(photoId, phash);
  await fotoDelDiaSiFalta(deviceId, phash, photoId);
  // Y de paso, de quien es: si su arte esta registrado como campana, el
  // anuncio queda identificado sin que nadie teclee nada.
  const dequien = await identificarYGuardar(deviceId, phash);
  await pool.query(
    `INSERT INTO device_logs (device_id, level, category, message) VALUES (?, 'info', 'creative', ?)`,
    [deviceId, 'Creativo nuevo encontrado por el servidor en una foto del sitio (el equipo no lo reporto)'
      + (dequien ? `. Es de la campana «${dequien.nombre}» (${dequien.bits} bits).` : '')]
  ).catch(() => null);
  return { phash, nuevo: true, refrescada: true };
}

/**
 * Mira una foto cualquiera del sitio, dice que creativo ensena y lo guarda.
 *
 * Devuelve null solo si no se puede decir nada: el sitio no vigila, la pantalla
 * se ve apagada, o lo que cambio estaba delante de ella. En cualquier otro caso
 * la foto QUEDA ETIQUETADA con su creativo, que es lo que permite juntar
 * despues todos los comprobantes de una campana.
 *
 * Quien llama necesita las tres respuestas por separado -cual, si es nuevo y si
 * ademas tocaba refoto-, porque son tres preguntas distintas sobre la misma
 * foto. Devolver solo la ultima dejaba las obstrucciones abiertas para siempre:
 * casi ninguna foto toca refresco.
 */
export async function catalogarFoto(
  deviceId: number,
  jpeg: Buffer,
  photoId: number,
): Promise<Catalogada | null> {
  const cfg = await configDe(deviceId);
  if (!cfg?.vigilar) return null;

  const m = await medirPantallaEnFoto(deviceId, jpeg);
  if (!m?.phash || m.apagada) return null;

  const conocida = await yaConocida(deviceId, m.phash);
  if (!conocida) return registrarDeFoto(deviceId, jpeg, photoId, m.phash, cfg.aprendiendo, m.gris);

  // Lo primero, y pase lo que pase despues: esta foto ensena este creativo.
  await etiquetarFoto(photoId, conocida.phash);
  await fotoDelDiaSiFalta(deviceId, conocida.phash, photoId);
  if (!tocaRefoto(conocida, cfg.refoto_h)) return { phash: conocida.phash, nuevo: false, refrescada: false };

  await ligarFoto(deviceId, conocida.phash, photoId);
  // Y la fila de HOY se queda con ella: la de ayer sigue en la fila de ayer,
  // que es lo que hace que se pueda mirar como envejece un anuncio.
  await pool.query(
    `INSERT INTO device_creative_dias (device_id, phash, dia, photo_id)
     VALUES (?, ?, CURDATE(), ?)
     ON DUPLICATE KEY UPDATE photo_id = VALUES(photo_id)`,
    [deviceId, conocida.phash, photoId]).catch(() => null);
  // Y se marca de donde salio. Solo si venia como «a peticion»: una foto por
  // horario sigue siendo por horario aunque de paso sirva para el dia.
  await pool.query(
    `UPDATE photos SET source = 'refoto' WHERE id = ? AND source = 'on_demand'`,
    [photoId]).catch(() => null);
  await pool.query(
    `INSERT INTO device_logs (device_id, level, category, message) VALUES (?, 'info', 'creative', ?)`,
    [deviceId, `Creativo puesto al dia con una foto del sitio (${conocida.bits} bits de diferencia)`]
  ).catch(() => null);
  return { phash: conocida.phash, nuevo: false, refrescada: true };
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
  // Y la foto se queda sabiendo a QUE creativo pertenece (034). Va aqui y no en
  // cada uno de los tres sitios que ligan: ligar una foto a un creativo es
  // exactamente la afirmacion «en esta foto sale este anuncio», y tenerla en un
  // solo lugar es lo que evita que el cuarto sitio que ligue se olvide.
  await etiquetarFoto(photoId, phash.toLowerCase());
}

// ─── De quien es un creativo ────────────────────────────────────────────────
//
// La camara ve la pantalla, no la factura: sabe QUE anuncio esta puesto, no de
// quien es. Pero el dato ya esta en la base -cada campana trae su creatividad
// de referencia y su anunciante- y lo unico que faltaba era comparar.
//
// Se compara con lo que ya hay y sin gastar nada: la creatividad pasa por el
// MISMO normalizador que la pantalla enderezada -320 px de ancho, en gris- y
// de ahi sale la misma huella de 256 bits. Ni un servicio nuevo, ni una llave,
// ni una llamada a internet.

// Una creatividad ya viene de frente: su «pantalla» es la imagen entera.
const IMAGEN_ENTERA: Punto[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

// MEDIDO el 25-nov-2026 contra los creativos de las pantallas DEMO: los que
// eran de una campana casaron a 1-10 bits y el que no era de ninguna salio a
// 85. Esa separacion es la de un caso facil -la foto se hizo del mismo arte-,
// asi que el umbral se queda MUY por debajo de la tolerancia normal (24): en
// campo hay reflejos, angulo y noche, y lo que esta en duda se deja sin
// identificar. Un anunciante equivocado en un comprobante es peor que ninguno.
const IDENTIFICAR_BITS = 20;

// Y tiene que ganar por diferencia. Entre dos artes distintas a 18 y 19 bits no
// se puede elegir, y elegir mal pone a un cliente en el comprobante de otro.
// Dos campanas que comparten el MISMO arte no cuentan como empate: es la misma
// imagen, y da igual cual de las dos se apunte.
const VENTAJA_MINIMA = 6;

// Las huellas de las creatividades, recordadas.
//
// CON CADUCIDAD, al contrario que las zonas de las fotos: una foto guardada no
// cambia nunca, pero una creatividad vive siempre en la misma ruta
// (/storage/creatividades/<id>/referencia.jpg) y se reemplaza cuando el cliente
// manda otro arte. Sin caducidad, el catalogo seguiria casando contra el arte
// viejo hasta que alguien reiniciara el contenedor.
const ARTE_VIGENCIA_MS = 30 * 60_000;
const artesRecordadas = new Map<string, { phash: string | null; en: number }>();

async function huellaDeArte(ruta: string): Promise<string | null> {
  const ya = artesRecordadas.get(ruta);
  if (ya && Date.now() - ya.en < ARTE_VIGENCIA_MS) return ya.phash;
  let phash: string | null = null;
  try {
    const g = await enderezarPantalla(await leerStored(ruta), IMAGEN_ENTERA, 0);
    if (g) phash = calcular(g.datos, g.ancho, g.alto);
  } catch { phash = null; }
  artesRecordadas.set(ruta, { phash, en: Date.now() });
  return phash;
}

export type Identificada = {
  campaign_id: number;
  bits: number;
  nombre: string;
  anunciante: string | null;
};

/**
 * A que campana pertenece este creativo, o null si no se puede afirmar.
 *
 * No hace falta la foto: `phash` es la huella de la pantalla enderezada, que
 * es justo lo que se compara. Por eso un creativo que nunca consiguio foto
 * -los del aprendizaje, los que no se pudieron subir- tambien se identifica.
 */
export async function identificarCreativo(phash: string): Promise<Identificada | null> {
  if (!HUELLA.test(phash || '')) return null;
  const [campanas] = await pool.query<any[]>(
    `SELECT id, name, advertiser, creative_path FROM campaigns
      WHERE creative_path IS NOT NULL
      ORDER BY active DESC, end_date DESC
      LIMIT 300`
  );

  let mejor: (Identificada & { arte: string }) | null = null;
  let segundo: { bits: number; arte: string } | null = null;
  for (const c of campanas as any[]) {
    const h = await huellaDeArte(String(c.creative_path));
    if (!h) continue;
    const bits = distancia(phash.toLowerCase(), h);
    if (!mejor || bits < mejor.bits) {
      if (mejor && mejor.arte !== h) segundo = { bits: mejor.bits, arte: mejor.arte };
      mejor = { campaign_id: Number(c.id), bits, nombre: String(c.name), anunciante: c.advertiser ?? null, arte: h };
    } else if (h !== mejor.arte && (!segundo || bits < segundo.bits)) {
      segundo = { bits, arte: h };
    }
  }

  if (!mejor || mejor.bits > IDENTIFICAR_BITS) return null;
  if (segundo && segundo.bits - mejor.bits < VENTAJA_MINIMA) return null;
  const { arte: _arte, ...sinArte } = mejor;
  return sinArte;
}

/**
 * Lo de arriba, y lo deja apuntado en el catalogo.
 *
 * Nunca pisa el `nombre` que escribio una persona: eso es una correccion, y la
 * maquina no corrige a quien la corrigio. Tampoco tumba nada si falla.
 */
export async function identificarYGuardar(deviceId: number, phash: string) {
  try {
    const id = await identificarCreativo(phash);
    if (!id) return null;
    await pool.query(
      `UPDATE device_creatives SET campaign_id = ?, campana_bits = ?
        WHERE device_id = ? AND phash = ?`,
      [id.campaign_id, Math.min(255, id.bits), deviceId, phash.toLowerCase()]
    );
    return id;
  } catch (err) {
    console.error('[creativos] no se pudo identificar la campana:', (err as any)?.message);
    return null;
  }
}

// --- Dashboard --------------------------------------------------------------

export async function listarDeEquipo(req: Request, res: Response) {
  const did = Number(req.params.id);
  if (await equipoAjeno(req, did)) return res.status(404).json({ error: 'not_found' });

  // Dos LEFT JOIN a `photos`: la del hallazgo y la mas reciente. Las columnas
  // de la segunda van con prefijo `ultima_` para no pisar a las de la primera,
  // que es lo que la ficha ya pintaba.
  // El nombre de la campana se LEE de la campana, no se copia al catalogo: si
  // se copiara, renombrarla dejaria el catalogo diciendo lo de antes (035).
  const [filas] = await pool.query<any[]>(
    `SELECT c.*, p.thumbnail_path, p.storage_path, p.taken_at,
            u.thumbnail_path AS ultima_thumbnail_path,
            u.storage_path  AS ultima_storage_path,
            u.taken_at      AS ultima_taken_at,
            k.name AS campana_nombre, k.advertiser AS campana_anunciante
     FROM device_creatives c
     LEFT JOIN photos p ON p.id = c.photo_id
     LEFT JOIN photos u ON u.id = c.photo_id_ultima
     LEFT JOIN campaigns k ON k.id = c.campaign_id
     WHERE c.device_id = ?
     ORDER BY c.ultima_vez DESC`,
    [did]
  );

  // La auditoria por dia (migracion 033), pegada a cada creativo.
  //
  // Catorce dias y no mas: es lo que cabe en una tira que se lee de un vistazo,
  // y el historial completo de un sitio con cien anuncios serian miles de filas
  // por cada vez que alguien abre la ficha. El dia que haga falta un mes, se
  // pide con un parametro; hoy nadie lo ha pedido.
  const DIAS_A_LA_VISTA = 14;
  const [porDia] = await pool.query<any[]>(
    `SELECT d.phash, d.dia, d.apariciones, d.revisiones,
            p.thumbnail_path, p.storage_path
       FROM device_creative_dias d
       LEFT JOIN photos p ON p.id = d.photo_id
      WHERE d.device_id = ? AND d.dia >= CURDATE() - INTERVAL ? DAY
      ORDER BY d.dia DESC`,
    [did, DIAS_A_LA_VISTA - 1]
  );
  const dias = new Map<string, any[]>();
  for (const f of firmarFilas(porDia as any[])) {
    const lista = dias.get(f.phash) ?? [];
    lista.push({
      dia: typeof f.dia === 'string' ? f.dia.slice(0, 10) : new Date(f.dia).toISOString().slice(0, 10),
      apariciones: Number(f.apariciones) || 0,
      revisiones: Number(f.revisiones) || 0,
      foto: f.storage_path ?? null,
      miniatura: f.thumbnail_path ?? f.storage_path ?? null,
    });
    dias.set(f.phash, lista);
  }

  // Cuantas fotos hay de cada creativo, y entre que fechas.
  //
  // Es el numero que convierte la ficha en comprobantes: «este anuncio tiene 37
  // fotos entre el 2 y el 24» es lo que se le manda a un cliente, y desde ahi
  // se abren todas juntas en la galeria. Solo cuenta las etiquetadas (034), asi
  // que en un sitio recien actualizado empieza en 1 y sube: las de antes no
  // dicen que ensenaban y contarlas seria inventar.
  const [cuentas] = await pool.query<any[]>(
    `SELECT creativo, COUNT(*) AS fotos, MIN(taken_at) AS desde, MAX(taken_at) AS hasta
       FROM photos
      WHERE device_id = ? AND creativo IS NOT NULL
      GROUP BY creativo`,
    [did]
  );
  const porCreativo = new Map<string, any>();
  for (const f of cuentas as any[]) porCreativo.set(String(f.creativo), f);

  // Cuantos creativos nuevos lleva el sitio, y cuantos los encontro el servidor
  // en fotos que ya estaban pagadas (los de la programatica, que el equipo no
  // ve). Las dos cuentas juntas porque la segunda sin la primera no se puede
  // leer: lo que importa es que proporcion del loop esta entrando por ahi.
  const [resumen] = await pool.query<any[]>(
    `SELECT
       SUM(DATE(primera_vez) = CURDATE())                       AS hoy,
       SUM(primera_vez >= CURDATE() - INTERVAL 6 DAY)           AS semana,
       SUM(descubierto = 'servidor')                            AS del_servidor,
       COUNT(*)                                                 AS total
     FROM device_creatives WHERE device_id = ? AND descartado = 0`,
    [did]
  );
  const r = (resumen as any[])[0] ?? {};

  const config = await configDe(did);
  res.json({
    config,
    nuevos: {
      hoy: Number(r.hoy) || 0,
      semana: Number(r.semana) || 0,
      del_servidor: Number(r.del_servidor) || 0,
      total: Number(r.total) || 0,
    },
    fotos_hoy: await fotosDeHoy(did),
    // `dias` viene ordenado del mas reciente al mas viejo, igual que lo pide la
    // consulta: la tira de la ficha se lee de izquierda a derecha empezando por
    // hoy, y reordenarlo en el navegador seria hacer dos veces el mismo trabajo.
    creativos: firmarFilas(filas as any[]).map((c: any) => ({
      ...c,
      dias: dias.get(c.phash) ?? [],
      fotos: Number(porCreativo.get(c.phash)?.fotos) || 0,
      fotos_desde: porCreativo.get(c.phash)?.desde ?? null,
      fotos_hasta: porCreativo.get(c.phash)?.hasta ?? null,
    })),
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

/**
 * Lo que una persona puede cambiarle a un creativo.
 *
 *   descartado  «esto no era un creativo nuevo»: deja de contarlo como hallazgo
 *   nombre      de quien es, para poder nombrar sus comprobantes
 *
 * Los dos en el mismo sitio porque son la misma frase -«lo que decide una
 * persona mirando la tarjeta»- y porque un segundo endpoint para un VARCHAR
 * seria una ruta mas que proteger con el mismo permiso.
 */
export async function editarCreativo(req: Request, res: Response) {
  const schema = z.object({
    descartado: z.boolean().optional(),
    // Vacio BORRA el nombre: es como se quita, y hace falta que se pueda.
    nombre: z.string().trim().max(120).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const campos: string[] = [];
  const valores: any[] = [];
  if (parsed.data.descartado !== undefined) { campos.push('descartado = ?'); valores.push(parsed.data.descartado); }
  if (parsed.data.nombre !== undefined) { campos.push('nombre = ?'); valores.push(parsed.data.nombre || null); }
  if (!campos.length) return res.status(400).json({ error: 'no_fields' });

  await pool.query(
    `UPDATE device_creatives SET ${campos.join(', ')} WHERE id = ?`,
    [...valores, req.params.id]
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

// --- Un camion delante no es un anuncio nuevo --------------------------------
//
// EL SINTOMA. Pasa un trailer por delante del espectacular, o se estaciona
// enfrente, y el equipo avisa «creativo nuevo»: gasta una foto de datos moviles
// y mete en el catalogo del sitio un anuncio que no existe.
//
// POR QUE EL EQUIPO NO PUEDE VERLO. La huella resume la pantalla entera en 64
// bits. Tapar un tercio de la imagen mueve esos bits tanto como cambiar el
// anuncio, y desde un solo numero las dos cosas son iguales. Para distinguirlas
// hay que comparar POR ZONAS contra lo que habia antes, y lo de antes lo tiene
// el servidor -el catalogo del sitio-, no el telefono.
//
// LA REGLA, que es una sola: un anuncio nuevo cambia la pantalla ENTERA; algo
// delante tapa un trozo y deja el resto igual. Asi que si una parte buena de la
// pantalla sigue siendo un creativo que ya conociamos, lo que cambio esta
// DELANTE y no EN la pantalla.
//
// EL UMBRAL ESTA SIN MEDIR CONTRA FOTOS REALES DE CAMIONES, y eso hay que
// decirlo: 0.45 sale de la geometria del caso -un vehiculo tapa entre un cuarto
// y la mitad de la pantalla desde la altura de la camara-, no de un conteo.
// Para medirlo hace falta el catalogo de produccion, donde esas fotos ya estan
// guardadas como «creativos» que se vieron UNA vez y nunca mas. El guion
// `scripts/medir-obstruccion.ts` hace exactamente esa cuenta.
// MEDIDO el 24-nov-2026 en la instancia local, sobre los 9 creativos con foto
// de TLALPAN (36 pares de anuncios DISTINTOS del mismo sitio):
//
//   mediana 0.078 · p90 0.250 · maximo 0.547
//   solo 1 de 36 pares pasa de 0.45
//
// Es decir: dos anuncios distintos en la misma pantalla casi nunca se parecen
// por bloques, y 0.45 los deja fuera. El umbral no estaba medido cuando se
// escribio -salia de la geometria del caso- y desde la 034 decide algo mas
// grave que antes: si un creativo nuevo se registra o se descarta. Con estos
// numeros aguanta ese peso. Conviene repetir la medida en g500, donde las
// pantallas y los encuadres son otros.
const PARECIDO_OBSTRUIDO = 0.45;
// Por encima de esto es la MISMA imagen; eso ya lo caza la huella y no es
// asunto de aqui. Esta cota evita contar como obstruccion una foto que el
// catalogo reconoceria igual.
const PARECIDO_ES_LA_MISMA = 0.95;
// Cuantos creativos del catalogo se comparan. Los mas vistos primero: el que
// estaba en pantalla cuando paso el camion es, casi siempre, uno de ellos.
const CATALOGO_A_COMPARAR = 6;

export type Obstruccion = { obstruido: boolean; parecido: number; phash: string | null };

// Las zonas de las fotos del catalogo, recordadas.
//
// Sin esto, CADA foto de «creativo nuevo» obligaba a enderezar seis fotos
// guardadas -seis deformaciones de perspectiva de un JPEG entero- con el equipo
// esperando la respuesta en una red movil. Y las seis dan siempre lo mismo: una
// foto guardada no cambia nunca.
//
// La llave es la ruta del archivo, que es unica e inmutable. El tope existe
// para que una flota grande no se coma la memoria del contenedor; al llegar se
// vacia entero, que para un acierto de cache es de sobra -no hace falta un LRU
// para algo que se recalcula en milisegundos-.
const ZONAS_TOPE = 500;
const zonasRecordadas = new Map<string, ReturnType<typeof bloquesDe>>();

async function zonasDeFotoGuardada(deviceId: number, ruta: string) {
  const ya = zonasRecordadas.get(ruta);
  if (ya) return ya;
  const antes = await enderezarDeEquipo(deviceId, await leerStored(ruta));
  if (!antes) return null;
  const zonas = bloquesDe(antes);
  if (zonasRecordadas.size >= ZONAS_TOPE) zonasRecordadas.clear();
  zonasRecordadas.set(ruta, zonas);
  return zonas;
}

/**
 * ¿Lo que cambio esta delante de la pantalla? Devuelve null si no se puede
 * decidir (sin pantalla marcada, sin catalogo con fotos, foto ilegible).
 */
export async function obstruccionEnFoto(
  deviceId: number,
  jpeg: Buffer,
  // La foto ya enderezada, si quien llama acaba de hacerlo.
  //
  // Enderezar es deformar la perspectiva de un JPEG entero y es LO CARO de
  // todo esto: medido en la instancia local, segundos por foto. Quien viene de
  // `catalogarFoto` ya la enderezo para sacarle la huella, y volver a hacerlo
  // aqui duplicaba el tiempo de cada subida -con el equipo esperando en una red
  // movil- para llegar exactamente al mismo mapa de bits.
  yaDerecha?: Gris | null,
): Promise<Obstruccion | null> {
  const gris = yaDerecha ?? (await enderezarDeEquipo(deviceId, jpeg));
  if (!gris) return null;
  const ahora = bloquesDe(gris);

  const [filas] = await pool.query<any[]>(
    `SELECT COALESCE(u.storage_path, p.storage_path) AS ruta
       FROM device_creatives c
       LEFT JOIN photos p ON p.id = c.photo_id
       LEFT JOIN photos u ON u.id = c.photo_id_ultima
      WHERE c.device_id = ? AND COALESCE(u.storage_path, p.storage_path) IS NOT NULL
      ORDER BY c.vistas DESC
      LIMIT ?`, [deviceId, CATALOGO_A_COMPARAR]);
  if (!(filas as any[]).length) return null;

  let mejor = 0;
  for (const f of filas as any[]) {
    let zonas: ReturnType<typeof bloquesDe> | null = null;
    try {
      zonas = await zonasDeFotoGuardada(deviceId, String(f.ruta));
    } catch {
      continue; // una foto que ya no esta en disco no invalida la pregunta
    }
    if (!zonas) continue;
    const p = parecidoPorBloques(ahora, zonas);
    if (p > mejor) mejor = p;
  }

  return {
    obstruido: mejor >= PARECIDO_OBSTRUIDO && mejor < PARECIDO_ES_LA_MISMA,
    parecido: mejor,
    phash: calcular(gris.datos, gris.ancho, gris.alto),
  };
}
