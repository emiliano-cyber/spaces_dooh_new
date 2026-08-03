// backend/src/workers/scheduleWorker.ts
import cron from 'node-cron';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { encuadreDe } from '../controllers/dashboard.controller';
import { proximoDisparo } from '../utils/horarios';

async function fireSchedule(schedule: any) {
  const targets: number[] = [];

  if (schedule.device_id) {
    targets.push(schedule.device_id);
  } else if (schedule.group_id) {
    const [rows] = await pool.query<any[]>(
      `SELECT id as device_id FROM devices WHERE group_id = ?`,
      [schedule.group_id]
    );
    targets.push(...(rows as any[]).map((r: any) => r.device_id));
  } else if (schedule.campaign_id) {
    const [rows] = await pool.query<any[]>(
      `SELECT device_id FROM campaign_devices WHERE campaign_id = ?`,
      [schedule.campaign_id]
    );
    targets.push(...(rows as any[]).map((r: any) => r.device_id));
  } else {
    // Sin equipo, grupo ni campana: toda la flota. Se excluyen los dados de baja
    // y los que estan en mantenimiento, pero NO se filtra por status='active':
    // ese campo nunca se promueve y todos los equipos en operacion siguen en
    // 'provisioning', asi que filtrar por activo no le mandaria la orden a nadie.
    const [rows] = await pool.query<any[]>(
      `SELECT id as device_id FROM devices WHERE status NOT IN ('inactive','maintenance')`
    );
    targets.push(...(rows as any[]).map((r: any) => r.device_id));
  }

  for (const deviceId of targets) {
    // El encuadre fijo del equipo (lente y zoom) viaja en la orden. Sin esto, la
    // foto por horario salia siempre al encuadre por defecto del lente principal:
    // el ajuste hecho en la vista en vivo no la alcanzaba.
    //
    // schedule_id tambien viaja en el payload: la columna de la tabla commands no
    // la ve el equipo, y sin el la foto subia suelta, sin quedar ligada a su
    // programacion (asi es como todas las fotos aparecian como "a peticion").
    const payload = {
      campaign_id: schedule.campaign_id,
      schedule_id: schedule.id,
      ...(await encuadreDe(deviceId)),
    };

    const [result] = await pool.query<any>(
      `INSERT INTO commands (device_id, command_type, payload, schedule_id, priority, expires_at)
       VALUES (?, 'TAKE_PHOTO', ?, ?, 5, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [deviceId, JSON.stringify(payload), schedule.id]
    );

    await redis.publish('device:command', JSON.stringify({
      device_id: deviceId,
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
