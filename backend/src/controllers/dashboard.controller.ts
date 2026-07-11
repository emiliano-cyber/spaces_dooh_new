// backend/src/controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { z } from 'zod';
import { deleteStored } from '../services/photoStorage.service';
import { getIceServers } from '../utils/turn';

// ICE servers (STUN + TURN) para WebRTC. Lo consumen el dashboard y el agente.
export function iceServers(_req: Request, res: Response) {
  res.json({ iceServers: getIceServers() });
}

// --- DEVICES ---
export async function listDevices(req: Request, res: Response) {
  const { status, search, group_id } = req.query;
  let sql = `SELECT d.*, ds.battery_pct, ds.signal_dbm, ds.network_type
             FROM devices d
             LEFT JOIN (
               SELECT device_id, battery_pct, signal_dbm, network_type
               FROM device_status
               WHERE (device_id, reported_at) IN (
                 SELECT device_id, MAX(reported_at) FROM device_status GROUP BY device_id
               )
             ) ds ON d.id = ds.device_id
             WHERE 1=1`;
  const params: any[] = [];

  if (status && status !== 'all') {
    if (status === 'online') {
      sql += ` AND d.online = TRUE`;
    } else if (status === 'offline') {
      sql += ` AND d.online = FALSE`;
    } else {
      sql += ` AND d.status = ?`;
      params.push(status);
    }
  }
  if (search) {
    sql += ` AND (d.name LIKE ? OR d.billboard_code LIKE ? OR d.address LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (group_id) {
    sql += ` AND d.group_id = ?`;
    params.push(group_id);
  }

  sql += ` ORDER BY d.online DESC, d.last_seen_at DESC`;

  const [rows] = await pool.query(sql, params);
  res.json({ devices: rows });
}

export async function getDevice(req: Request, res: Response) {
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM devices WHERE id = ?`,
    [req.params.id]
  );
  const device = (rows as any[])[0];
  if (!device) return res.status(404).json({ error: 'not_found' });

  const [statusRows] = await pool.query<any[]>(
    `SELECT * FROM device_status WHERE device_id = ? ORDER BY reported_at DESC LIMIT 1`,
    [req.params.id]
  );

  res.json({ device, latest_status: (statusRows as any[])[0] || null });
}

export async function updateDevice(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().optional(),
    billboard_code: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    group_id: z.number().nullable().optional(),
    status: z.enum(['active', 'inactive', 'maintenance', 'provisioning']).optional(),
    stream_quality: z.enum(['low', 'medium', 'high']).optional(),
    capture_quality: z.enum(['low', 'medium', 'high']).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const fields = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (fields.length === 0) return res.status(400).json({ error: 'no_fields' });

  const sets = fields.map(([k]) => `${k} = ?`).join(', ');
  const values = fields.map(([, v]) => v);

  await pool.query(`UPDATE devices SET ${sets} WHERE id = ?`, [...values, req.params.id]);
  res.json({ ok: true });
}

export async function sendCommand(req: Request, res: Response) {
  const schema = z.object({
    command_type: z.enum(['TAKE_PHOTO', 'START_STREAM', 'STOP_STREAM', 'UPDATE_CONFIG', 'REBOOT_APP', 'SYNC_SCHEDULE', 'CHANGE_QUALITY']),
    payload: z.any().optional(),
    priority: z.number().min(1).max(9).default(5),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const deviceId = req.params.id;
  const { command_type, payload, priority } = parsed.data;

  const [result] = await pool.query<any>(
    `INSERT INTO commands (device_id, command_type, payload, priority, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [deviceId, command_type, JSON.stringify(payload ?? null), priority, req.user!.uid]
  );

  const command = {
    id: (result as any).insertId,
    command_type,
    payload: payload ?? null,
  };

  await redis.publish('device:command', JSON.stringify({
    device_id: Number(deviceId),
    command,
  }));

  res.json({ command_id: (result as any).insertId });
}

// --- PHOTOS ---
export async function listPhotos(req: Request, res: Response) {
  const { device_id, campaign_id, from, to, source, page = '1', limit = '20' } = req.query;
  let sql = `SELECT p.*, d.name as device_name
             FROM photos p JOIN devices d ON p.device_id = d.id WHERE 1=1`;
  const params: any[] = [];

  if (device_id) { sql += ` AND p.device_id = ?`; params.push(device_id); }
  if (campaign_id) { sql += ` AND p.campaign_id = ?`; params.push(campaign_id); }
  if (from) { sql += ` AND p.taken_at >= ?`; params.push(from); }
  if (to) { sql += ` AND p.taken_at <= ?`; params.push(to); }
  if (source) { sql += ` AND p.source = ?`; params.push(source); }

  const offset = (Number(page) - 1) * Number(limit);
  sql += ` ORDER BY p.taken_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);

  const [rows] = await pool.query(sql, params);

  const [countResult] = await pool.query<any[]>(
    `SELECT COUNT(*) as total FROM photos p WHERE 1=1` +
    (device_id ? ` AND p.device_id = ${Number(device_id)}` : '') +
    (campaign_id ? ` AND p.campaign_id = ${Number(campaign_id)}` : ''),
  );

  res.json({ photos: rows, total: (countResult as any[])[0]?.total || 0 });
}

// Elimina una foto tomada por error: borra archivos (full + thumb) y la fila.
// La FK ON DELETE CASCADE elimina tambien su verificacion si existiera.
export async function deletePhoto(req: Request, res: Response) {
  const [rows] = await pool.query<any[]>(
    `SELECT storage_path, thumbnail_path FROM photos WHERE id = ?`,
    [req.params.id]
  );
  const photo = (rows as any[])[0];
  if (!photo) return res.status(404).json({ error: 'not_found' });

  await deleteStored(photo.storage_path);
  if (photo.thumbnail_path) await deleteStored(photo.thumbnail_path);
  await pool.query(`DELETE FROM photos WHERE id = ?`, [req.params.id]);

  res.json({ ok: true });
}

// Registros remotos de un device (para diagnostico de equipos en campo).
export async function listDeviceLogs(req: Request, res: Response) {
  const { level, limit = '100' } = req.query;
  let sql = `SELECT id, level, category, message, metadata, logged_at
             FROM device_logs WHERE device_id = ?`;
  const params: any[] = [req.params.id];

  if (level && level !== 'all') {
    sql += ` AND level = ?`;
    params.push(level);
  }
  sql += ` ORDER BY logged_at DESC LIMIT ?`;
  params.push(Math.min(Number(limit) || 100, 500));

  const [rows] = await pool.query(sql, params);
  res.json({ logs: rows });
}

// --- SCHEDULES ---
export async function listSchedules(req: Request, res: Response) {
  const [rows] = await pool.query(
    `SELECT s.*, d.name as device_name
     FROM schedules s LEFT JOIN devices d ON s.device_id = d.id
     ORDER BY s.created_at DESC`
  );
  res.json({ schedules: rows });
}

export async function createSchedule(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    device_id: z.number().nullable().optional(),
    group_id: z.number().nullable().optional(),
    campaign_id: z.number().nullable().optional(),
    frequency_type: z.enum(['interval', 'cron', 'specific_times']),
    interval_minutes: z.number().optional(),
    cron_expression: z.string().optional(),
    specific_times: z.array(z.string()).optional(),
    timezone: z.string().default('America/Mexico_City'),
    valid_from: z.string().nullable().optional(),
    valid_until: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });

  const d = parsed.data;

  // Calculate next_fire_at
  let nextFire: Date | null = new Date();
  if (d.frequency_type === 'interval' && d.interval_minutes) {
    nextFire = new Date(Date.now() + d.interval_minutes * 60000);
  }

  const [result] = await pool.query<any>(
    `INSERT INTO schedules (name, description, device_id, group_id, campaign_id, frequency_type,
       interval_minutes, cron_expression, specific_times, timezone, valid_from, valid_until, next_fire_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.name, d.description ?? null, d.device_id ?? null, d.group_id ?? null, d.campaign_id ?? null,
     d.frequency_type, d.interval_minutes ?? null, d.cron_expression ?? null,
     d.specific_times ? JSON.stringify(d.specific_times) : null,
     d.timezone, d.valid_from ?? null, d.valid_until ?? null, nextFire, req.user!.uid]
  );

  res.json({ schedule_id: (result as any).insertId });
}

export async function updateSchedule(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().optional(),
    active: z.boolean().optional(),
    interval_minutes: z.number().optional(),
    cron_expression: z.string().optional(),
    specific_times: z.array(z.string()).optional(),
    valid_from: z.string().nullable().optional(),
    valid_until: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const fields = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (fields.length === 0) return res.status(400).json({ error: 'no_fields' });

  const sets = fields.map(([k]) => {
    if (k === 'specific_times') return `${k} = ?`;
    return `${k} = ?`;
  }).join(', ');
  const values = fields.map(([k, v]) => k === 'specific_times' ? JSON.stringify(v) : v);

  await pool.query(`UPDATE schedules SET ${sets} WHERE id = ?`, [...values, req.params.id]);
  res.json({ ok: true });
}

export async function deleteSchedule(req: Request, res: Response) {
  await pool.query(`DELETE FROM schedules WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
}

// --- CAMPAIGNS ---
export async function listCampaigns(req: Request, res: Response) {
  const [rows] = await pool.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM campaign_devices cd WHERE cd.campaign_id = c.id) as device_count,
       (SELECT COUNT(*) FROM photos p WHERE p.campaign_id = c.id) as photo_count
     FROM campaigns c ORDER BY c.created_at DESC`
  );
  res.json({ campaigns: rows });
}

export async function createCampaign(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().min(1),
    advertiser: z.string().optional(),
    start_date: z.string(),
    end_date: z.string(),
    verification_enabled: z.boolean().default(false),
    expected_text: z.string().optional(),
    min_ssim_score: z.number().default(0.7),
    max_phash_distance: z.number().default(10),
    device_ids: z.array(z.number()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const d = parsed.data;

  const [result] = await pool.query<any>(
    `INSERT INTO campaigns (name, advertiser, start_date, end_date, verification_enabled,
       expected_text, min_ssim_score, max_phash_distance, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.name, d.advertiser ?? null, d.start_date, d.end_date, d.verification_enabled,
     d.expected_text ?? null, d.min_ssim_score, d.max_phash_distance, req.user!.uid]
  );

  const campaignId = (result as any).insertId;

  if (d.device_ids && d.device_ids.length > 0) {
    const values = d.device_ids.map(did => [campaignId, did]);
    await pool.query(
      `INSERT INTO campaign_devices (campaign_id, device_id) VALUES ?`,
      [values]
    );
  }

  res.json({ campaign_id: campaignId });
}

export async function getCampaign(req: Request, res: Response) {
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM campaigns WHERE id = ?`,
    [req.params.id]
  );
  const campaign = (rows as any[])[0];
  if (!campaign) return res.status(404).json({ error: 'not_found' });

  const [devices] = await pool.query(
    `SELECT d.id, d.name, d.billboard_code
     FROM devices d JOIN campaign_devices cd ON d.id = cd.device_id
     WHERE cd.campaign_id = ?`,
    [req.params.id]
  );

  res.json({ campaign, devices });
}

// --- VERIFICATIONS ---
export async function listVerifications(req: Request, res: Response) {
  const { campaign_id, is_correct, page = '1', limit = '20' } = req.query;
  let sql = `SELECT v.*, p.storage_path, p.thumbnail_path, p.taken_at, d.name as device_name
             FROM verifications v
             JOIN photos p ON v.photo_id = p.id
             JOIN devices d ON p.device_id = d.id
             WHERE 1=1`;
  const params: any[] = [];

  if (campaign_id) { sql += ` AND v.campaign_id = ?`; params.push(campaign_id); }
  if (is_correct !== undefined) { sql += ` AND v.is_correct = ?`; params.push(is_correct === 'true'); }

  const offset = (Number(page) - 1) * Number(limit);
  sql += ` ORDER BY v.processed_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);

  const [rows] = await pool.query(sql, params);
  res.json({ verifications: rows });
}
