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

/**
 * Quien tiene abierta la vista en vivo de cada equipo.
 *
 * Hacia falta porque hasta ahora la transmision no tenia dueño: si dos personas
 * abrian el mismo equipo, la segunda se llevaba la camara y la primera se quedaba
 * con la imagen congelada, sin un solo aviso. Ninguna de las dos entendia que
 * estaba pasando.
 *
 * Vive en memoria a proposito: si el backend se reinicia, las transmisiones se
 * cortan igual, asi que un registro persistente no aportaria nada.
 */
export type SesionDeVista = {
  userId: number;
  nombre: string;
  desde: number;        // Date.now()
  modo: 'relay' | 'p2p';
  whep?: string;        // solo en relay: a donde conectarse
};

const sesiones = new Map<number, SesionDeVista>();

export function registrarSesion(deviceId: number, sesion: SesionDeVista) {
  sesiones.set(deviceId, sesion);
}

export function sesionDeVista(deviceId: number): SesionDeVista | null {
  // Si el vigilante ya no tiene temporizador, la transmision murio: la sesion
  // que quedara aqui seria mentira.
  if (!timers.has(deviceId)) {
    sesiones.delete(deviceId);
    return null;
  }
  return sesiones.get(deviceId) ?? null;
}

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

/**
 * Si el equipo tiene una transmision viva ahora mismo.
 *
 * Importa para la orientacion de la foto: con el visor abierto la app entrega la
 * imagen ya girada, y sin visor la entrega como sale del sensor. Saber en cual de
 * los dos casos estamos es lo que permite enderezarla sin romper la otra.
 */
export function estaTransmitiendo(deviceId: number): boolean {
  return timers.has(deviceId);
}

export function disarmStreamWatchdog(deviceId: number) {
  const t = timers.get(deviceId);
  if (t) {
    clearTimeout(t);
    timers.delete(deviceId);
  }
  // La transmision se acabo: su dueño tambien.
  sesiones.delete(deviceId);
}
