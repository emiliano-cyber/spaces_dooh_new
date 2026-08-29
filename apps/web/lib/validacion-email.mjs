// ============================================================================
//  La regla del correo, en UN solo sitio.
// ----------------------------------------------------------------------------
//  Estructura básica usuario@dominio.tld (p. ej. ejemplo@correo.com): un @, sin
//  espacios, y un dominio con punto. Así no se permiten "cosas raras" (sin @,
//  sin dominio, etc.).
//
//  Vive en `.mjs` y no en `validacion.ts` porque tiene DOS consumidores que no
//  comparten cargador: la aplicación (TypeScript, vía `validacion.ts`) y
//  `scripts/bootstrap-auth.mjs`, que corre con `node` a pelo en el droplet, sin
//  Next y sin compilar nada. Es el mismo patrón que `password-temporal.mjs`, y
//  por el mismo motivo: mientras la regla estuvo solo del lado TypeScript, el
//  alta de una instancia no podía usarla y acabó sin validar nada.
//
//  Defecto ⑥ del arranque del PADRE (2026-08-21): el alta creó al Dueño con el
//  correo literal `<el correo de Google del Dueño>`. Por la pantalla eso era
//  imposible; por el alta de una instancia, no — y es la cuenta de máximo
//  privilegio.
// ============================================================================
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function esEmailValido(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim())
}

export const EMAIL_INVALIDO = 'Correo inválido. Usa el formato ejemplo@correo.com'
