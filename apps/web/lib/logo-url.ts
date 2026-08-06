// ============================================================================
//  lib/logo-url.ts — La URL del logo público de una organización.
//
//  Dos formas del mismo dato, y la diferencia no es cosmética:
//    · `rutaLogo`  — ruta absoluta del sitio. Para el NAVEGADOR (portal público
//      del cliente), que resuelve el origen solo.
//    · `urlLogo`   — URL completa con esquema y host. Para el CORREO, que se
//      abre fuera del sitio y no tiene desde dónde resolver una ruta.
//
//  Viven juntas para que el `basePath` esté escrito UNA vez: es el tipo de
//  literal que se copia a un segundo sitio y luego solo se actualiza en uno.
// ============================================================================

const BASE_PATH = '/spaces-dooh'

// LA BARRA FINAL NO SOBRA. La app corre con `trailingSlash`, así que sin ella
// la ruta responde 308 y redirige a la versión con barra. En el navegador eso
// no se nota —sigue la redirección solo—, pero esta URL viaja sobre todo
// DENTRO DE UN CORREO, y ahí un `<img>` que redirige depende de que el cliente
// (o el proxy de imágenes de Gmail) siga el 308. No todos lo hacen, y el modo
// de fallo es el mismo que esta ruta vino a evitar: un hueco donde va el logo.
//
// Encontrado desplegando: en local nunca aparece, porque `next dev` y el
// navegador tapan la redirección.
export function rutaLogo(token: string | null | undefined): string | null {
  if (!token) return null
  return `${BASE_PATH}/api/logo/${token}/`
}

export function urlLogo(base: string, token: string | null | undefined): string | null {
  const ruta = rutaLogo(token)
  if (!ruta || !base) return null
  return `${base.replace(/\/+$/, '')}${ruta}`
}
