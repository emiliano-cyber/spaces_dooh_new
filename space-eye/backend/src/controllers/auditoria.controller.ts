// backend/src/controllers/auditoria.controller.ts
//
// LA BITACORA: cuantas veces salio cada creativo, a que hora, y el cierre del
// dia que convierte eso en un comprobante.
//
// POR QUE ESTA APARTE DE creativos.controller
// -------------------------------------------
// Aquel contesta «que anuncios rota esta pantalla» y su cliente es el equipo,
// que pregunta cada pocos minutos. Este contesta «que salio, cuando y cuanto»
// y su cliente es quien audita, que pregunta una vez al mes por un periodo
// entero. Son dos vidas distintas -una escribe gota a gota, la otra lee en
// bloque- y mezclarlas en un archivo de mil lineas es lo que habia que
// desenredar para poder escribir esto.
//
// LA REGLA QUE MANDA EN TODO EL ARCHIVO
// -------------------------------------
// NINGUN NUMERO SALE DE AQUI SIN SU DENOMINADOR. Una camara mide por muestreo:
// puede decir en cuantas de SUS MIRADAS estaba el anuncio, nunca cuantas veces
// lo saco el reproductor. «312 pasadas» es indefendible; «312 de 1 840
// miradas, de 6:00 a 23:00, medido por vistazo» se defiende. Por eso cada
// consulta de este archivo devuelve `vistazos`, `medida` y la ventana, y por
// eso aqui no existe la palabra «reproducciones».
import { Request, Response } from 'express';
import { pool } from '../config/database';
import { equipoAjeno } from '../utils/dueno';
import { z } from 'zod';

const HUELLA = /^[0-9a-f]{64}$/i;
const RELOJ = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

// --- Lo que manda el equipo -------------------------------------------------
//
// Compatible hacia atras A PROPOSITO. La APK de los telefonos ya esta en la
// calle y va a seguir mandando solo `vistas`/`nuevas`: esos equipos conservan
// la resolucion de vuelta que ya tenian y no se caen. Los que si se pueden
// actualizar a distancia -Raspberry y PC- anaden `vistazos`, `horas` y
// `pasadas`, y son los que dan la hora.
export const pasadasSchema = z.object({
  // Dia LOCAL de la pantalla. Lo manda el equipo porque `devices` no tiene
  // zona horaria y el servidor no puede saberlo: un anunciante compra las 8 de
  // la manana DONDE ESTA EL ANUNCIO.
  dia: z.string().regex(DIA).optional(),
  // Miradas de esta vuelta, en total y repartidas por hora.
  vistazos: z.number().int().min(0).max(100000).optional(),
  horas: z.array(z.object({
    hora: z.number().int().min(0).max(23),
    vistazos: z.number().int().min(0).max(100000),
  })).max(24).optional(),
  // El detalle: este creativo, en esta hora, tantas veces.
  pasadas: z.array(z.object({
    h: z.string().regex(HUELLA),
    hora: z.number().int().min(0).max(23),
    n: z.number().int().min(1).max(100000),
    desde: z.string().regex(RELOJ).optional(),
    hasta: z.string().regex(RELOJ).optional(),
  })).max(2000).optional(),
});

// El resumen de fin de dia. No trae detalle -ese ya fue llegando vuelta a
// vuelta-: trae el TOTAL del equipo, que sirve de suma de comprobacion. Si no
// cuadra con lo que el servidor fue guardando, la diferencia son reportes que
// se perdieron, y eso se guarda en vez de taparse.
export const cierreSchema = z.object({
  dia: z.string().regex(DIA),
  vistazos: z.number().int().min(0).max(10000000),
  vueltas: z.number().int().min(0).max(100000).optional(),
  primera: z.string().regex(RELOJ).optional(),
  ultima: z.string().regex(RELOJ).optional(),
});

export type Pasadas = z.infer<typeof pasadasSchema>;
export type Cierre = z.infer<typeof cierreSchema>;

/** El dia del equipo segun el equipo; null si no lo mando y hay que suponerlo. */
function diaDe(p: { dia?: string } | null | undefined): string | null {
  return p?.dia && DIA.test(p.dia) ? p.dia : null;
}

function sumaDeHoras(p?: Pasadas | null): number {
  return (p?.horas || []).reduce((a, x) => a + x.vistazos, 0);
}

/** La primera y la ultima hora de reloj que trae el detalle de la vuelta. */
function ventana(p?: Pasadas | null): { desde: string | null; hasta: string | null } {
  const t = (p?.pasadas || []).flatMap((x) => [x.desde, x.hasta]).filter(Boolean) as string[];
  if (!t.length) return { desde: null, hasta: null };
  t.sort();
  return { desde: t[0], hasta: t[t.length - 1] };
}

/**
 * Una vuelta, anotada en la bitacora.
 *
 * `vistas` son las huellas DEL CATALOGO que se reconocieron, ya resueltas por
 * parecido en `registrarRecorrido`: aqui llegan limpias. `catalogo` son TODAS
 * las del sitio, porque la fila del dia se crea para todas -la que no salio
 * tambien es un dato, y sin su fila no se puede distinguir «no salio» de «no
 * se midio»-. `p` es el detalle que mandan los equipos que saben contar;
 * cuando no viene, la vuelta se anota igual con vara de vuelta, para que el
 * reporte de la flota tenga UNA sola forma y el telefono no quede fuera de la
 * auditoria por ser viejo.
 */
export async function anotarVuelta(
  deviceId: number,
  vistas: string[],
  catalogo: string[],
  p?: Pasadas | null,
) {
  if (!catalogo.length) return;
  const detalle = !!(p?.pasadas?.length || p?.vistazos || p?.horas?.length);
  const dia = diaDe(p);
  const medida = detalle ? 'vistazo' : 'vuelta';
  const zona = dia ? 'equipo' : 'servidor';
  // Las miradas de la vuelta. Sin detalle, una vuelta cuenta como UNA mirada:
  // es lo unico cierto que se puede decir de un equipo que solo manda el
  // conjunto de lo que vio. Inflarlo adivinando cuantos vistazos hizo seria
  // inventar el denominador, que es justo lo que esta tabla existe para evitar.
  const vistazos = detalle ? (Number(p?.vistazos ?? 0) || sumaDeHoras(p)) : 1;
  const { desde, hasta } = ventana(p);
  const elDia = dia ? '?' : 'CURDATE()';

  // --- La fila del dia de cada creativo (033) -------------------------------
  //
  // Vivia en creativos.controller como `anotarElDia`. Esta aqui porque es
  // auditoria: la escribe el mismo reporte que la bitacora, en la misma
  // transaccion logica, y tenerla a dos archivos de distancia fue lo que hizo
  // que `apariciones` y `pasadas` pudieran contar cosas distintas sin que
  // nadie lo notara.
  //
  // Se crea para TODO el catalogo y no solo para lo que salio: `revisiones` es
  // el denominador de `apariciones`, y un creativo sin fila no se distingue de
  // uno que no se midio.
  await pool.query(
    `INSERT INTO device_creative_dias (device_id, phash, dia, apariciones, revisiones)
     VALUES ${catalogo.map(() => `(?, ?, ${elDia}, 0, 0)`).join(', ')}
     ON DUPLICATE KEY UPDATE revisiones = revisiones + 1`,
    catalogo.flatMap((h) => (dia ? [deviceId, h, dia] : [deviceId, h])));
  // `revisiones` no sube en el INSERT de la fila nueva (empieza en 0 y esta
  // primera vuelta cuenta), asi que se pone a 1 a las recien creadas.
  await pool.query(
    `UPDATE device_creative_dias SET revisiones = 1
      WHERE device_id = ? AND dia = ${elDia} AND revisiones = 0`,
    dia ? [deviceId, dia] : [deviceId]);
  if (vistas.length) {
    await pool.query(
      `UPDATE device_creative_dias SET apariciones = apariciones + 1
        WHERE device_id = ? AND dia = ${elDia} AND phash IN (?)`,
      dia ? [deviceId, dia, vistas] : [deviceId, vistas]);
  }

  // --- La cabecera del dia (036) --------------------------------------------
  // La cabecera del dia. `medida` sube a 'vistazo' en cuanto UNA vuelta trae
  // detalle y ya no baja: un equipo actualizado a media manana midio parte del
  // dia con cada vara, y lo que el reporte tiene que saber es que la buena
  // estuvo presente, no fingir que lo estuvo todo el dia.
  await pool.query(
    `INSERT INTO device_dias (device_id, dia, vistazos, vueltas, primera, ultima, medida, zona)
     VALUES (?, ${elDia}, ?, 1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       vistazos = vistazos + VALUES(vistazos),
       vueltas  = vueltas + 1,
       primera  = LEAST(COALESCE(primera, VALUES(primera)), COALESCE(VALUES(primera), primera)),
       ultima   = GREATEST(COALESCE(ultima, VALUES(ultima)), COALESCE(VALUES(ultima), ultima)),
       medida   = IF(VALUES(medida) = 'vistazo', 'vistazo', medida),
       zona     = IF(VALUES(zona) = 'equipo', 'equipo', zona)`,
    dia
      ? [deviceId, dia, vistazos, desde, hasta, medida, zona]
      : [deviceId, vistazos, desde, hasta, medida, zona]
  );

  // El denominador de cada hora. Va en su propia tabla y no repetido dentro de
  // cada creativo: en una hora con veinte anuncios el numero de miradas es
  // UNO, no veinte copias que se pueden desincronizar.
  const horas = p?.horas?.length ? p.horas : null;
  if (horas) {
    await pool.query(
      `INSERT INTO device_horas (device_id, dia, hora, vistazos)
       VALUES ${horas.map(() => `(?, ${elDia}, ?, ?)`).join(', ')}
       ON DUPLICATE KEY UPDATE vistazos = vistazos + VALUES(vistazos)`,
      horas.flatMap((x) => (dia ? [deviceId, dia, x.hora, x.vistazos] : [deviceId, x.hora, x.vistazos]))
    );
  }

  // La bitacora: el creativo en esa hora. Solo las huellas que el catalogo
  // reconoce; una que no esta en `vistas` es una que `registrarRecorrido` no
  // pudo casar, y meterla aqui dejaria bitacora colgando de un creativo que no
  // existe.
  const conocidas = new Set(vistas.map((h) => h.toLowerCase()));
  const pasadas = (p?.pasadas || []).filter((x) => conocidas.has(x.h.toLowerCase()));
  if (pasadas.length) {
    await pool.query(
      `INSERT INTO device_creative_horas (device_id, phash, dia, hora, pasadas, primera, ultima)
       VALUES ${pasadas.map(() => `(?, ?, ${elDia}, ?, ?, ?, ?)`).join(', ')}
       ON DUPLICATE KEY UPDATE
         pasadas = pasadas + VALUES(pasadas),
         primera = LEAST(COALESCE(primera, VALUES(primera)), COALESCE(VALUES(primera), primera)),
         ultima  = GREATEST(COALESCE(ultima, VALUES(ultima)), COALESCE(VALUES(ultima), ultima))`,
      pasadas.flatMap((x) => {
        const resto = [x.hora, x.n, x.desde ?? null, x.hasta ?? null];
        return dia
          ? [deviceId, x.h.toLowerCase(), dia, ...resto]
          : [deviceId, x.h.toLowerCase(), ...resto];
      })
    );
    // Y el total del dia de cada creativo. Un creativo puede venir en varias
    // horas de la misma vuelta, asi que se suma antes de escribir.
    const porHuella = new Map<string, number>();
    for (const x of pasadas) {
      const h = x.h.toLowerCase();
      porHuella.set(h, (porHuella.get(h) || 0) + x.n);
    }
    for (const [h, n] of porHuella) {
      await pool.query(
        `UPDATE device_creative_dias SET pasadas = pasadas + ?, medida = 'vistazo'
          WHERE device_id = ? AND dia = ${elDia} AND phash = ?`,
        dia ? [n, deviceId, dia, h] : [n, deviceId, h]
      );
    }
  } else if (vistas.length) {
    // Sin detalle: la vuelta en que salio cuenta como una pasada, que es lo
    // unico cierto. `medida` se queda en 'vuelta' y el reporte lo dice.
    await pool.query(
      `UPDATE device_creative_dias SET pasadas = pasadas + 1
        WHERE device_id = ? AND dia = ${elDia} AND phash IN (?)`,
      dia ? [deviceId, dia, vistas] : [deviceId, vistas]
    );
  }
}

/**
 * El equipo cierra el dia.
 *
 * Hasta que esto llega, el dia esta ABIERTO y cualquier reporte sobre el es
 * provisional. Es la diferencia entre un comprobante y una captura de
 * pantalla: el cierre dice «ya no va a llegar nada mas de este dia» y trae el
 * total del equipo, que se compara con lo que se fue guardando. Lo que falte
 * son reportes perdidos -red caida, equipo reiniciado- y se anotan; un dia con
 * huecos sigue sirviendo, pero hay que poder decir que los tuvo.
 */
export async function cerrarDia(deviceId: number, c: Cierre) {
  const [prev] = await pool.query<any[]>(
    `SELECT vistazos FROM device_dias WHERE device_id = ? AND dia = ?`, [deviceId, c.dia]);
  const guardados = Number((prev as any[])[0]?.vistazos ?? 0);
  // Solo hacia arriba: si al servidor le llego MAS de lo que el equipo dice
  // haber contado, el que perdio su estado fue el equipo (un reinicio le
  // reinicia el contador) y el bueno es el del servidor. Restar ahi seria
  // borrar bitacora que si llego.
  const perdidos = Math.max(0, c.vistazos - guardados);
  await pool.query(
    `INSERT INTO device_dias (device_id, dia, vistazos, vueltas, primera, ultima,
                              medida, zona, perdidos, cerrado_at)
     VALUES (?, ?, ?, ?, ?, ?, 'vistazo', 'equipo', ?, NOW())
     ON DUPLICATE KEY UPDATE
       vistazos   = GREATEST(vistazos, VALUES(vistazos)),
       vueltas    = GREATEST(vueltas, VALUES(vueltas)),
       primera    = LEAST(COALESCE(primera, VALUES(primera)), COALESCE(VALUES(primera), primera)),
       ultima     = GREATEST(COALESCE(ultima, VALUES(ultima)), COALESCE(VALUES(ultima), ultima)),
       medida     = 'vistazo',
       zona       = 'equipo',
       perdidos   = VALUES(perdidos),
       cerrado_at = NOW()`,
    [deviceId, c.dia, c.vistazos, c.vueltas ?? 0, c.primera ?? null, c.ultima ?? null, perdidos]
  );
  return { perdidos, guardados };
}

// ============================================================================
// LA LECTURA: el reporte
// ============================================================================
//
// Quien audita pregunta por un PERIODO, no por un instante, y pregunta una vez
// al mes. Por eso estas consultas agregan en la base y no en Node: un mes de
// una pantalla en continuo son decenas de miles de filas de bitacora, y
// traerlas para sumarlas aqui seria pagar memoria por nada.

/**
 * Un DATE de MySQL, como texto, sin que se le mueva el dia.
 *
 * El pool va con `dateStrings: false` y `timezone: 'Z'`, asi que un DATE llega
 * como Date a medianoche UTC. Mandarlo tal cual es mandar
 * «2026-11-25T00:00:00.000Z», que en un navegador al oeste de Greenwich se
 * pinta como el 24. En una auditoria eso no es un detalle de formato: es una
 * fila de comprobantes atribuida al dia que no fue. Mismo arreglo que ya hace
 * creativos.controller con la tira de dias.
 */
function soloElDia(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v instanceof Date ? v : new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Un periodo sano: como mucho un trimestre, y `hasta` nunca antes que `desde`. */
function periodo(req: Request): { desde: string; hasta: string } {
  const hoy = new Date().toISOString().slice(0, 10);
  const dato = (k: string) => {
    const v = String(req.query[k] ?? '');
    return DIA.test(v) ? v : null;
  };
  const hasta = dato('hasta') || hoy;
  const pordefecto = new Date(Date.parse(hasta) - 29 * 86400000).toISOString().slice(0, 10);
  let desde = dato('desde') || pordefecto;
  if (desde > hasta) desde = hasta;
  // Un trimestre es el periodo mas largo que alguien factura de una vez; mas
  // que eso es una descarga, no una pantalla, y se pide por partes.
  const tope = new Date(Date.parse(hasta) - 91 * 86400000).toISOString().slice(0, 10);
  if (desde < tope) desde = tope;
  return { desde, hasta };
}

/**
 * La auditoria de una pantalla en un periodo.
 *
 * Por creativo: en cuantas miradas salio (`pasadas`), en cuantas vueltas
 * (`apariciones`) y los dos denominadores. Y aparte los dias, cada uno con su
 * total, su ventana y si esta CERRADO.
 *
 * `medida` y `zona` viajan en la cabecera porque sin ellas los numeros no se
 * pueden leer: `vuelta` significa que el equipo solo pudo decir en que
 * recorridos estaba, y `servidor` que la hora es la del servidor y no la de la
 * pantalla. Un reporte que omita eso afirma mas de lo que midio.
 */
export async function deEquipo(req: Request, res: Response) {
  const did = Number(req.params.id);
  if (!did || (await equipoAjeno(req, did))) return res.status(404).json({ error: 'not_found' });
  const { desde, hasta } = periodo(req);

  const [dias] = await pool.query<any[]>(
    `SELECT dia, vistazos, vueltas, primera, ultima, medida, zona, perdidos,
            cerrado_at IS NOT NULL AS cerrado
       FROM device_dias
      WHERE device_id = ? AND dia BETWEEN ? AND ?
      ORDER BY dia DESC`, [did, desde, hasta]);

  const [creativos] = await pool.query<any[]>(
    `SELECT d.phash,
            SUM(d.pasadas)     AS pasadas,
            SUM(d.apariciones) AS apariciones,
            SUM(d.revisiones)  AS revisiones,
            COUNT(*)           AS dias,
            MIN(d.dia)         AS primer_dia,
            MAX(d.dia)         AS ultimo_dia,
            -- Un creativo medido por vuelta un dia y por vistazo otro es un
            -- creativo con dos varas, y eso hay que decirlo por creativo y no
            -- solo por equipo.
            MAX(d.medida = 'vistazo') AS tuvo_vistazo,
            MIN(d.medida = 'vistazo') AS siempre_vistazo,
            c.nombre, c.descartado, c.campaign_id, c.campana_bits,
            k.name AS campana_nombre, k.advertiser AS campana_anunciante
       FROM device_creative_dias d
       JOIN device_creatives c ON c.device_id = d.device_id AND c.phash = d.phash
       LEFT JOIN campaigns k ON k.id = c.campaign_id
      WHERE d.device_id = ? AND d.dia BETWEEN ? AND ?
      GROUP BY d.phash
      ORDER BY pasadas DESC, apariciones DESC`, [did, desde, hasta]);

  // El reparto por hora de todo el periodo. Se pide de una vez y se reparte
  // aqui, para no hacer una consulta por creativo.
  const [horas] = await pool.query<any[]>(
    `SELECT phash, hora, SUM(pasadas) AS pasadas, MIN(primera) AS primera, MAX(ultima) AS ultima
       FROM device_creative_horas
      WHERE device_id = ? AND dia BETWEEN ? AND ?
      GROUP BY phash, hora`, [did, desde, hasta]);
  const [denominador] = await pool.query<any[]>(
    `SELECT hora, SUM(vistazos) AS vistazos FROM device_horas
      WHERE device_id = ? AND dia BETWEEN ? AND ? GROUP BY hora`, [did, desde, hasta]);

  const porHuella = new Map<string, any[]>();
  for (const h of horas as any[]) {
    if (!porHuella.has(h.phash)) porHuella.set(h.phash, []);
    porHuella.get(h.phash)!.push({
      hora: Number(h.hora), pasadas: Number(h.pasadas), primera: h.primera, ultima: h.ultima,
    });
  }

  const d = dias as any[];
  res.json({
    desde,
    hasta,
    // La cabecera que hace legibles todos los numeros de abajo.
    vistazos: d.reduce((a, x) => a + Number(x.vistazos), 0),
    vueltas: d.reduce((a, x) => a + Number(x.vueltas), 0),
    perdidos: d.reduce((a, x) => a + Number(x.perdidos), 0),
    dias_medidos: d.length,
    dias_cerrados: d.filter((x) => Number(x.cerrado)).length,
    // La vara del periodo es la PEOR de sus dias: si un solo dia se midio por
    // vuelta, el total esta medido por vuelta. Decir 'vistazo' porque la
    // mayoria lo fue seria redondear hacia arriba la calidad del dato, que es
    // justo lo que no puede hacer una auditoria.
    medida: d.length && d.every((x) => x.medida === 'vistazo') ? 'vistazo' : 'vuelta',
    zona: d.length && d.every((x) => x.zona === 'equipo') ? 'equipo' : 'servidor',
    dias: d.map((x) => ({
      dia: soloElDia(x.dia), vistazos: Number(x.vistazos), vueltas: Number(x.vueltas),
      primera: x.primera, ultima: x.ultima, medida: x.medida, zona: x.zona,
      perdidos: Number(x.perdidos), cerrado: !!Number(x.cerrado),
    })),
    horas_vistazos: Object.fromEntries(
      (denominador as any[]).map((x) => [Number(x.hora), Number(x.vistazos)])),
    creativos: (creativos as any[]).map((c) => ({
      phash: c.phash,
      nombre: c.nombre,
      descartado: !!c.descartado,
      campaign_id: c.campaign_id,
      campana_nombre: c.campana_nombre,
      campana_anunciante: c.campana_anunciante,
      campana_bits: c.campana_bits,
      pasadas: Number(c.pasadas),
      apariciones: Number(c.apariciones),
      revisiones: Number(c.revisiones),
      dias: Number(c.dias),
      primer_dia: soloElDia(c.primer_dia),
      ultimo_dia: soloElDia(c.ultimo_dia),
      medida: Number(c.siempre_vistazo) ? 'vistazo' : 'vuelta',
      mezclada: !!Number(c.tuvo_vistazo) && !Number(c.siempre_vistazo),
      horas: porHuella.get(c.phash) || [],
    })),
  });
}

/**
 * La auditoria de una CAMPANA: lo mismo, cruzando sus pantallas.
 *
 * Es el reporte que se le manda al anunciante. Un creativo cuenta para la
 * campana si su arte caso con el de ella (035), asi que esto incluye las
 * pantallas donde el anuncio salio por programatica y nadie lo habia
 * relacionado con la campana a mano.
 */
export async function deCampana(req: Request, res: Response) {
  const kid = Number(req.params.id);
  if (!kid) return res.status(404).json({ error: 'not_found' });
  const { desde, hasta } = periodo(req);

  const [filas] = await pool.query<any[]>(
    `SELECT d.device_id, v.name AS equipo,
            SUM(d.pasadas)     AS pasadas,
            SUM(d.apariciones) AS apariciones,
            SUM(d.revisiones)  AS revisiones,
            COUNT(DISTINCT d.dia) AS dias,
            MIN(d.dia) AS primer_dia, MAX(d.dia) AS ultimo_dia,
            MIN(d.medida = 'vistazo') AS siempre_vistazo
       FROM device_creative_dias d
       JOIN device_creatives c ON c.device_id = d.device_id AND c.phash = d.phash
       JOIN devices v ON v.id = d.device_id
      WHERE c.campaign_id = ? AND d.dia BETWEEN ? AND ?
      GROUP BY d.device_id, v.name
      ORDER BY pasadas DESC`, [kid, desde, hasta]);

  const [porDia] = await pool.query<any[]>(
    `SELECT d.dia, SUM(d.pasadas) AS pasadas, COUNT(DISTINCT d.device_id) AS pantallas
       FROM device_creative_dias d
       JOIN device_creatives c ON c.device_id = d.device_id AND c.phash = d.phash
      WHERE c.campaign_id = ? AND d.dia BETWEEN ? AND ?
      GROUP BY d.dia ORDER BY d.dia`, [kid, desde, hasta]);

  const [porHora] = await pool.query<any[]>(
    `SELECT h.hora, SUM(h.pasadas) AS pasadas
       FROM device_creative_horas h
       JOIN device_creatives c ON c.device_id = h.device_id AND c.phash = h.phash
      WHERE c.campaign_id = ? AND h.dia BETWEEN ? AND ?
      GROUP BY h.hora ORDER BY h.hora`, [kid, desde, hasta]);

  // El denominador: las miradas de ESAS pantallas en ESOS dias. Sin el, el
  // total de la campana es un numero suelto.
  const equipos = (filas as any[]).map((f) => f.device_id);
  const [den] = equipos.length
    ? await pool.query<any[]>(
        `SELECT SUM(vistazos) AS vistazos, SUM(perdidos) AS perdidos,
                SUM(cerrado_at IS NOT NULL) AS cerrados, COUNT(*) AS medidos
           FROM device_dias WHERE device_id IN (?) AND dia BETWEEN ? AND ?`,
        [equipos, desde, hasta])
    : [[{}] as any[]];

  const r = (den as any[])[0] || {};
  res.json({
    desde,
    hasta,
    vistazos: Number(r.vistazos || 0),
    perdidos: Number(r.perdidos || 0),
    dias_medidos: Number(r.medidos || 0),
    dias_cerrados: Number(r.cerrados || 0),
    pasadas: (filas as any[]).reduce((a, x) => a + Number(x.pasadas), 0),
    pantallas: (filas as any[]).length,
    medida: (filas as any[]).length && (filas as any[]).every((x) => Number(x.siempre_vistazo))
      ? 'vistazo' : 'vuelta',
    equipos: (filas as any[]).map((x) => ({
      device_id: x.device_id, equipo: x.equipo,
      pasadas: Number(x.pasadas), apariciones: Number(x.apariciones),
      revisiones: Number(x.revisiones), dias: Number(x.dias),
      primer_dia: soloElDia(x.primer_dia), ultimo_dia: soloElDia(x.ultimo_dia),
      medida: Number(x.siempre_vistazo) ? 'vistazo' : 'vuelta',
    })),
    por_dia: (porDia as any[]).map((x) => ({
      dia: soloElDia(x.dia), pasadas: Number(x.pasadas), pantallas: Number(x.pantallas),
    })),
    por_hora: (porHora as any[]).map((x) => ({ hora: Number(x.hora), pasadas: Number(x.pasadas) })),
  });
}
