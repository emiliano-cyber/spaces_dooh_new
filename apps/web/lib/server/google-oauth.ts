import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { AppError } from './errores'

// ============================================================================
//  lib/server/google-oauth.ts — ADR 0012 · Authorization Code + PKCE.
//
//  SIN DEPENDENCIAS NUEVAS, y es deliberado. El `id_token` se recibe por un
//  canal directo servidor-a-servidor con Google (TLS, autenticado con el client
//  secret), así que OIDC Core §3.1.3.7 punto 6 permite NO verificar la firma
//  JWT: basta decodificar el payload y validar sus campos. Eso ahorra `jose` o
//  `google-auth-library` — coherente con docs/DEPENDENCIAS.md.
//
//  OJO, y por eso está escrito aquí: esa exención vale SOLO para el token que
//  llega por el canal directo. Si algún día se añade el botón One Tap del
//  cliente (alternativa B del ADR), ese `id_token` llega POR EL NAVEGADOR y hay
//  que verificar la firma contra el JWKS de verdad. No reutilizar
//  `validarClaims()` para eso sin añadir la verificación de firma.
// ============================================================================

const AUTORIZACION = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const EMISORES = new Set(['accounts.google.com', 'https://accounts.google.com'])

// Solo identidad. NINGÚN scope de Gmail, Drive o Calendar: pedirlos convertiría
// un login en un acceso a los datos del usuario.
const SCOPES = 'openid email profile'

// Margen de reloj al comparar `exp`. El token se acaba de emitir (lo canjeamos
// nosotros hace milisegundos), así que esto casi nunca actúa; está para que un
// droplet con el reloj ligeramente atrasado no rechace tokens válidos.
const MARGEN_RELOJ_SEG = 60

// ─── Interruptor ────────────────────────────────────────────────────────────
// GOOGLE_OAUTH=0 apaga la función EN EL SERVIDOR, no solo escondiendo el botón
// — misma lección que NEXT_PUBLIC_AUTOREGISTRO. Y NO lleva prefijo
// NEXT_PUBLIC_: con él, Next lo hornearía en el build y apagarlo exigiría
// recompilar, que es la trampa documentada para M11 en
// HABILITAR_M11_RECUPERAR_PASSWORD.txt.
//
// Sin credenciales tampoco se enciende: ofrecer el botón sin ellas lleva al
// usuario a un error de Google, que es peor que no ofrecerlo.
export function googleHabilitado(): boolean {
  if (process.env.GOOGLE_OAUTH === '0') return false
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? ''
}

// ─── Redirect URI ───────────────────────────────────────────────────────────
// LA BARRA FINAL NO ES UN DESCUIDO. `trailingSlash: true` en next.config.mjs
// alcanza también a las rutas /api: comprobado contra producción el 06/08/2026,
// `/spaces-dooh/api/estado` responde 308 y `/spaces-dooh/api/estado/` responde
// de verdad. Google NO sigue redirecciones en el callback, así que registrar la
// URI sin barra rompe el flujo con un fallo opaco.
//
// Se prefiere la variable explícita porque Google compara la URI CARÁCTER POR
// CARÁCTER contra la registrada en Cloud Console: deducirla del request detrás
// de nginx (protocolo, host, puerto) es justo donde se cuelan las diferencias.
export function redirectUri(req: Request): string {
  const explicito = process.env.GOOGLE_REDIRECT_URI
  if (explicito) return explicito
  const base = process.env.APP_URL || new URL(req.url).origin
  return `${base}/spaces-dooh/api/auth/google/callback/`
}

// ─── Cookies de un solo uso del flujo ───────────────────────────────────────
// Viven aquí y no en la ruta que las emite: el callback también las necesita, y
// que una ruta importe de otra hace que cargar una evalúe la otra. Un nombre
// distinto en cada sitio dejaría el flujo roto sin que nada fallara.
export const COOKIE_ESTADO = 'g_state'
export const COOKIE_NONCE = 'g_nonce'
export const COOKIE_VERIFIER = 'g_verifier'
// Nombre de la organización cuando el flujo es un ALTA de empresa. Va en cookie
// httpOnly y no en el `state` porque el `state` viaja por Google y vuelve por la
// URL: ahí lo vería —y podría cambiarlo— cualquiera que mire la barra de
// direcciones. Su presencia es además lo que distingue «entrar» de «darse de
// alta», así que decidirlo desde la URL de vuelta sería dejar que el visitante
// eligiera qué operación ejecuta el servidor.
export const COOKIE_ALTA_ORG = 'g_alta_org'

// El auto-registro se apaga con NEXT_PUBLIC_AUTOREGISTRO=0. El alta de empresa
// con Google cuelga del MISMO interruptor y se comprueba en el SERVIDOR, igual
// que `/api/signup`: si no, esconder el botón dejaría abierta una segunda
// puerta al mismo sitio — y el mismo despliegue sirve la demo pública y
// producción sobre la misma base.
export function autoregistroHabilitado(): boolean {
  return process.env.NEXT_PUBLIC_AUTOREGISTRO !== '0'
}

// ─── PKCE ───────────────────────────────────────────────────────────────────
// Protege contra la intercepción del `code`: quien lo robe no puede canjearlo
// sin el `verifier`, que nunca sale de nuestro servidor (viaja en una cookie
// httpOnly del propio navegador y vuelve al canjearlo).
export function nuevoVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function challengeDe(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function nuevoEstado(): string {
  return randomBytes(32).toString('base64url')
}

// ─── 1. A dónde mandamos al usuario ─────────────────────────────────────────
export function urlDeConsentimiento(opts: {
  redirectUri: string
  state: string
  nonce: string
  codeChallenge: string
  // `prompt=login` fuerza a Google a re-pedir credenciales aunque haya sesión
  // viva. No se usa en la entrega 1; queda para la reautenticación (entrega 2).
  forzarLogin?: boolean
}): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state: opts.state,
    nonce: opts.nonce,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
    // Sin refresh token: no accedemos a nada de Google después del login, así
    // que pedir acceso offline sería guardar un permiso que no se usa.
    access_type: 'online',
  })
  if (opts.forzarLogin) {
    p.set('prompt', 'login')
    p.set('max_age', '0')
  }
  return `${endpointAutorizacion()}?${p.toString()}`
}

// ─── 2. Canje del código por el id_token ────────────────────────────────────
// Los dos endpoints de Google son configurables SOLO para poder apuntarlos a un
// doble local: el arnés levanta un Next real y no puede hablar con Google
// (consecuencia negativa anotada en el ADR).
//
// SOLO SE ACEPTA UN DESTINO EN LOOPBACK, y esto no es celo de más. Sin el
// filtro, quien pudiera fijar una variable de entorno apuntaría el canje a un
// servidor suyo y le devolvería a la aplicación un `id_token` para CUALQUIER
// correo: el callback lo daría por bueno —viene por «canal directo», que es
// justo la premisa que permite no verificar la firma— y abriría sesión como esa
// persona. Con el filtro, lo peor que consigue es apuntar a su propia máquina.
//
// Se comprueba el host y no `NODE_ENV`, porque el arnés arranca el servidor con
// NODE_ENV=production a propósito (para probar el build real): filtrar por eso
// dejaría las pruebas sin doble o el guard sin efecto donde importa.
function endpointLocalPermitido(valor: string | undefined, real: string): string {
  if (!valor) return real
  try {
    const h = new URL(valor).hostname
    if (h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]') return valor
  } catch {
    /* URL inválida: se ignora y se usa el real */
  }
  console.warn('[google] se ignora un endpoint sustituto que no es local:', valor)
  return real
}

function endpointToken(): string {
  return endpointLocalPermitido(process.env.GOOGLE_TOKEN_ENDPOINT, TOKEN)
}

// Mismo trato para la pantalla de consentimiento. Existe para poder recorrer el
// flujo entero en el navegador sin credenciales de Google; en producción se
// ignora igual salvo que apunte a la propia máquina.
function endpointAutorizacion(): string {
  return endpointLocalPermitido(process.env.GOOGLE_AUTH_ENDPOINT, AUTORIZACION)
}

export async function canjearCodigo(opts: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<string> {
  const r = await fetch(endpointToken(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code,
      client_id: clientId(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: opts.codeVerifier,
    }),
  })
  if (!r.ok) {
    // El cuerpo de Google puede traer el client_secret de vuelta en algunos
    // errores de configuración: se registra el estado, NO el cuerpo.
    console.error('[google] canje de código falló con estado', r.status)
    throw new AppError('No se pudo completar el acceso con Google.', 502)
  }
  const j = (await r.json().catch(() => null)) as { id_token?: unknown } | null
  if (!j || typeof j.id_token !== 'string' || !j.id_token) {
    throw new AppError('Google no devolvió una identidad utilizable.', 502)
  }
  return j.id_token
}

// ─── 3. Validación de claims ────────────────────────────────────────────────
export interface IdentidadGoogle {
  sub: string
  email: string
  nombre: string | null
}

// Decodifica el payload de un JWT SIN verificar la firma. Ver la cabecera del
// archivo: sólo es admisible para el token que llega por el canal directo.
export function decodificarPayload(idToken: string): unknown {
  const partes = idToken.split('.')
  if (partes.length !== 3) throw new AppError('La identidad de Google no tiene el formato esperado.', 502)
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'))
  } catch {
    throw new AppError('La identidad de Google no se pudo leer.', 502)
  }
}

// `aud` puede ser una cadena o un arreglo (OIDC lo permite; Google manda
// cadena). Se aceptan las dos formas, pero el arreglo tiene que contener
// nuestro client id.
function audCoincide(aud: unknown, esperado: string): boolean {
  if (typeof aud === 'string') return aud === esperado
  if (Array.isArray(aud)) return aud.some((a) => a === esperado)
  return false
}

export function validarClaims(
  payload: unknown,
  opts: { clientId: string; nonce: string; ahoraMs?: number },
): IdentidadGoogle {
  const p = payload as Record<string, unknown> | null
  if (!p || typeof p !== 'object') throw new AppError('La identidad de Google llegó vacía.', 502)

  if (typeof p.iss !== 'string' || !EMISORES.has(p.iss)) {
    throw new AppError('La identidad no la emitió Google.', 401)
  }
  if (!audCoincide(p.aud, opts.clientId)) {
    // Sin esto, un id_token emitido para OTRA aplicación de Google serviría
    // para entrar aquí.
    throw new AppError('La identidad de Google no es para esta aplicación.', 401)
  }
  const ahoraSeg = Math.floor((opts.ahoraMs ?? Date.now()) / 1000)
  if (typeof p.exp !== 'number' || p.exp + MARGEN_RELOJ_SEG <= ahoraSeg) {
    throw new AppError('La identidad de Google expiró. Vuelve a intentarlo.', 401)
  }
  // El nonce ata este token a ESTA petición: sin él, un id_token capturado
  // antes podría reproducirse.
  if (typeof p.nonce !== 'string' || p.nonce !== opts.nonce) {
    throw new AppError('La respuesta de Google no corresponde a esta solicitud.', 401)
  }

  // ── email_verified: estricto, y es LA barrera ──────────────────────────────
  // Al renunciar a GOOGLE_HD (decisión 5 del ADR), esta comprobación es lo
  // ÚNICO que impide que alguien vincule la cuenta de otro dándose de alta en
  // Google con su correo. No se relaja por ningún motivo.
  //
  // Se exige el booleano true, no un valor "parecido a verdadero": la cadena
  // "false" es verdadera en JavaScript, así que un `if (p.email_verified)`
  // dejaría pasar exactamente el caso que hay que cortar. Se distingue el
  // string en el mensaje para que un fallo real sea diagnosticable y no un
  // misterio.
  if (typeof p.email_verified === 'string') {
    throw new AppError('Google devolvió la verificación del correo en un formato inesperado.', 502)
  }
  if (p.email_verified !== true) {
    throw new AppError('Esa cuenta de Google no tiene el correo verificado.', 401)
  }

  if (typeof p.sub !== 'string' || !p.sub) {
    throw new AppError('La identidad de Google no trae identificador.', 502)
  }
  if (typeof p.email !== 'string' || !p.email) {
    throw new AppError('La identidad de Google no trae correo.', 502)
  }

  return {
    sub: p.sub,
    email: p.email,
    nombre: typeof p.name === 'string' && p.name ? p.name : null,
  }
}
