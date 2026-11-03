import { describe, it, expect } from 'vitest'
import { mensajeDeAcceso } from './errores-acceso'

// ============================================================================
//  Ola 5 · el recorrido en navegador con el ingles encendido: al equivocarse de
//  contraseña la pantalla de entrar decia «Correo o contraseña inválidos» en
//  una interfaz inglesa. Las rutas de acceso (`/api/auth/login`, `/forgot`,
//  `/signup`) responden su JSON sin pasar por `respuestaError()`, asi que su
//  texto llega siempre en español; y `lib/auth-real.ts` escribe dos mas en el
//  navegador. Estas rutas son zona ROJA (sesion): no se tocan. Se traduce en
//  la pantalla, al pintar el error.
// ============================================================================

const CASOS: Array<[string, string]> = [
  ['Correo o contraseña inválidos', 'Incorrect email or password'],
  ['Correo y contraseña requeridos', 'Email and password are required'],
  [
    'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
    'Could not reach the server. Check your connection and try again.',
  ],
  [
    'Esta cuenta entra con Google. Usa el botón de Google, o un código de recuperación si perdiste el acceso a esa cuenta.',
    'This account signs in with Google. Use the Google button, or a recovery code if you lost access to that account.',
  ],
  [
    'El registro de cuentas nuevas está deshabilitado. Contacta al administrador.',
    'New account sign-up is disabled. Contact your administrator.',
  ],
  [
    'La recuperación de contraseña está deshabilitada temporalmente. Contacta al administrador.',
    'Password recovery is temporarily disabled. Contact your administrator.',
  ],
  ['Demasiados intentos. Espera 30s e intenta de nuevo.', 'Too many attempts. Wait 30s and try again.'],
  ['Demasiados intentos. Espera 5s.', 'Too many attempts. Wait 5s.'],
  // Dos cifras: sin este caso sobrevivia el mutante que cambia la espera de varias cifras por una sola en el limite corto.
  ['Demasiados intentos. Espera 45s.', 'Too many attempts. Wait 45s.'],
  // Los que ya conoce el catalogo del servidor pasan por `traducirError`.
  [
    'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.',
    'The service is unavailable right now. Please try again in a few minutes.',
  ],
  ['No se pudo iniciar sesión', 'Could not sign in'],
]

describe('mensajeDeAcceso', () => {
  it.each(CASOS)('en ESPANOL «%s» sale letra por letra igual', (es) => {
    expect(mensajeDeAcceso(es, 'es')).toBe(es)
  })

  it.each(CASOS)('en INGLES «%s» → «%s»', (es, en) => {
    expect(mensajeDeAcceso(es, 'en')).toBe(en)
  })

  it('lo que no conoce lo deja tal cual (mejor que inventar)', () => {
    expect(mensajeDeAcceso('Algo raro que dijo el servidor', 'en')).toBe('Algo raro que dijo el servidor')
  })

  it('la cifra de espera no se confunde con otra: «Espera 3s.» no casa con la frase larga', () => {
    expect(mensajeDeAcceso('Demasiados intentos. Espera 3s.', 'en')).toBe('Too many attempts. Wait 3s.')
  })
})

// La pantalla de entrar y la de recuperar no se rinden con un error (sale tras
// un clic y un fetch): se fija que lo pinten por aqui.
describe('las pantallas de acceso pintan el error por mensajeDeAcceso', () => {
  it('entrar (los dos catch) y recuperar', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const raiz = path.resolve(__dirname, '..', '..')
    const login = readFileSync(path.join(raiz, 'app/(app)/login/page.tsx'), 'utf8')
    expect(login.match(/mensajeDeAcceso\(e\.message, idioma\)/g)).toHaveLength(2)
    const recuperar = readFileSync(path.join(raiz, 'app/(app)/recuperar/[token]/page.tsx'), 'utf8')
    expect(recuperar).toContain('mensajeDeAcceso(e.message, idioma)')
  })
})
