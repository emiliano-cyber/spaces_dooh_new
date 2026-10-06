// ============================================================================
//  Codigos de vinculacion: la unica puerta de un equipo NUEVO a una empresa.
// ----------------------------------------------------------------------------
//  Ver migrations/021_vinculaciones.sql para el porque. Aqui, lo que se puede
//  probar sin base de datos (generar, normalizar, vencimientos) y la unica
//  operacion delicada: GASTAR un codigo, que tiene que ser atomica para que dos
//  equipos que lo presenten a la vez no entren los dos.
// ============================================================================
import crypto from 'crypto';
import { pool } from '../config/database';

// Sin 0/O, 1/I/L ni U/V: se dicta por telefono y se teclea en un equipo sin que
// nadie confunda caracteres. 29 simbolos ^ 8 = 5e11 combinaciones; con el
// vencimiento y el limite de intentos, adivinar uno no es practico.
export const ALFABETO = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
export const LARGO = 8;

export type TipoEquipo = 'telefono' | 'raspberry' | 'pc';

// Un telefono escanea el QR en el momento. Una Raspberry o una PC se preparan
// en la oficina y se instalan dias despues: su codigo tiene que durar.
export const VIGENCIA_MIN: Record<TipoEquipo, number> = {
  telefono: 60,
  raspberry: 14 * 24 * 60,
  pc: 14 * 24 * 60,
};

export function generarCodigo(): string {
  const bytes = crypto.randomBytes(LARGO);
  let c = '';
  for (let i = 0; i < LARGO; i++) c += ALFABETO[bytes[i] % ALFABETO.length];
  return c;
}

/** "abcd-2345 " -> "ABCD2345"; null si no tiene forma de codigo. */
export function normalizar(entrada: unknown): string | null {
  const c = String(entrada ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (c.length !== LARGO) return null;
  for (const ch of c) if (!ALFABETO.includes(ch)) return null;
  return c;
}

/** "ABCD2345" -> "ABCD-2345", como se muestra y se dicta. */
export const mostrar = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;

/** Lo que se pone en el QR que escanea el telefono. */
export function enlaceDeVinculacion(servidor: string, codigo: string): string {
  return `spaceeye://vincular?servidor=${encodeURIComponent(servidor)}&codigo=${codigo}`;
}

/**
 * Gasta el codigo para un equipo, si sigue vigente. Devuelve el dueno con el
 * que nace el equipo, o null si el codigo no sirve (no existe, vencio, ya se
 * uso o se cancelo). Un solo UPDATE con todas las condiciones: si dos equipos
 * lo presentan a la vez, la base deja pasar a uno solo.
 */
export async function gastar(codigo: string): Promise<{ id: number; owner: string | null } | null> {
  const [r] = await pool.query<any>(
    `UPDATE vinculaciones SET usado_en = NOW()
      WHERE codigo = ? AND usado_en IS NULL AND cancelado_en IS NULL AND expira_en > NOW()`,
    [codigo]
  );
  if (!(r as any).affectedRows) return null;
  const [filas] = await pool.query<any[]>(`SELECT id, owner FROM vinculaciones WHERE codigo = ?`, [codigo]);
  const f = (filas as any[])[0];
  return f ? { id: f.id, owner: f.owner ?? null } : null;
}

/** Despues de crear el equipo: con que equipo se uso el codigo (auditoria). */
export async function ligarEquipo(idVinculacion: number, deviceId: number) {
  await pool.query(`UPDATE vinculaciones SET device_id = ? WHERE id = ?`, [deviceId, idVinculacion]);
}

// ─── Intentos fallidos ───────────────────────────────────────────────────────
// Un equipo que presenta codigos malos una y otra vez esta adivinando. Por IP:
// 10 fallos en 15 minutos y se le cierra la puerta hasta que pase la ventana.
const VENTANA_MS = 15 * 60 * 1000;
const MAX_FALLOS = 10;
const fallos = new Map<string, number[]>();

export function bloqueado(ip: string, ahora = Date.now()): boolean {
  const v = (fallos.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  fallos.set(ip, v);
  return v.length >= MAX_FALLOS;
}

export function anotarFallo(ip: string, ahora = Date.now()) {
  const v = (fallos.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  v.push(ahora);
  fallos.set(ip, v);
  if (fallos.size > 5000) fallos.clear(); // nunca crece sin tope
}
