import 'server-only'
import { cookieSecure } from './auth'
import { huellaDeSesion } from './huella-sesion'
import {
  COOKIE_IDIOMA_CUENTA,
  COOKIE_IDIOMA_MAX_AGE,
  valorCookieIdiomaCuenta,
  type Idioma,
} from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/idioma-cuenta.ts — la cookie que lleva la preferencia de idioma
//  de la CUENTA en cada petición (IDIOMA-USUARIO, 03/11).
// ----------------------------------------------------------------------------
//  La pone el servidor en los tres sitios donde nace una sesión (login con
//  contraseña, Google, código de recuperación) y en `PUT /api/perfil/idioma`;
//  la borra el logout. Por qué una cookie y no una consulta por petición: ver
//  la cabecera de «LA PREFERENCIA DE LA CUENTA» en `lib/i18n/idiomas.ts`.
// ============================================================================

export { huellaDeSesion } from './huella-sesion'

/**
 * Las opciones de `res.cookies.set` para la preferencia de esta sesión. Con
 * `null` (la persona sigue a su navegador) la BORRA: una cookie vieja de otra
 * preferencia no puede quedarse viva.
 */
export function cookieIdiomaCuenta(tokenSesion: string, idioma: Idioma | null) {
  const base = {
    name: COOKIE_IDIOMA_CUENTA,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cookieSecure(),
    path: '/',
  }
  if (!idioma) return { ...base, value: '', maxAge: 0 }
  return {
    ...base,
    value: valorCookieIdiomaCuenta(idioma, huellaDeSesion(tokenSesion)),
    maxAge: COOKIE_IDIOMA_MAX_AGE,
  }
}

/** Para el logout: borrarla sin saber qué tenía. */
export function cookieIdiomaCuentaBorrada() {
  return { name: COOKIE_IDIOMA_CUENTA, value: '', maxAge: 0, path: '/' }
}
