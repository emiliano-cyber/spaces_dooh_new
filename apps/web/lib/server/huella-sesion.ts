import 'server-only'
import { createHash } from 'node:crypto'

// ============================================================================
//  lib/server/huella-sesion.ts — un resumen del token de sesión que se puede
//  dejar en una cookie sin filtrar la sesión.
// ----------------------------------------------------------------------------
//  Lo usa la preferencia de idioma de la cuenta (IDIOMA-USUARIO, 03/11) para
//  atar `spaces_idioma_cuenta` a la sesión que la puso: al cambiar de sesión
//  —otra persona en el mismo navegador— la huella deja de casar y la cookie se
//  ignora. Ver `lib/i18n/idiomas.ts`.
//
//  Vive APARTE de `idioma-cuenta.ts` a propósito: lo importa
//  `lib/i18n/servidor.ts`, que a su vez importa `errores.ts` en cada ruta, y
//  aquí no puede colgar nada más pesado que `node:crypto` (ni `auth.ts`, ni la
//  base).
//
//  sha256 y no un HMAC: no autentica nada. Quien la falsifique solo cambia el
//  idioma de su propio navegador. Lo único que tiene que garantizar es que no
//  se pueda volver al token, y 128 bits de un sha256 lo garantizan.
// ============================================================================

// El nombre de la cookie de sesión. Es `SESSION_COOKIE` de `auth.ts`, repetido
// para no importar ese módulo desde aquí; `idioma-cuenta.test.ts` comprueba que
// son el mismo.
export const COOKIE_SESION = 'spaces_sesion'

export function huellaDeSesion(token: string): string {
  return createHash('sha256').update(`idioma:${token}`).digest('hex').slice(0, 32)
}
