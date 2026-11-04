import type { Idioma } from './idiomas'
import { traducir, type ClaveTexto } from './diccionario'
import { traducirError } from './errores-servidor'

// ============================================================================
//  lib/i18n/errores-acceso.ts — LOS FALLOS DE ENTRAR, EN EL IDIOMA DE LA PANTALLA.
// ----------------------------------------------------------------------------
//  Ola 5 (2026-11-03), encontrado en el recorrido en navegador: con el ingles
//  encendido, una contraseña equivocada pintaba «Correo o contraseña
//  inválidos» en la pantalla inglesa.
//
//  Las rutas de acceso (`app/api/auth/login`, `auth/forgot`, `signup`)
//  responden su JSON a mano, sin pasar por `respuestaError()`, que es donde el
//  servidor traduce. Son zona ROJA (sesion), asi que no se tocan: se traduce
//  AQUI, en la pantalla, al pintar el error. El español de entrada sale
//  identico (es la fuente), y lo que no se conoce pasa por `traducirError`,
//  que cubre el catalogo del servidor y, si tampoco lo conoce, lo deja tal
//  cual en vez de inventar.
// ============================================================================

const EXACTOS: Record<string, ClaveTexto> = {
  'Correo o contraseña inválidos': 'login.error.credenciales',
  'Correo y contraseña requeridos': 'login.error.faltan-datos',
  'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.': 'login.error.sin-conexion',
  'Esta cuenta entra con Google. Usa el botón de Google, o un código de recuperación si perdiste el acceso a esa cuenta.':
    'login.error.solo-google',
  'El registro de cuentas nuevas está deshabilitado. Contacta al administrador.': 'login.error.registro-apagado',
  'La recuperación de contraseña está deshabilitada temporalmente. Contacta al administrador.':
    'login.error.recuperacion-apagada',
  'No se pudo iniciar sesión': 'login.error.iniciar-sesion',
  // Ola 6 (menor A del validador de la ola 5).
  'Cuerpo inválido': 'login.error.cuerpo-invalido',
  'Falta el enlace de restablecimiento.': 'login.error.falta-enlace',
}

// Los dos limites de intentos llevan la espera en segundos dentro.
const DEMASIADOS: Array<[RegExp, ClaveTexto]> = [
  [/^Demasiados intentos\. Espera (\d+)s e intenta de nuevo\.$/, 'login.error.demasiados'],
  [/^Demasiados intentos\. Espera (\d+)s\.$/, 'login.error.demasiados-corto'],
]

/** El mensaje de un fallo de acceso, en el idioma de la pantalla. En español, tal cual. */
export function mensajeDeAcceso(mensaje: string, idioma: Idioma): string {
  if (idioma === 'es') return mensaje
  const clave = EXACTOS[mensaje]
  if (clave) return traducir(idioma, clave)
  for (const [re, c] of DEMASIADOS) {
    const m = re.exec(mensaje)
    if (m) return traducir(idioma, c, { s: m[1] })
  }
  return traducirError(mensaje, idioma)
}

/**
 * El aviso tras pedir el enlace de recuperar la contrasena. Lo escribe
 * `app/api/auth/forgot` en espanol (zona roja: no se toca) y la pantalla lo
 * pintaba tal cual. En el recorrido del italiano (04/11) salia «Si el correo
 * está registrado…» con la pantalla en italiano: en italiano se pinta el del
 * diccionario, que dice lo mismo. En espanol, el del servidor de siempre; en
 * ingles tambien, por la regla de esta pasada (no cambiar su HTML) — anotado
 * en docs/i18n/revision-italiano-recorrido.md.
 */
export function avisoDeEnlaceEnviado(mensajeDelServidor: string | undefined, idioma: Idioma): string {
  if (idioma === 'it') return traducir(idioma, 'login.aviso-generico')
  return mensajeDelServidor ?? traducir(idioma, 'login.aviso-generico')
}
