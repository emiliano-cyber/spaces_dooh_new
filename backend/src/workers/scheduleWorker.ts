// backend/src/workers/scheduleWorker.ts
import cron from 'node-cron';
import { parseExpression } from 'cron-parser';
import { pool } from '../config/database';
import { redis } from '../config/redis';

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
  }

  for (const deviceId of targets) {
    const [result] = await pool.query<any>(
      `INSERT INTO commands (device_id, command_type, payload, schedule_id, priority, expires_at)
       VALUES (?, 'TAKE_PHOTO', ?, ?, 5, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [deviceId, JSON.stringify({ campaign_id: schedule.campaign_id }), schedule.id]
    );

    await redis.publish('device:command', JSON.stringify({
      device_id: deviceId,
      command: {
        id: (result as any).insertId,
        command_type: 'TAKE_PHOTO',
        payload: { campaign_id: schedule.campaign_id },
      },
    }));
  }

  let nextFire: Date | null = null;
  if (schedule.frequency_type === 'interval' && schedule.interval_minutes) {
    nextFire = new Date(Date.now() + schedule.interval_minutes * 60000);
  } else if (schedule.frequency_type === 'cron' && schedule.cron_expression) {
    nextFire = parseExpression(schedule.cron_expression, { tz: schedule.timezone }).next().toDate();
  } else if (schedule.frequency_type === 'specific_times') {
    const times = typeof schedule.specific_times === 'string'
      ? JSON.parse(schedule.specific_times)
      : schedule.specific_times;
    nextFire = calcNextSpecificTime(times, schedule.timezone);
  }

  await pool.query(
    `UPDATE schedules SET last_fired_at = NOW(), next_fire_at = ? WHERE id = ?`,
    [nextFire, schedule.id]
  );
}

function calcNextSpecificTime(times: string[], _tz: string): Date {
  const now = new Date();
  const candidates = times.map((t: string) => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  });
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
}

cron.schedule('* * * * *', async () => {
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM schedules WHERE active = TRUE AND next_fire_at <= NOW()
       AND (valid_until IS NULL OR valid_until >= CURDATE())
       AND (valid_from IS NULL OR valid_from <= CURDATE())`
  );

  for (const s of (rows as any[])) {
    try {
      await fireSchedule(s);
    } catch (err) {
      console.error(`Schedule ${s.id} failed:`, err);
    }
  }
});

console.log('[scheduleWorker] started');
