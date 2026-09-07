// ============================================================================
//  comprobaciones.mjs — las tres preguntas que dicen si una instancia sirve.
// ----------------------------------------------------------------------------
//  Son las del criterio de aceptación de F5.6, que hasta el 2026-09-07 se
//  corrían a mano y cuyo resultado se quedaba en la pantalla de quien las
//  lanzaba. Ahora las corre el ejecutor y quedan DENTRO de la solicitud: un
//  alta cuyo resultado solo vive en un `journalctl` no es auditable tres
//  semanas después, y eso es exactamente lo que costó el defecto 27.
//
//  Qué dice cada una, porque el valor no está en el número:
//
//   · `login` 200      — nginx sirve y la aplicación responde.
//   · `signup` 503     — el autoregistro está CERRADO. Es la más importante de
//                        las tres: un 200 aquí significa que cualquiera se
//                        puede dar de alta en la instancia de un cliente.
//   · `login-post` 401 — la aplicación habla de verdad con SU base de datos.
//                        Un 500 sería que no llega a ella; un 200, que acabamos
//                        de entrar con credenciales inventadas.
//
//  >>> SE COMPRUEBAN SOBRE `http://`, NO SOBRE `https://`, y es a propósito:
//  >>> cuando el alta termina TODAVIA NO HAY CERTIFICADO --el vhost es de solo
//  >>> HTTP hasta que se emite--, asi que pedirlas por https daria un fallo de
//  >>> red y no diria nada de la aplicacion. Las mismas tres por https son la
//  >>> puerta 2 del paso del certificado, y esas van despues.
//
//  Sin dependencias, como todo `apps/flota`.
// ============================================================================

/** Lo que tiene que contestar cada una. Declarado aquí y en un solo sitio. */
export const ESPERADO = {
  login: 200,
  signup: 503,
  'login-post': 401,
}

/**
 * El correo del intento de login va a un dominio **reservado por la RFC 2606**:
 * no existe ni puede existir. No es un detalle de estilo — si esto llevara una
 * credencial de verdad, la comprobación sería un intento de acceso válido
 * registrado en la instancia de un cliente.
 */
const CORREO_IMPOSIBLE = 'nadie@no-existe.invalid'

const PREGUNTAS = {
  login: { ruta: '/spaces-dooh/login/' },
  signup: { ruta: '/spaces-dooh/api/signup/' },
  'login-post': {
    ruta: '/spaces-dooh/api/auth/login/',
    metodo: 'POST',
    cuerpo: JSON.stringify({ email: CORREO_IMPOSIBLE, password: 'no-es-una-clave' }),
  },
}

/**
 * Una sola pregunta. **Nunca lanza**: un fallo de red es `0`, la misma
 * convención que `curl -w '%{http_code}'` cuando no hubo respuesta.
 *
 * Que no lance es lo que importa: una comprobación que se lleva por delante a
 * las otras dos no informa, deja ciego.
 */
async function preguntar(base, def, pedir, esperaMs) {
  const opciones = { method: def.metodo ?? 'GET' }
  if (def.cuerpo) {
    opciones.body = def.cuerpo
    opciones.headers = { 'Content-Type': 'application/json' }
  }
  // `AbortSignal.timeout` puede no existir según el entorno; sin él la petición
  // depende del tiempo de espera de la red, que es peor pero no es un fallo.
  if (typeof AbortSignal?.timeout === 'function') {
    opciones.signal = AbortSignal.timeout(esperaMs)
  }
  try {
    const r = await pedir(`${base}${def.ruta}`, opciones)
    return Number(r?.status) || 0
  } catch {
    return 0
  }
}

/**
 * Las tres, en serie y contra `base` (p. ej. `http://ensayo4.space-os.io`).
 *
 * En serie y no en paralelo a propósito: son tres peticiones contra una máquina
 * que acaba de arrancar, y no hay ninguna prisa que justifique medir su
 * comportamiento bajo tres peticiones simultáneas.
 */
export async function comprobar(base, opciones = {}) {
  const { pedir = fetch, esperaMs = 5000 } = opciones
  const resultado = {}
  for (const [nombre, def] of Object.entries(PREGUNTAS)) {
    resultado[nombre] = await preguntar(base, def, pedir, esperaMs)
  }
  return resultado
}

/**
 * `{ ok, raras }` — y `raras` nombra las que no cuadran.
 *
 * Se devuelven los nombres en vez de un booleano suelto para no tener que
 * comparar tres números a ojo el día que haya que leerlo deprisa.
 */
export function veredicto(codigos = {}) {
  const raras = Object.keys(ESPERADO).filter((k) => codigos[k] !== ESPERADO[k])
  return { ok: raras.length === 0, raras }
}
