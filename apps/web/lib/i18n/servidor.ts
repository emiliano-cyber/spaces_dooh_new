import 'server-only'
import { cookies, headers } from 'next/headers'
import {
  resolverIdioma,
  inglesActivo,
  COOKIE_IDIOMA,
  IDIOMA_POR_OMISION,
  type Idioma,
} from './idiomas'

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

//  ─── Y POR QUE VA ENVUELTO EN UN `try` (I18N-05, 2026-09-30) ──────────────
//
//  Porque `cookies()` y `headers()` NO devuelven vacio fuera de una peticion:
//  LANZAN. Medido contra Next 14.2.29 el 2026-09-30:
//
//      Error: `cookies` was called outside a request scope.
//
//  Daba igual mientras el unico llamador era el layout raiz, que siempre corre
//  dentro de una peticion. Dejo de dar igual al entrar `respuestaError()`, que
//  corre EN EL `catch` DE CADA RUTA: sin la guardia, un error lanzado desde un
//  script, un trabajo de fondo o una prueba haria que el manejador de errores
//  lanzara OTRO error, y el original —el que de verdad importa— se perderia.
//
//  **El manejador de errores no puede ser una fuente de errores.** De ahi que
//  esto no lance nunca y caiga al espanol, que es lo que se servia antes de
//  todo esto.
//
//  Se capturan las dos lecturas por separado a proposito: si algun dia `cookies`
//  funcionara y `headers` no (o al reves), se aprovecha la que haya en vez de
//  tirar las dos.
function leerSeguro(leer: () => string | null): string | null {
  try {
    return leer()
  } catch {
    return null
  }
}

/**
 * El idioma de esta peticion.
 *
 * Pensado para un Server Component o un route handler. **Fuera de una peticion
 * no falla**: devuelve el idioma de omision.
 */
export function idiomaDeLaPeticion(): Idioma {
  // Con el inglés apagado (omisión desde el 2026-09-30, ver `inglesActivo` en
  // `idiomas.ts`) no se mira ni la cookie ni el navegador: SIEMPRE español. Es
  // el único sitio que decide el idioma —lo usan el layout raíz y
  // `respuestaError()`—, así que con esta línea se apagan las dos fuentes de
  // la mezcla a la vez.
  if (!inglesActivo()) return IDIOMA_POR_OMISION
  return resolverIdioma({
    cookie: leerSeguro(() => cookies().get(COOKIE_IDIOMA)?.value ?? null),
    cabecera: leerSeguro(() => headers().get('accept-language')),
  })
}
