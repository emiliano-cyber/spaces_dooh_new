// backend/src/utils/streamWatchdog.ts
// Corta transmisiones olvidadas.
//
// El STOP_STREAM lo mandaba solo el navegador. Si alguien cerraba la pestaña de
// golpe, se le iba el internet o simplemente dejaba la vista abierta, el
// telefono seguia transmitiendo indefinidamente: gastaba datos del sitio y
// dejaba sesiones WebRTC colgadas (se veian en coturn reintentando con
// credenciales ya vencidas). Aqui el servidor garantiza el corte aunque el
// navegador nunca avise.
import { pool } from '../config/database';
import { redis } from '../config/redis';

// Un poco mas que el corte del navegador (3 min), para que el cliente corte
// primero cuando esta vivo y este sea solo la red de seguridad.
const MAX_STREAM_MS = 3 * 60 * 1000 + 15000;

const timers = new Map<number, NodeJS.Timeout>();

export async function stopStream(deviceId: number, reason: string) {
  disarmStreamWatchdog(deviceId);
  try {
    const [result] = await pool.query<any>(
      `INSERT INTO commands (device_id, command_type, payload, priority, expires_at)
       VALUES (?, 'STOP_STREAM', NULL, 5, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [deviceId]
    );
    await redis.publish('device:command', JSON.stringify({
      device_id: deviceId,
      command: { id: (result as any).insertId, command_type: 'STOP_STREAM', payload: null },
    }));
    console.log(`[StreamWatchdog] STOP_STREAM enviado a device ${deviceId} (${reason})`);
  } catch (err: any) {
    console.error(`[StreamWatchdog] no se pudo detener device ${deviceId}:`, err.message);
  }
}

export function armStreamWatchdog(deviceId: number) {
  disarmStreamWatchdog(deviceId);
  timers.set(deviceId, setTimeout(() => {
    timers.delete(deviceId);
    void stopStream(deviceId, 'limite de 3 minutos');
  }, MAX_STREAM_MS));
}

export function disarmStreamWatchdog(deviceId: number) {
  const t = timers.get(deviceId);
  if (t) {
    clearTimeout(t);
    timers.delete(deviceId);
  }
}
