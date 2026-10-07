// backend/src/utils/versionVigilancia.ts
//
// La huella de lo que el equipo necesita para vigilar su pantalla: la pantalla
// marcada, los ajustes de creativos y de fallas, y sus campanas de hoy.
//
// Viaja en la respuesta del reporte de estado (que el equipo manda de todos
// modos): en modo continuo el equipo no vuelve a pedir su configuracion mientras
// la huella no cambie, y en cuanto cambia (un ajuste en el panel, una campana
// confirmada en SPACE OS) la pide en su siguiente vuelta. Asi un cambio llega
// en minutos sin gastar datos en preguntar.
import { createHash } from 'crypto';
import { pool } from '../config/database';
import { campanasDelEquipo } from '../controllers/campanasSpaceos.controller';

// Columnas de devices que cambian lo que hace la vigilancia. salud_ultimo NO:
// es el resumen que el propio equipo manda en cada vuelta.
const RELEVANTE = /^(creative_|salud_(?!ultimo$)|pantalla$|aprendizaje_min$|stream_rotation$|camera_)/;

export async function versionVigilancia(deviceId: number): Promise<string | null> {
  const [f] = await pool.query<any[]>(`SELECT * FROM devices WHERE id = ?`, [deviceId]);
  const d = (f as any[])[0];
  if (!d) return null;
  const partes = Object.keys(d).filter((k) => RELEVANTE.test(k)).sort()
    .map((k) => `${k}=${d[k] instanceof Date ? d[k].toISOString() : JSON.stringify(d[k])}`);
  const campanas = await campanasDelEquipo(deviceId).catch(() => null);
  partes.push(`campanas=${JSON.stringify(campanas)}`);
  return createHash('sha1').update(partes.join('\n')).digest('hex').slice(0, 16);
}
