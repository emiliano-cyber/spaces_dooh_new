// backend/src/utils/llaveServicio.ts
// Generacion y comprobacion de las llaves de servicio (tabla api_keys).
//
// Formato:  se_<prefijo de 12>_<secreto de 43>
//
// El prefijo viaja en claro y es lo que se guarda para BUSCAR la fila; el
// secreto solo existe en el momento de crearla y despues vive como SHA-256. Es
// el mismo trato de un token de GitHub o de Stripe, y por la misma razon: se
// puede enseñar "se_a1b2c3d4e5f6…" en una pantalla sin revelar nada.
import crypto from 'crypto';
import { pool } from '../config/database';

const MARCA = 'se_';

export type LlaveServicio = {
  id: number;
  nombre: string;
  prefijo: string;
  escritura: boolean;
  // Alcance. null = ve la flota entera (el padre y nuestra propia operacion);
  // con valor, solo los equipos de ese dueno.
  owner: string | null;
  // 'lectura' consulta el espejo; 'alta' solo sirve para registrar un equipo.
  // Una credencial no puede hacer las dos cosas: ver el comentario de la
  // migracion 017.
  uso: 'lectura' | 'alta';
};

/** Crea una llave nueva. El secreto se devuelve UNA vez y no se guarda. */
export function generar(): { llave: string; prefijo: string; hash: string } {
  const prefijo = crypto.randomBytes(6).toString('hex');           // 12 caracteres
  const secreto = crypto.randomBytes(32).toString('base64url');     // 43 caracteres
  const llave = `${MARCA}${prefijo}_${secreto}`;
  return { llave, prefijo, hash: hashear(llave) };
}

export function hashear(llave: string): string {
  return crypto.createHash('sha256').update(llave).digest('hex');
}

/** Si el texto tiene pinta de llave de servicio (para no confundirla con un JWT). */
export function pareceLlave(texto: string): boolean {
  return texto.startsWith(MARCA);
}

// No se escribe `ultimo_uso` en cada peticion: una integracion que pregunta cada
// minuto convertiria una columna informativa en escritura constante. Con saber
// que se uso "en los ultimos minutos" alcanza para decidir si se puede revocar.
const GRACIA_MS = 5 * 60 * 1000;
const ultimoEscrito = new Map<number, number>();

/**
 * Busca la llave y comprueba el secreto. Devuelve null si no existe, si esta
 * revocada o si el secreto no cuadra — en los tres casos lo mismo, para no
 * decirle a quien prueba cual de los tres fue.
 */
export async function comprobar(llave: string): Promise<LlaveServicio | null> {
  // Se parte por el PRIMER separador, no por todos.
  //
  // El secreto es base64url y ese alfabeto incluye '_', asi que con
  // `split('_')` una llave de cada dos salia con tres trozos en vez de dos y se
  // rechazaba para siempre -con el mismo mensaje que una llave falsa, que es lo
  // que lo hacia dificil de ver-. Encontrado probando en local el 17-sep: de
  // tres llaves recien creadas, una no servia.
  const m = /^se_([0-9a-f]{12})_(.+)$/.exec(llave);
  if (!m) return null;
  const prefijo = m[1];

  const [filas] = await pool.query<any[]>(
    `SELECT id, nombre, prefijo, hash, escritura, owner, uso FROM api_keys
      WHERE prefijo = ? AND revocada_en IS NULL LIMIT 1`,
    [prefijo]
  );
  const fila = (filas as any[])[0];
  if (!fila) return null;

  // Comparacion de tiempo constante. Los dos son SHA-256 en hexadecimal, asi que
  // miden lo mismo y timingSafeEqual no puede lanzar por longitudes distintas.
  const esperado = Buffer.from(String(fila.hash));
  const recibido = Buffer.from(hashear(llave));
  if (esperado.length !== recibido.length) return null;
  if (!crypto.timingSafeEqual(esperado, recibido)) return null;

  const ahora = Date.now();
  if ((ultimoEscrito.get(fila.id) ?? 0) + GRACIA_MS < ahora) {
    ultimoEscrito.set(fila.id, ahora);
    pool.query(`UPDATE api_keys SET ultimo_uso = NOW() WHERE id = ?`, [fila.id])
      .catch(() => { /* el sello de uso nunca debe tumbar una peticion */ });
  }

  return {
    id: fila.id,
    nombre: fila.nombre,
    prefijo: fila.prefijo,
    escritura: !!fila.escritura,
    owner: fila.owner ?? null,
    uso: fila.uso === 'alta' ? 'alta' : 'lectura',
  };
}
