// ============================================================================
//  acceso.mjs — quién puede ver el panel de flota.  (ADR 0026)
// ----------------------------------------------------------------------------
//  El panel NO valida sesiones y NO habla con ninguna base de datos. Toma la
//  cookie que el navegador ya manda —mismo dominio que el PADRE, así que llega
//  sola— y le pregunta al PADRE por loopback: `GET /api/auth/me`.
//
//  Eso es lo que compra el diseño entero:
//
//    · el panel no tiene credenciales de Postgres,
//    · no hay un segundo sitio donde crear usuarios ni del que revocarlos,
//    · un `logout` en el PADRE apaga también el panel,
//    · y la expiración de sesión se decide en UN solo sitio, el del producto.
//
//  El precio, aceptado por escrito en el ADR: si el 3000 está caído, aquí no
//  entra nadie. Se prefiere eso a repartir credenciales de base.
//
//  Sin dependencias, como todo `apps/flota`.
// ============================================================================

/** La cookie de sesión del producto (`apps/web/lib/server/auth.ts:15`). */
export const COOKIE_SESION = 'spaces_sesion'

/** Lo que hace falta para ver la flota. Decidido el 2026-09-04 (ADR 0026). */
export const MODULO = 'administracion'
export const ACCION = 'ver'

/** La ruta de la aplicación del PADRE que dice quién es una cookie. */
export const RUTA_ME = '/spaces-dooh/api/auth/me/'

/**
 * El valor de la cookie de sesión dentro de una cabecera `Cookie`, o `null`.
 *
 * Compara el nombre ENTERO y no por sufijo: `x_spaces_sesion=…` no es la cookie
 * de sesión, y confundirlas sería una forma de colar un token cualquiera.
 */
export function tokenDeCookies(cabecera) {
  if (!cabecera) return null
  for (const parte of String(cabecera).split(';')) {
    const trozo = parte.trim()
    const igual = trozo.indexOf('=')
    if (igual < 0) continue
    if (trozo.slice(0, igual).trim() !== COOKIE_SESION) continue
    const valor = trozo.slice(igual + 1).trim()
    return valor || null
  }
  return null
}

/**
 * La decisión, separada de la llamada para poder probarla sola.
 *
 * Fail-closed en todos los caminos: cualquier cosa que no sea un 200 con un
 * `permisos` de la forma esperada y `administracion` incluyendo `ver`, es un no.
 */
export function decideAcceso(status, datos) {
  if (status === 401) return { permitido: false, motivo: 'sin sesion' }
  if (status !== 200) return { permitido: false, motivo: `el PADRE respondio ${status}` }

  const permisos = datos && typeof datos === 'object' ? datos.permisos : null
  if (!permisos || typeof permisos !== 'object' || Array.isArray(permisos)) {
    return { permitido: false, motivo: 'respuesta del PADRE sin permisos' }
  }

  const acciones = permisos[MODULO]
  if (!Array.isArray(acciones) || !acciones.includes(ACCION)) {
    return { permitido: false, motivo: `sin permiso ${MODULO}:${ACCION}` }
  }

  return { permitido: true, usuario: datos.usuario ?? null }
}

/**
 * Pregunta al PADRE si esa cookie es alguien, y si ese alguien puede mirar.
 *
 * `fetch` y `urlPadre` entran por parámetro para poder probar sin red y sin
 * levantar nada.
 */
export async function verificarAcceso(cabeceraCookie, opciones = {}) {
  const { fetch: pedir = globalThis.fetch, urlPadre = 'http://127.0.0.1:3000' } = opciones

  const token = tokenDeCookies(cabeceraCookie)
  // Sin cookie no se molesta al PADRE: es un 401 que se puede contestar aquí.
  if (!token) return { permitido: false, motivo: 'sin cookie de sesion' }

  let respuesta
  try {
    respuesta = await pedir(`${urlPadre}${RUTA_ME}`, {
      // Se RECONSTRUYE la cabecera con el único valor que hace falta, en vez de
      // reenviar la del navegador tal cual: así ninguna otra cookie del
      // visitante viaja al PADRE por el camino de autenticación.
      headers: { cookie: `${COOKIE_SESION}=${token}` },
      redirect: 'manual',
    })
  } catch (e) {
    return { permitido: false, motivo: `el PADRE no contesto: ${e.message}` }
  }

  let datos = null
  try {
    datos = await respuesta.json()
  } catch {
    datos = null
  }
  return decideAcceso(respuesta.status, datos)
}
