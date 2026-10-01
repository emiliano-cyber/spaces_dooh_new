import 'server-only'
import { cookies, headers } from 'next/headers'
import { resolverIdioma, COOKIE_IDIOMA, type Idioma } from './idiomas'

// ============================================================================
//  lib/i18n/servidor.ts — LEER LAS DOS SENALES, Y NADA MAS.
// ----------------------------------------------------------------------------
//  Todo lo que este archivo hace es sacar dos cadenas de la peticion y
//  pasarselas a `resolverIdioma`. La regla vive en `idiomas.ts`, que es puro y
//  se puede probar; esto es el enchufe a Next.
//
//  ─── POR QUE AQUI Y NO EN EL MIDDLEWARE ────────────────────────────────────
//
//  `middleware.ts` es ARCHIVO DE ALTO CONTACTO y ahi viven el gate de sesion y
//  el double-submit anti-CSRF: todo lo que lo toca es ZONA ROJA y arrastra las
//  e2e. Y no hace ninguna falta — el middleware sirve para DESVIAR peticiones,
//  y aqui no se desvia nada: la misma URL responde en los dos idiomas.
//
//  Leer las cabeceras en el layout raiz da exactamente lo que se necesita —el
//  idioma resuelto ANTES de pintar el primer byte— sin tocar una linea del
//  middleware. Es la razon entera de que esta tarea no sea roja.
//
//  ─── LO QUE CUESTA, MEDIDO Y NO SUPUESTO ───────────────────────────────────
//
//  `cookies()` y `headers()` marcan el arbol como dinamico. Aqui eso no cambia
//  nada, y se comprobo antes de escribirlo: TODAS las paginas de este
//  repositorio cuelgan de `app/(app)/`, que ya declara
//  `export const dynamic = 'force-dynamic'` (`app/(app)/layout.tsx`) desde el
//  2026-08-26, para que `ORG_NOMBRE` se lea en cada arranque. Lo unico que
//  quedaba prerrenderizado fuera de ahi es `app/not-found.tsx`.
// ============================================================================

/**
 * El idioma de esta peticion. Solo se puede llamar desde un Server Component o
 * un route handler.
 */
export function idiomaDeLaPeticion(): Idioma {
  return resolverIdioma({
    cookie: cookies().get(COOKIE_IDIOMA)?.value ?? null,
    cabecera: headers().get('accept-language'),
  })
}
