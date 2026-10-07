// backend/src/utils/instancia.ts
// MODO INSTANCIA: este Space Eye vive DENTRO de una instancia de SPACE OS (el
// droplet de una empresa) y es solo de esa empresa.
//
// Cambian tres cosas, todas desde la configuracion que escribe el alta de la
// instancia (/etc/space-os/eyes.env), sin que nadie entre a crear nada a mano:
//
//   1. Todo equipo que se da de alta aqui es de esta empresa (INSTANCIA_OWNER),
//      traiga testigo o no. Con un Space Eye por empresa, el testigo deja de ser
//      lo unico que separa a un cliente de otro.
//   2. Las dos credenciales con las que SPACE OS habla con este Space Eye
//      (INSTANCIA_LLAVE para leer y pedir fotos, INSTANCIA_TESTIGO para que los
//      instaladores den de alta equipos) las genera el alta y aqui solo se
//      registran. Asi el mismo valor queda en app.env de SPACE OS y aqui, y no
//      hay que copiar nada de un lado a otro.
//   3. El primer administrador del dashboard de operacion (ADMIN_EMAIL /
//      ADMIN_PASSWORD), solo si todavia no hay ningun usuario.
//
// Sin INSTANCIA_OWNER no pasa nada de esto: es el Space Eye central de siempre.
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { env } from '../config/env';
import { hashear } from './llaveServicio';

export const enModoInstancia = () => !!env.INSTANCIA_OWNER;

/** El dueño que se le pone a un equipo que se da de alta sin testigo. */
export const duenoPorOmision = (): string | null => env.INSTANCIA_OWNER || null;

const FORMATO = /^se_([0-9a-f]{12})_[A-Za-z0-9_-]{20,}$/;

async function registrarLlave(llave: string, nombre: string, uso: 'lectura' | 'alta', escritura: boolean) {
  const m = FORMATO.exec(llave);
  if (!m) {
    console.error(`[Instancia] ${nombre}: la llave no tiene el formato se_<12 hex>_<secreto>; no se registra`);
    return;
  }
  const prefijo = m[1];
  const hash = hashear(llave);
  const [f] = await pool.query<any[]>(`SELECT id, hash, revocada_en FROM api_keys WHERE prefijo = ?`, [prefijo]);
  const fila = (f as any[])[0];
  if (!fila) {
    await pool.query(
      `INSERT INTO api_keys (nombre, prefijo, hash, escritura, owner, uso) VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, prefijo, hash, escritura, env.INSTANCIA_OWNER, uso]);
    console.log(`[Instancia] ${nombre} registrada (se_${prefijo}_…)`);
  } else if (fila.hash !== hash && !fila.revocada_en) {
    // Mismo prefijo, otro secreto: alguien roto la llave en eyes.env.
    await pool.query(`UPDATE api_keys SET hash = ?, owner = ?, uso = ?, escritura = ? WHERE id = ?`,
      [hash, env.INSTANCIA_OWNER, uso, escritura, fila.id]);
    console.log(`[Instancia] ${nombre} actualizada (se_${prefijo}_…)`);
  }
}

async function primerAdministrador() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  const [u] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM users`);
  if (Number((u as any[])[0].n) > 0) return;
  const [r] = await pool.query<any[]>(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`);
  const rol = (r as any[])[0]?.id;
  if (!rol) { console.error('[Instancia] no existe el rol admin; no se crea el administrador'); return; }
  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role_id) VALUES (?, ?, ?, ?)`,
    [env.ADMIN_EMAIL, await bcrypt.hash(env.ADMIN_PASSWORD, 10), 'Administrador', rol]);
  console.log(`[Instancia] primer administrador creado: ${env.ADMIN_EMAIL}`);
}

/**
 * La llave de ESTA instancia (INSTANCIA_LLAVE): la de la propia empresa, con la
 * que su SPACE OS opera todo. Se reconoce por su prefijo, no por el dueño: otra
 * llave del mismo dueño (una de solo lectura para un tercero) no hereda esto.
 */
export function esLlaveDeLaInstancia(llave: { prefijo: string; owner: string | null; escritura: boolean; uso: string }) {
  if (!enModoInstancia() || !env.INSTANCIA_LLAVE) return false;
  const m = FORMATO.exec(env.INSTANCIA_LLAVE);
  return !!m && llave.prefijo === m[1] && llave.owner === env.INSTANCIA_OWNER && llave.escritura && llave.uso === 'lectura';
}

let operador: number | null = null;
/** El usuario con el que actua SPACE OS: el primer administrador activo. */
export async function operadorDeLaInstancia(): Promise<number | null> {
  if (operador) return operador;
  const [f] = await pool.query<any[]>(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.active = TRUE ORDER BY u.id LIMIT 1`);
  operador = (f as any[])[0]?.id ?? null;
  return operador;
}

/** Se llama al arrancar. Idempotente: correrlo en cada arranque no duplica nada. */
export async function prepararInstancia() {
  if (!enModoInstancia()) return;
  try {
    if (env.INSTANCIA_LLAVE) {
      await registrarLlave(env.INSTANCIA_LLAVE, `instancia ${env.INSTANCIA_OWNER}`, 'lectura', true);
    }
    if (env.INSTANCIA_TESTIGO) {
      await registrarLlave(env.INSTANCIA_TESTIGO, `testigo de alta ${env.INSTANCIA_OWNER}`, 'alta', false);
    }
    await primerAdministrador();
    console.log(`[Instancia] Space Eye de ${env.INSTANCIA_OWNER}`);
  } catch (e: any) {
    console.error('[Instancia] no se pudo preparar:', e.message);
  }
}
