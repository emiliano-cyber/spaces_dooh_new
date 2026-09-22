// backend/src/controllers/telemetry.controller.ts
// PlayLog / Historico de telemetria. Lee de la tabla `device_status` que YA se
// llena hoy (un reporte por dispositivo cada ~60s). NO requiere migraciones ni
// cambios en la app: funciona para toda la flota (equipos viejos y nuevos).
//
// - getTelemetry: serie temporal (raw u hora) + resumen + alertas por umbral.
// - exportTelemetry: descarga CSV del historico.
//
// Las alertas se calculan AL VUELO sobre los datos (sin tabla nueva), para
// mantener el despliegue en produccion de riesgo minimo.
import { Request, Response } from 'express';
import { pool } from '../config/database';

// Umbrales por defecto. Ajustables aqui sin tocar la logica.
export const THRESHOLDS = {
  cpu_temp_max: 60,       // °C
  battery_temp_max: 45,   // °C
  battery_pct_min: 20,    // %
  signal_dbm_min: -105,   // dBm (mas negativo = peor)
  storage_free_min_mb: 500,
  offline_minutes: 10,    // sin reporte => offline
};

// Columnas numericas de device_status que exponemos en el historico.
const METRIC_COLS = [
  'battery_pct', 'battery_temp', 'battery_charging', 'signal_dbm',
  'network_type', 'network_operator', 'storage_free_mb', 'ram_free_mb',
  'cpu_temp', 'uptime_seconds',
] as const;

// Normaliza el rango de fechas: por defecto ultimas 24h. Limita a 92 dias para
// no traer series gigantes.
function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const t = to ? new Date(to) : now;
  let f = from ? new Date(from) : new Date(t.getTime() - 24 * 3600 * 1000);
  const maxSpan = 92 * 24 * 3600 * 1000;
  if (t.getTime() - f.getTime() > maxSpan) f = new Date(t.getTime() - maxSpan);
  return { from: f, to: t };
}

// GET /api/devices/:id/telemetry?from&to&granularity=raw|hour
export async function getTelemetry(req: Request, res: Response) {
  const deviceId = Number(req.params.id);
  if (!deviceId) return res.status(400).json({ error: 'invalid_device' });

  const [devRows] = await pool.query<any[]>(
    `SELECT id, name, online, last_seen_at, owner FROM devices WHERE id = ?`, [deviceId]
  );
  const device = (devRows as any[])[0];
  if (!device) return res.status(404).json({ error: 'not_found' });
  // Mismo alcance que la lista de equipos y la de fotos. Va aqui y no en la ruta
  // porque esta consulta es la que decide: el dia que se abrio esta ruta a las
  // llaves de instancia, sin esto se entregaba el historico -bateria, senal,
  // temperaturas- de la flota entera a cualquier instancia que supiera un id.
  // Un equipo ajeno se contesta 404, igual que uno que no existe.
  if (req.servicio?.owner && device.owner !== req.servicio.owner) {
    return res.status(404).json({ error: 'not_found' });
  }

  const { from, to } = resolveRange(req.query.from as string, req.query.to as string);
  const granularity = (req.query.granularity as string) === 'hour' ? 'hour' : 'raw';

  let series: any[];
  if (granularity === 'hour') {
    // Rollup por hora: avg/min/max de las metricas numericas. Rapido para
    // rangos largos (dia/semana/mes) sin leer millones de filas cruda.
    const [rows] = await pool.query<any[]>(
      `SELECT
         DATE_FORMAT(reported_at, '%Y-%m-%d %H:00:00') AS bucket,
         COUNT(*) AS samples,
         AVG(cpu_temp) AS cpu_temp, MAX(cpu_temp) AS cpu_temp_max,
         AVG(battery_temp) AS battery_temp, MAX(battery_temp) AS battery_temp_max,
         AVG(battery_pct) AS battery_pct, MIN(battery_pct) AS battery_pct_min,
         AVG(signal_dbm) AS signal_dbm, MIN(signal_dbm) AS signal_dbm_min,
         AVG(ram_free_mb) AS ram_free_mb,
         AVG(storage_free_mb) AS storage_free_mb, MIN(storage_free_mb) AS storage_free_mb_min
       FROM device_status
       WHERE device_id = ? AND reported_at BETWEEN ? AND ?
       GROUP BY bucket ORDER BY bucket ASC`,
      [deviceId, from, to]
    );
    series = rows as any[];
  } else {
    // Crudo: cap de 5000 puntos para proteger memoria/red.
    const [rows] = await pool.query<any[]>(
      `SELECT reported_at, ${METRIC_COLS.join(', ')}
       FROM device_status
       WHERE device_id = ? AND reported_at BETWEEN ? AND ?
       ORDER BY reported_at ASC LIMIT 5000`,
      [deviceId, from, to]
    );
    series = rows as any[];
  }

  // Resumen (min/max/avg) del rango, siempre desde la tabla cruda.
  const [sumRows] = await pool.query<any[]>(
    `SELECT
       MAX(cpu_temp) AS cpu_temp_max, AVG(cpu_temp) AS cpu_temp_avg,
       MAX(battery_temp) AS battery_temp_max,
       MIN(battery_pct) AS battery_pct_min, AVG(battery_pct) AS battery_pct_avg,
       MIN(signal_dbm) AS signal_dbm_min,
       MIN(storage_free_mb) AS storage_free_mb_min,
       COUNT(*) AS samples
     FROM device_status
     WHERE device_id = ? AND reported_at BETWEEN ? AND ?`,
    [deviceId, from, to]
  );
  const summary = (sumRows as any[])[0] || {};

  const alerts = computeAlerts(device, summary);

  res.json({
    device: { id: device.id, name: device.name, online: !!device.online, last_seen_at: device.last_seen_at },
    range: { from, to, granularity },
    thresholds: THRESHOLDS,
    summary,
    alerts,
    series,
  });
}

// Deriva alertas del resumen del rango + estado actual. Cada alerta trae nivel,
// mensaje y el valor que la disparo.
function computeAlerts(device: any, s: any): any[] {
  const alerts: any[] = [];
  const push = (level: string, type: string, message: string, value: any) =>
    alerts.push({ level, type, message, value });

  if (s.cpu_temp_max != null && Number(s.cpu_temp_max) > THRESHOLDS.cpu_temp_max)
    push('critical', 'cpu_temp', `Temperatura CPU alta: ${Number(s.cpu_temp_max).toFixed(1)}°C`, Number(s.cpu_temp_max));
  if (s.battery_temp_max != null && Number(s.battery_temp_max) > THRESHOLDS.battery_temp_max)
    push('critical', 'battery_temp', `Temperatura de batería alta: ${Number(s.battery_temp_max).toFixed(1)}°C`, Number(s.battery_temp_max));
  if (s.battery_pct_min != null && Number(s.battery_pct_min) < THRESHOLDS.battery_pct_min)
    push('warning', 'battery_low', `Batería baja: ${Number(s.battery_pct_min)}%`, Number(s.battery_pct_min));
  if (s.signal_dbm_min != null && Number(s.signal_dbm_min) < THRESHOLDS.signal_dbm_min)
    push('warning', 'signal_weak', `Señal débil: ${Number(s.signal_dbm_min)} dBm`, Number(s.signal_dbm_min));
  if (s.storage_free_mb_min != null && Number(s.storage_free_mb_min) < THRESHOLDS.storage_free_min_mb)
    push('warning', 'storage_low', `Almacenamiento bajo: ${Number(s.storage_free_mb_min)} MB`, Number(s.storage_free_mb_min));

  // Offline: sin conexion o ultimo reporte hace mas de N minutos.
  const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
  const minsAgo = lastSeen ? (Date.now() - lastSeen) / 60000 : Infinity;
  if (!device.online || minsAgo > THRESHOLDS.offline_minutes)
    push('critical', 'offline', `Sin conexión${lastSeen ? ` (últ. ${Math.round(minsAgo)} min)` : ''}`, Math.round(minsAgo));

  return alerts;
}

// GET /api/devices/:id/telemetry/export?from&to  → CSV
export async function exportTelemetry(req: Request, res: Response) {
  const deviceId = Number(req.params.id);
  if (!deviceId) return res.status(400).json({ error: 'invalid_device' });

  const [devRows] = await pool.query<any[]>(`SELECT name FROM devices WHERE id = ?`, [deviceId]);
  if (!(devRows as any[])[0]) return res.status(404).json({ error: 'not_found' });

  const { from, to } = resolveRange(req.query.from as string, req.query.to as string);
  const [rows] = await pool.query<any[]>(
    `SELECT reported_at, ${METRIC_COLS.join(', ')}
     FROM device_status
     WHERE device_id = ? AND reported_at BETWEEN ? AND ?
     ORDER BY reported_at ASC LIMIT 100000`,
    [deviceId, from, to]
  );

  const headers = ['reported_at', ...METRIC_COLS];
  const esc = (v: any) => {
    if (v == null) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows as any[]) {
    lines.push(headers.map((h) => esc(r[h])).join(','));
  }
  const csv = '﻿' + lines.join('\r\n'); // BOM para Excel

  const safeName = String((devRows as any[])[0].name || 'device').replace(/[^\w.-]+/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="telemetria_${safeName}_${deviceId}.csv"`);
  res.send(csv);
}
