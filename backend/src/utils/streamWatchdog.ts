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
import { cerrarSesion } from './relayTelefono';

// Un poco mas que el corte del navegador (3 min), para que el cliente corte
// primero cuando esta vivo y este sea solo la red de seguridad.
export const MAX_STREAM_MS = 3 * 60 * 1000 + 15000;

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
  // null cuando no hay persona detras: una foto programada no la pide nadie.
  userId: number | null;
  nombre: string;
  desde: number;        // Date.now()
  modo: 'relay' | 'p2p';
  whep?: string;        // solo en relay: a donde conectarse

  // Solo telefonos por el servidor de medios: el backend contesta la oferta del
  // telefono entregandosela al servidor (ver relayTelefono.ts).
  whip?: string;
  oferta?: string;
  recurso?: string | null;
  candidatosPendientes?: any[];

  // Quien esta mirando, por pestaña (casi todos entran con la MISMA cuenta, asi
  // que el usuario no alcanza para distinguirlos) y hasta cuando: cada uno tiene
  // sus 3 minutos. La transmision se corta cuando se va el ULTIMO, no cuando se
  // va el primero.
  espectadores?: Map<string, number>;
};

const sesiones = new Map<number, SesionDeVista>();

export function registrarSesion(deviceId: number, sesion: SesionDeVista) {
  sesiones.set(deviceId, sesion);
}

/** Suma una pestaña a la transmision y le da sus propios 3 minutos. */
export function unirEspectador(deviceId: number, visor: string) {
  const s = sesiones.get(deviceId);
  if (!s) return;
  if (!s.espectadores) s.espectadores = new Map();
  s.espectadores.set(visor, Date.now() + MAX_STREAM_MS);
  // El vigilante del servidor se estira hasta el ultimo que vence: si no, el
  // que llego al minuto 2 se quedaba sin imagen al minuto 3 del primero.
  const ultimo = Math.max(...s.espectadores.values());
  armStreamWatchdog(deviceId, ultimo - Date.now(), false);
}

/**
 * Saca una pestaña. Devuelve cuantas quedan mirando: si queda alguna, la
 * transmision sigue y NO hay que mandarle nada al equipo.
 */
export function quitarEspectador(deviceId: number, visor: string): number {
  const s = sesiones.get(deviceId);
  if (!s?.espectadores) return 0;
  s.espectadores.delete(visor);
  return s.espectadores.size;
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

export function armStreamWatchdog(deviceId: number, ms = MAX_STREAM_MS, nueva = true) {
  // `nueva` = arranca otra transmision: la sesion anterior (y su dueño) se van.
  // Al estirar el plazo de la actual por un espectador nuevo, se conserva.
  if (nueva) disarmStreamWatchdog(deviceId);
  else {
    const t = timers.get(deviceId);
    if (t) clearTimeout(t);
  }
  timers.set(deviceId, setTimeout(() => {
    timers.delete(deviceId);
    // Si alguien sigue dentro de sus 3 minutos (un reloj de este proceso que
    // se adelanto un poco), se espera a que se le acaben.
    const s = sesiones.get(deviceId);
    if (s?.espectadores?.size) {
      const ahora = Date.now();
      for (const [v, vence] of s.espectadores) if (vence <= ahora + 1000) s.espectadores.delete(v);
      if (s.espectadores.size) {
        armStreamWatchdog(deviceId, Math.max(...s.espectadores.values()) - ahora, false);
        return;
      }
    }
    void stopStream(deviceId, 'limite de 3 minutos');
  }, Math.max(1000, ms)));
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

/** Libera en el servidor de medios la sesion del telefono, si la hay. */
function cerrarSesionDeMedios(deviceId: number) {
  const recurso = sesiones.get(deviceId)?.recurso;
  if (recurso) {
    cerrarSesion(recurso).catch(() => { /* el telefono ya la cerro al colgar */ });
  }
}

export function disarmStreamWatchdog(deviceId: number) {
  cerrarSesionDeMedios(deviceId);
  const t = timers.get(deviceId);
  if (t) {
    clearTimeout(t);
    timers.delete(deviceId);
  }
  // La transmision se acabo: su dueño tambien.
  sesiones.delete(deviceId);
}
