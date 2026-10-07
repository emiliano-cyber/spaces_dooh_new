// backend/src/utils/dueno.ts
// Una llave de servicio (la instancia de un cliente en SPACE OS) solo ve los
// equipos de su dueño. Un equipo ajeno se contesta igual que uno que no existe:
// decir "prohibido" ya confirmaria que existe.
import type { Request } from 'express';
import { pool } from '../config/database';

/** true si quien pregunta NO puede ver este equipo (o el equipo no existe). */
export async function equipoAjeno(req: Request, deviceId: number): Promise<boolean> {
  const [f] = await pool.query<any[]>(`SELECT owner FROM devices WHERE id = ?`, [deviceId]);
  const d = (f as any[])[0];
  if (!d) return true;
  return !!(req.servicio?.owner && d.owner !== req.servicio.owner);
}
