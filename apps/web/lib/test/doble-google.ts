import { createServer, type Server } from 'node:http'

// ============================================================================
//  lib/test/doble-google.ts — Un Google de mentira para las pruebas.
//
//  El ADR 0012 lo anota como consecuencia negativa: «las pruebas e2e no pueden
//  hablar con Google». Éste es el doble que lo resuelve. `google-oauth.ts`
//  permite apuntar el canje del código a otro endpoint con
//  GOOGLE_TOKEN_ENDPOINT, y esa variable existe SOLO para esto.
//
//  El doble NO valida nada: su trabajo es devolver el `id_token` que la prueba
//  le haya dejado preparado. Toda la lógica que importa —validar los claims,
//  resolver al usuario, abrir sesión— vive en la aplicación, que es lo que se
//  quiere ejercitar.
//
//  Además GUARDA el cuerpo de cada canje. Así la prueba puede comprobar que el
//  `code_verifier` de PKCE viaja de verdad: sin esa comprobación, quitar PKCE
//  del flujo no rompería ninguna prueba.
// ============================================================================

export const PUERTO_DOBLE = Number(process.env.PUERTO_DOBLE_GOOGLE ?? 3312)
export const ENDPOINT_DOBLE = `http://127.0.0.1:${PUERTO_DOBLE}/token`

// Credenciales de mentira. El `aud` del token tiene que coincidir con esto o la
// validación lo rechaza — que es justo una de las cosas que se prueban.
export const CLIENT_ID_PRUEBA = 'cliente-de-prueba.apps.googleusercontent.com'
export const CLIENT_SECRET_PRUEBA = 'secreto-de-prueba'

let servidor: Server | null = null
let siguiente: { idToken: string } | { estado: number } = { estado: 500 }
let ultimo: URLSearchParams | null = null

// Lo que el doble devolverá en el PRÓXIMO canje.
export function prepararIdToken(idToken: string): void {
  siguiente = { idToken }
}

// Para probar que un canje fallido no abre sesión.
export function prepararFallo(estado = 400): void {
  siguiente = { estado }
}

// El cuerpo del último canje, para comprobar qué mandó la aplicación.
export function ultimoCanje(): URLSearchParams | null {
  return ultimo
}

export function olvidarCanje(): void {
  ultimo = null
}

// Construye un `id_token` con los claims que se le pasen. La firma es texto
// suelto A PROPÓSITO: la aplicación no la verifica, porque el token llega por
// canal directo (OIDC Core §3.1.3.7 punto 6). Si algún día se añadiera la
// verificación de firma, estas pruebas empezarían a fallar — y eso es correcto,
// avisaría de que el doble se quedó corto.
export function idTokenFalso(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims)}.firma-que-nadie-verifica`
}

// Claims válidos por defecto; cada prueba pisa lo que necesite romper.
export function claimsBuenos(opts: {
  sub: string
  email: string
  nonce: string
  nombre?: string
  // Para quién se emite. Por defecto el cliente de prueba, pero la pantalla de
  // consentimiento pasa el `client_id` QUE RECIBE, igual que hace Google: si el
  // doble firmara siempre con el suyo, un servidor configurado con credenciales
  // reales rechazaría el token —correctamente— con «no es para esta
  // aplicación», y el fallo parecería del código y no del doble.
  aud?: string
}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: opts.aud ?? CLIENT_ID_PRUEBA,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nonce: opts.nonce,
    email_verified: true,
    sub: opts.sub,
    email: opts.email,
    name: opts.nombre ?? 'Persona de Prueba',
  }
}

// ─── Pantalla de consentimiento (solo para probar a mano en el navegador) ───
// Las pruebas automáticas no la usan: llaman al callback directamente. Existe
// para poder recorrer el flujo ENTERO haciendo clic, sin credenciales de Google
// y sin salir de la máquina. `GOOGLE_AUTH_ENDPOINT` apunta aquí, y
// `google-oauth.ts` solo acepta ese sustituto si es loopback.
export const AUTH_DOBLE = `http://127.0.0.1:${PUERTO_DOBLE}/auth`

// Con qué identidad se «entra». El correo tiene que existir como usuario ACTIVO
// en la base, porque Google NO da de alta: si no existe, el flujo termina —
// correctamente — en «esa cuenta no está dada de alta».
const EMAIL_DEMO = process.env.GOOGLE_DOBLE_EMAIL ?? 'duenio@alfa.test'
const SUB_DEMO = process.env.GOOGLE_DOBLE_SUB ?? 'sub-demo-local-0001'

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function paginaConsentimiento(url: URL): string {
  const redirect = url.searchParams.get('redirect_uri') ?? ''
  const state = url.searchParams.get('state') ?? ''
  const nonce = url.searchParams.get('nonce') ?? ''

  // Se prepara aquí el token porque es AHORA cuando se conoce el nonce que
  // emitió la aplicación. El callback lo exigirá igual al nonce de su cookie.
  // El `aud` sale del client_id recibido, no de una constante: así el doble
  // sirve igual con credenciales de prueba que con las reales.
  const aud = url.searchParams.get('client_id') ?? CLIENT_ID_PRUEBA
  prepararIdToken(idTokenFalso(claimsBuenos({ sub: SUB_DEMO, email: EMAIL_DEMO, nonce, aud })))

  const ok = `${redirect}?code=codigo-de-prueba&state=${encodeURIComponent(state)}`
  const no = `${redirect}?error=access_denied&state=${encodeURIComponent(state)}`
  return `<!doctype html><meta charset="utf-8"><title>Google de mentira</title>
<body style="font-family:system-ui;max-width:26rem;margin:15vh auto;text-align:center">
  <p style="color:#b45309;background:#fef3c7;padding:.6rem;border-radius:.4rem">
    Esto <b>no es Google</b>. Es el doble local para probar el flujo sin credenciales.
  </p>
  <h2 style="font-weight:600">Elige una cuenta</h2>
  <p style="color:#555">para continuar a <b>Space OS</b></p>
  <p><a href="${escapar(ok)}" style="display:block;padding:.8rem;border:1px solid #ccc;border-radius:.4rem;text-decoration:none;color:#111">
    ${escapar(EMAIL_DEMO)}
  </a></p>
  <p><a href="${escapar(no)}" style="color:#666;font-size:.9rem">Cancelar</a></p>
</body>`
}

export async function arrancarDoble(): Promise<void> {
  if (servidor) return
  servidor = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PUERTO_DOBLE}`)
    if (url.pathname === '/auth') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(paginaConsentimiento(url))
      return
    }
    let cuerpo = ''
    req.on('data', (c) => (cuerpo += c))
    req.on('end', () => {
      ultimo = new URLSearchParams(cuerpo)
      if ('estado' in siguiente) {
        res.writeHead(siguiente.estado, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid_grant' }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id_token: siguiente.idToken, token_type: 'Bearer' }))
    })
  })
  await new Promise<void>((listo, falla) => {
    servidor!.once('error', (e: NodeJS.ErrnoException) => {
      // Sin este mensaje, dejarse el doble SUELTO corriendo
      // (`node lib/test/doble-google-suelto.mts`) hace que este `beforeAll`
      // reviente y vitest SALTE las pruebas del fichero — y el resumen dice
      // «6 passed» sin más. Silencio que se lee como éxito, que es peor que un
      // rojo.
      if (e.code === 'EADDRINUSE') {
        falla(
          new Error(
            `El puerto ${PUERTO_DOBLE} ya está ocupado: seguramente tienes el doble suelto corriendo ` +
              `(lib/test/doble-google-suelto.mts). Páralo y vuelve a lanzar las pruebas, ` +
              `o cambia PUERTO_DOBLE_GOOGLE.`,
          ),
        )
        return
      }
      falla(e)
    })
    servidor!.listen(PUERTO_DOBLE, '127.0.0.1', listo)
  })
}

export async function pararDoble(): Promise<void> {
  if (!servidor) return
  const s = servidor
  servidor = null
  await new Promise<void>((listo) => s.close(() => listo()))
}
