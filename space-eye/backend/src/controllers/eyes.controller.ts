// backend/src/controllers/eyes.controller.ts
// Lo que una instancia de SPACE OS pregunta para mantener su espejo al dia.
//
// POR QUE EXISTE
// --------------
// El modulo del menu no puede leer nuestra API en cada pintada: seria un viaje
// al tercero por cada lista, cada filtro y cada historial, y sobre todo la RLS
// de la instancia no puede proteger datos que no estan en su base. Asi que cada
// instancia guarda SU copia, y esto es de donde la saca.
//
// El aviso saliente (SE.4) sera el camino rapido, pero esta repesca hace falta
// igual: un aviso que se pierde no se recupera solo. Si el aviso nunca llega a
// existir, con esto basta -solo que el espejo va con el retraso del cron.
//
// EL ALCANCE NO ES OPCIONAL
// -------------------------
// Se responde con lo del dueno de la llave y nada mas. Una llave sin alcance
// (la del padre) ve la flota entera, que es justo lo que el padre necesita.
import { Request, Response } from 'express';
import { pool } from '../config/database';
import { firmarFilas } from '../utils/firmaArchivos';
import { redis } from '../config/redis';
import { encuadreDe } from './dashboard.controller';
import { ordenarEquipo } from '../utils/espejo';

// Tope de filas por respuesta. Con mas, la instancia vuelve a preguntar desde la
// marca que se le devuelve: es preferible varias vueltas cortas a una respuesta
// de varios megabytes que se corte a la mitad.
const TOPE = 500;

/**
 * GET /api/eyes/cambios?desde=<ISO-8601>
 *
 * Devuelve lo que cambio DESPUES de `desde` y hasta la marca `hasta` que va en
 * la respuesta. La instancia guarda esa marca y la manda en la siguiente vuelta.
 *
 * La marca la pone ESTE servidor, no la instancia: si cada lado usara su propio
 * reloj, un desfase de segundos abriria un hueco por el que se pierden filas sin
 * que nadie lo note. Y se toma ANTES de consultar, de modo que una fila escrita
 * mientras corre la consulta cae en la proxima vuelta en vez de perderse.
 */
export async function cambios(req: Request, res: Response) {
  const owner = req.servicio?.owner ?? null;

  const desde = req.query.desde ? new Date(String(req.query.desde)) : null;
  if (req.query.desde && Number.isNaN(desde?.getTime())) {
    return res.status(400).json({ error: 'desde_invalido', formato: 'ISO-8601, p.ej. 2026-09-18T00:00:00Z' });
  }
  // Sin `desde` se entrega el estado completo: es el primer llenado del espejo.
  const piso = desde ?? new Date(0);

  // El techo va UN SEGUNDO atras del reloj, y esto no es prudencia: es
  // correccion. `updated_at` y `NOW()` tienen precision de SEGUNDOS, asi que una
  // fila escrita en el mismo segundo que la marca quedaria fuera por `> desde`
  // y, como la vuelta siguiente parte de una marca posterior, se perderia PARA
  // SIEMPRE y sin ruido. Dejando el segundo en curso fuera del rango, esa fila
  // entra completa en la proxima vuelta: ni huecos ni repeticiones. Se paga con
  // un segundo de retraso en el espejo.
  const [marcaFilas] = await pool.query<any[]>(`SELECT NOW() - INTERVAL 1 SECOND AS ahora`);
  const hasta: Date = (marcaFilas as any[])[0].ahora;

  const filtroDueno = owner ? ' AND d.owner = ?' : '';
  const parDueno = owner ? [owner] : [];

  const [equipos] = await pool.query<any[]>(
    `SELECT d.id, d.name, d.billboard_code, d.owner, d.online, d.last_seen_at,
            d.model, d.manufacturer, d.app_version, d.status, d.lat, d.lng,
            d.updated_at,
            ds.battery_pct, ds.signal_dbm, ds.network_type, ds.cpu_temp
       FROM devices d
       LEFT JOIN (
         SELECT device_id, battery_pct, signal_dbm, network_type, cpu_temp
           FROM device_status
          WHERE (device_id, reported_at) IN (
            SELECT device_id, MAX(reported_at) FROM device_status GROUP BY device_id
          )
       ) ds ON ds.device_id = d.id
      WHERE d.updated_at > ? AND d.updated_at <= ?${filtroDueno}
      ORDER BY d.updated_at ASC
      LIMIT ?`,
    [piso, hasta, ...parDueno, TOPE]
  );

  const [fotos] = await pool.query<any[]>(
    // Enderezada con el desfase del reloj del equipo (migracion 018): la
    // instancia tiene que ver la misma hora que el dashboard, o la evidencia
    // diria una cosa aqui y otra alla.
    `SELECT p.id, p.device_id, p.storage_path, p.thumbnail_path,
            DATE_ADD(p.taken_at, INTERVAL d.clock_offset_s SECOND) AS taken_at,
            p.uploaded_at, p.source, p.width, p.height,
            p.verification_status, p.is_correct, p.verification_score
       FROM photos p
       JOIN devices d ON d.id = p.device_id
      WHERE p.uploaded_at > ? AND p.uploaded_at <= ?${filtroDueno}
        -- La evidencia de una falla de pantalla es interna (lleva el aviso
        -- pintado encima): no es una foto de prueba de la campaña del cliente.
        AND (p.source IS NULL OR p.source <> 'falla')
      ORDER BY p.uploaded_at ASC
      LIMIT ?`,
    [piso, hasta, ...parDueno, TOPE]
  );

  // Si alguna lista se topo con el tope, la marca NO puede avanzar hasta `hasta`:
  // dejaria fuera lo que no cupo. Se retrocede al ultimo instante entregado, y la
  // instancia vuelve a preguntar desde ahi.
  //
  // Se elige el MINIMO de las listas que se toparon, y eso puede hacer que algo
  // ya entregado vuelva a salir en la siguiente vuelta -por ejemplo si los
  // equipos llenaron el cupo y las fotos no-. Es el lado seguro del error:
  // repetir una fila no rompe nada porque la instancia la guarda con upsert
  // idempotente, mientras que saltarsela la perderia para siempre. Comprobado
  // bajando el tope a 2: 16 fotos entregadas en 10 vueltas, 16 distintas, sin
  // huecos.
  const listaEquipos = equipos as any[];
  const listaFotos = fotos as any[];
  const truncado = listaEquipos.length >= TOPE || listaFotos.length >= TOPE;
  let marca: Date = hasta;
  if (truncado) {
    const candidatos = [
      listaEquipos.length >= TOPE ? new Date(listaEquipos[listaEquipos.length - 1].updated_at) : null,
      listaFotos.length >= TOPE ? new Date(listaFotos[listaFotos.length - 1].uploaded_at) : null,
    ].filter((d): d is Date => d !== null);
    marca = new Date(Math.min(...candidatos.map((d) => d.getTime())));
  }

  res.json({
    // Lo que la instancia guarda y manda en la proxima vuelta.
    hasta: marca.toISOString(),
    // Con `true`, conviene volver a preguntar en seguida en vez de esperar al
    // proximo cron: quedo cola por entregar.
    hay_mas: truncado,
    alcance: owner,
    equipos: listaEquipos,
    // `storage_path` y `thumbnail_path` salen FIRMADOS y caducan (6 h). Para
    // mostrar una foto vieja hay que volver a pedirla aqui o pasarla por un
    // proxy del BFF: guardar la URL en una tabla y volver a pintarla al dia
    // siguiente da 403.
    fotos: firmarFilas(listaFotos),
  });
}

/**
 * POST /api/eyes/devices/:id/captura
 *
 * Pedirle una foto AHORA al equipo, desde el modulo de una instancia. Es lo
 * unico que una llave de servicio puede ESCRIBIR.
 *
 * POR QUE UNA RUTA PROPIA, Y NO LA DE SIEMPRE
 * -------------------------------------------
 * `POST /api/devices/:id/command` acepta ocho tipos de orden: reiniciar la app,
 * abrir la transmision, cambiar la configuracion, actualizar el programa. Dejar
 * entrar ahi a una llave seria dar las ocho para conseguir una, y el dia que se
 * agregue la novena tambien la tendria sin que nadie lo decida. Aqui el tipo de
 * orden NO es un parametro: es TAKE_PHOTO y punto, no se lee nada del cuerpo.
 *
 * Ademas aquella ruta apunta el autor con `req.user!.uid`, y una llave no es un
 * usuario: con ella entrando, esa linea revienta con 500 en vez de negar.
 *
 * QUE SE COMPRUEBA
 * ----------------
 * Que la credencial sea una llave con escritura -el alcance de esa marca es
 * exactamente esta ruta, porque es la unica que no es GET en la lista blanca- y
 * que el equipo sea del dueno de la llave. Un equipo ajeno se contesta 404,
 * igual que uno que no existe: decir "prohibido" ya confirmaria que existe.
 */
export async function pedirCaptura(req: Request, res: Response) {
  const llave = req.servicio;
  if (!llave) return res.status(401).json({ error: 'se_requiere_llave_de_servicio' });
  // Segundo candado. Hoy no se alcanza: el middleware ya niega cualquier metodo
  // que no sea GET a una llave sin escritura, y contesta antes que esto. Se deja
  // puesto porque esa negativa vive en una lista de rutas que se edita, y el dia
  // que alguien afloje ahi esta ruta no puede quedar abierta de rebote.
  if (!llave.escritura) return res.status(403).json({ error: "llave_sin_permiso_de_captura" });

  const deviceId = Number(req.params.id);
  if (!Number.isInteger(deviceId) || deviceId <= 0) return res.status(400).json({ error: 'invalid_device' });

  const [filas] = await pool.query<any[]>(
    `SELECT id, owner, online FROM devices WHERE id = ? LIMIT 1`,
    [deviceId]
  );
  const equipo = (filas as any[])[0];
  if (!equipo) return res.status(404).json({ error: 'not_found' });
  if (llave.owner && equipo.owner !== llave.owner) return res.status(404).json({ error: 'not_found' });

  // El encuadre guardado del equipo viaja en la orden, igual que cuando la pide
  // el dashboard: si no, la foto saldria con otro encuadre que las demas.
  const payload = await encuadreDe(deviceId);

  const command = { id: await ordenarEquipo(deviceId, 'TAKE_PHOTO', payload), command_type: 'TAKE_PHOTO', payload: payload ?? null };

  // `en_linea` le sirve a la interfaz para decir la verdad mientras espera: a un
  // equipo caido la orden le llega cuando vuelva, no ahora.
  res.json({ orden: command.id, en_linea: Boolean(equipo.online), estado: 'pendiente' });
}
