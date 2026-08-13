// backend/src/workers/scheduleWorker.ts
import cron from 'node-cron';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { encuadreDe, capturaPorStream, usaServidorDeMedios } from '../controllers/dashboard.controller';
import { proximoDisparo } from '../utils/horarios';

async function fireSchedule(schedule: any) {
  // Se traen las columnas que hacen falta para decidir COMO tomar la foto, no
  // solo a quien: si es telefono o relay, si esta encendido, y su orientacion.
  const columnas = `id, name, online, app_version, stream_rotation`;
  let equipos: any[] = [];

  if (schedule.device_id) {
    const [rows] = await pool.query<any[]>(`SELECT ${columnas} FROM devices WHERE id = ?`, [schedule.device_id]);
    equipos = rows as any[];
  } else if (schedule.group_id) {
    const [rows] = await pool.query<any[]>(`SELECT ${columnas} FROM devices WHERE group_id = ?`, [schedule.group_id]);
    equipos = rows as any[];
  } else if (schedule.campaign_id) {
    const [rows] = await pool.query<any[]>(
      `SELECT ${columnas.split(', ').map((c) => `d.${c}`).join(', ')}
         FROM devices d JOIN campaign_devices cd ON cd.device_id = d.id
        WHERE cd.campaign_id = ?`,
      [schedule.campaign_id]
    );
    equipos = rows as any[];
  } else {
    // Sin equipo, grupo ni campana: toda la flota. Se excluyen los dados de baja
    // y los que estan en mantenimiento, pero NO se filtra por status='active':
    // ese campo nunca se promueve y todos los equipos en operacion siguen en
    // 'provisioning', asi que filtrar por activo no le mandaria la orden a nadie.
    const [rows] = await pool.query<any[]>(
      `SELECT ${columnas} FROM devices WHERE status NOT IN ('inactive','maintenance')`
    );
    equipos = rows as any[];
  }

  for (const eq of equipos) {
    // El encuadre fijo del equipo (lente y zoom) viaja en la orden. Sin esto, la
    // foto por horario salia siempre al encuadre por defecto del lente principal:
    // el ajuste hecho en la vista en vivo no la alcanzaba.
    //
    // schedule_id tambien viaja en el payload: la columna de la tabla commands no
    // la ve el equipo, y sin el la foto subia suelta, sin quedar ligada a su
    // programacion (asi es como todas las fotos aparecian como "a peticion").
    const extra = { campaign_id: schedule.campaign_id, schedule_id: schedule.id };

    // Los telefonos encendidos toman la foto DESDE la vista en vivo, igual que el
    // boton de foto a todos: es el unico camino que da fotos parejas sin depender
    // de la version de APK instalada en cada sitio. La evidencia diaria es
    // precisamente donde mas importa que todas se vean igual.
    if (eq.online && !usaServidorDeMedios(eq.app_version)) {
      void capturaPorStream(eq, { scheduleId: schedule.id, extra });
      continue;
    }

    // Relay y equipos apagados: orden directa. En la Raspberry y las camaras IP
    // el agente corta la transmision para poder fotografiar, asi que abrir el
    // visor antes no aportaria nada; y a un equipo apagado hay que dejarle la
    // orden, que vence sola a los 10 minutos.
    const payload = { ...extra, ...(await encuadreDe(eq.id)) };

    const [result] = await pool.query<any>(
      `INSERT INTO commands (device_id, command_type, payload, schedule_id, priority, expires_at)
       VALUES (?, 'TAKE_PHOTO', ?, ?, 5, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [eq.id, JSON.stringify(payload), schedule.id]
    );

    await redis.publish('device:command', JSON.stringify({
      device_id: eq.id,
      command: {
        id: (result as any).insertId,
        command_type: 'TAKE_PHOTO',
        payload,
      },
    }));
  }

  await pool.query(
    `UPDATE schedules SET last_fired_at = NOW(), next_fire_at = ? WHERE id = ?`,
    [proximoDisparo(schedule, true), schedule.id]
  );
}

/**
 * Candado de un minuto. El worker corre dentro del backend, asi que si algun dia
 * se levanta una segunda instancia, sin esto cada foto programada se tomaria dos
 * veces (dos subidas = el doble de datos moviles por nada).
 */
async function tomarElTurno(): Promise<boolean> {
  const minuto = Math.floor(Date.now() / 60000);
  try {
    const puesto = await redis.set(`schedule:tick:${minuto}`, '1', { EX: 90, NX: true });
    return puesto === 'OK';
  } catch (err) {
    // Si Redis no contesta, mas vale tomar la foto que quedarse mudo.
    console.error('[scheduleWorker] no se pudo tomar el turno:', (err as any)?.message);
    return true;
  }
}

cron.schedule('* * * * *', async () => {
  if (!(await tomarElTurno())) return;

  const [rows] = await pool.query<any[]>(
    `SELECT * FROM schedules WHERE active = TRUE AND next_fire_at IS NOT NULL AND next_fire_at <= NOW()
       AND (valid_until IS NULL OR valid_until >= CURDATE())
       AND (valid_from IS NULL OR valid_from <= CURDATE())`
  );

  for (const s of (rows as any[])) {
    try {
      // Si el backend estuvo caido, al volver hay disparos vencidos esperando.
      // Tomarlos todos de golpe gasta datos moviles y no sirve de evidencia: una
      // foto de la franja de la manana tomada a las 3 de la tarde no prueba nada.
      // Se reprograma y se sigue.
      const atrasoMin = (Date.now() - new Date(s.next_fire_at).getTime()) / 60000;
      if (atrasoMin > 60) {
        console.warn(`[scheduleWorker] schedule ${s.id} vencido hace ${Math.round(atrasoMin)} min: se reprograma sin tomar foto`);
        await pool.query(`UPDATE schedules SET next_fire_at = ? WHERE id = ?`, [proximoDisparo(s, true), s.id]);
        continue;
      }
      await fireSchedule(s);
    } catch (err) {
      console.error(`Schedule ${s.id} failed:`, err);
    }
  }
});

console.log('[scheduleWorker] started');
