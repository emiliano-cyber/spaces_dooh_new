// backend/src/utils/relojEquipo.ts
//
// El reloj de un equipo, medido SOLO y corregido desde el servidor.
//
// Hay telefonos con el reloj corrido (el de la autopista Mexico-Queretaro va 2 h
// atrasado: ver la migracion 018). Antes el desfase se media con un script
// (`revisar:relojes`) y se fijaba a mano (`ajustar:reloj`); al mudar el equipo a
// otra instancia el ajuste no viajaba y sus fotos volvian a salir 2 h atrasadas
// (g500, 13/10/2026). Ahora se mide con cada foto PEDIDA:
//
//   - La orden se crea en el servidor a una hora conocida y el equipo la toma
//     enseguida. Si dice que la tomo mucho ANTES de que se pidiera (o despues de
//     que llego), su reloj miente: el desfase es lo que va de su hora a la del
//     servidor al recibirla.
//   - Solo con ordenes recientes (10 min): una foto de una orden vieja pudo
//     tomarse sin red y subirse tarde, y eso no es un reloj malo.
//   - Si la foto cae dentro de lo posible y habia un desfase, el reloj ya se
//     arreglo: vuelve a 0 solo.
//
// La correccion se aplica AL LEER (taken_at + clock_offset_s), como desde la 018:
// el dato crudo del equipo no se toca.
import { pool } from '../config/database';

const ORDEN_RECIENTE_MS = 10 * 60_000;
// Holgura de red y de camara: por debajo de esto no es un reloj malo.
const TOLERANCIA_MS = 120_000;

/** Mide el reloj con una foto pedida y ajusta clock_offset_s. Devuelve el desfase nuevo, o null si no cambio. */
export async function medirRelojConFoto(deviceId: number, commandId: number | null | undefined,
                                        tomadaEn: Date, recibidaEn: Date = new Date()): Promise<number | null> {
  if (!commandId || !Number.isFinite(tomadaEn.getTime())) return null;
  const [f] = await pool.query<any[]>(
    `SELECT c.created_at, d.clock_offset_s FROM commands c JOIN devices d ON d.id = c.device_id
     WHERE c.id = ? AND c.device_id = ?`, [commandId, deviceId]);
  const fila = (f as any[])[0];
  if (!fila) return null;
  const pedida = new Date(fila.created_at).getTime();
  const llego = recibidaEn.getTime();
  if (llego - pedida > ORDEN_RECIENTE_MS) return null;
  const actual = Number(fila.clock_offset_s) || 0;
  const t = tomadaEn.getTime();
  const posible = t >= pedida - TOLERANCIA_MS && t <= llego + TOLERANCIA_MS;
  // Redondeado al minuto: lo que importa son horas o minutos, no la red.
  const nuevo = posible ? 0 : Math.round((llego - t) / 60_000) * 60;
  if (nuevo === actual) return null;
  await pool.query(`UPDATE devices SET clock_offset_s = ? WHERE id = ?`, [nuevo, deviceId]);
  console.log(`[reloj] equipo ${deviceId}: desfase ${actual}s -> ${nuevo}s (medido con la orden ${commandId})`);
  return nuevo;
}

/**
 * El horario de la pantalla ("06:00"-"24:00", hora de Mexico) traducido al
 * RELOJ del equipo, que es con el que lo compara: con el reloj 2 h atrasado la
 * vigilancia revisaba de 8:00 a 2:00. desfaseS = lo que hay que sumarle a la
 * hora del equipo para tener la buena.
 */
export function horarioParaElReloj(horario: any, desfaseS: number): any {
  if (!horario || typeof horario !== 'object' || Math.abs(desfaseS) < 60) return horario;
  // Todo el dia: igual con cualquier reloj (movido quedaria 22:00-22:00, un hueco).
  if (/^0?0:00/.test(String(horario.inicio ?? '')) && /^24/.test(String(horario.fin ?? ''))) return horario;
  const mover = (h: unknown, esFin: boolean) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(h ?? ''));
    if (!m) return h;
    const min = Number(m[1]) * 60 + Number(m[2]);
    let r = ((min - Math.round(desfaseS / 60)) % 1440 + 1440) % 1440;
    if (esFin && r === 0) r = 1440;   // "hasta la medianoche"
    const hh = Math.floor(r / 60);
    return `${String(hh).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
  };
  return { ...horario, inicio: mover(horario.inicio ?? '06:00', false), fin: mover(horario.fin ?? '24:00', true) };
}
