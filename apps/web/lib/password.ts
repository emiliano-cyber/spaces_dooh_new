// ============================================================================
//  lib/password.ts — La política de contraseñas, en un solo sitio.
// ----------------------------------------------------------------------------
//  Vivía en `lib/server/auth.ts`, con un comentario que la llamaba «único
//  origen de verdad». No lo era: `auth.ts` es `server-only`, así que ningún
//  formulario podía importarla y cada uno reimplementaba la regla a ojo. El
//  resultado, medido el 10/08:
//
//    · el registro PÚBLICO habilitaba el botón a los 6 caracteres y prometía
//      «mínimo 6» en el marcador de posición, mientras el servidor exigía 8 con
//      letra y número. Se tecleaba una contraseña, se pulsaba «Crear cuenta» y
//      salía un 400 — en la primera pantalla de un registro abierto a internet;
//    · los otros tres formularios pedían 8 pero no comprobaban ni letra ni
//      número, así que «aaaaaaaa» pasaba el filtro del navegador y rebotaba
//      igual en el servidor.
//
//  Aquí no hay nada de servidor, así que el navegador puede usar EXACTAMENTE la
//  misma función. `auth.ts` la reexporta para no tocar sus doce llamadores.
//
//  Sigue validándose en el servidor, por supuesto: esto adelanta el mensaje, no
//  sustituye la comprobación.
// ============================================================================

// ─── El MOTIVO, aparte del mensaje (I18N-01, 2026-09-30) ────────────────────
//
// `validarPassword` devuelve una frase en español, y esa frase se enseña tal
// cual. Con la interfaz en dos idiomas eso deja de bastar: el formulario de
// acceso tiene que poder decir lo mismo en inglés sin que el servidor cambie.
//
// La salida es doble a propósito, y en este orden:
//
//   · `motivoPassword` devuelve un CÓDIGO — el dato, estable, traducible;
//   · `validarPassword` lo convierte en la frase en español de siempre.
//
// `validarPassword` NO cambia de firma ni de texto: la usan el servidor
// (`lib/server/auth.ts` la reexporta para sus doce llamadores) y otros tres
// formularios, y ninguno se entera de esto. Lo nuevo es aditivo.
export type MotivoPassword = 'corta' | 'sin-letra' | 'sin-numero' | 'con-espacios'

export function motivoPassword(plano: unknown): MotivoPassword | null {
  const p = typeof plano === 'string' ? plano : ''
  if (p.length < 8) return 'corta'
  if (!/[a-zA-Z]/.test(p)) return 'sin-letra'
  if (!/[0-9]/.test(p)) return 'sin-numero'
  if (/\s/.test(p)) return 'con-espacios'
  return null
}

// Los mismos textos que había antes, palabra por palabra. Siguen viviendo aquí
// y no en el diccionario de i18n porque este módulo lo importa el SERVIDOR, que
// no tiene idioma de usuario: el servidor contesta en español (ver el informe
// I18N-01), y el navegador traduce por su cuenta a partir del código de arriba.
const MENSAJE_ES: Record<MotivoPassword, string> = {
  corta: 'La contraseña debe tener al menos 8 caracteres',
  'sin-letra': 'La contraseña debe incluir al menos una letra',
  'sin-numero': 'La contraseña debe incluir al menos un número',
  'con-espacios': 'La contraseña no puede contener espacios',
}

// Devuelve el motivo por el que NO vale, o null si vale. Los mensajes van en
// español y en segunda persona porque se enseñan tal cual al usuario.
export function validarPassword(plano: unknown): string | null {
  const motivo = motivoPassword(plano)
  return motivo ? MENSAJE_ES[motivo] : null
}

// Lo que se le promete al usuario ANTES de teclear. Se deriva de la función de
// arriba en el sentido que importa: si la política cambia, este texto está al
// lado y se ve que hay que cambiarlo. Un `placeholder` que promete menos de lo
// que se exige es la forma más barata de hacer fallar a alguien.
export const REGLA_PASSWORD = 'mínimo 8, con letra y número'
