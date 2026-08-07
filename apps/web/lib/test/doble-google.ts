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
}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID_PRUEBA,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nonce: opts.nonce,
    email_verified: true,
    sub: opts.sub,
    email: opts.email,
    name: opts.nombre ?? 'Persona de Prueba',
  }
}

export async function arrancarDoble(): Promise<void> {
  if (servidor) return
  servidor = createServer((req, res) => {
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
    servidor!.once('error', falla)
    servidor!.listen(PUERTO_DOBLE, '127.0.0.1', listo)
  })
}

export async function pararDoble(): Promise<void> {
  if (!servidor) return
  const s = servidor
  servidor = null
  await new Promise<void>((listo) => s.close(() => listo()))
}
