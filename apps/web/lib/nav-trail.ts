import type { Crumb } from '@/components/demo/ui/Breadcrumbs'

// ============================================================================
//  lib/nav-trail.ts — Contexto de navegación ("de dónde vengo y cómo llegué").
//  La ruta de migas se serializa en el query param `from` para conservarla al
//  saltar de una pantalla a otra (p. ej. Operaciones → Ver OT, o Campaña → OT).
// ============================================================================

// Agrega el rastro de migas a un href como `?from=<trail codificado>`.
export function withTrail(href: string, trail: Crumb[]): string {
  if (!trail.length) return href
  const sep = href.includes('?') ? '&' : '?'
  return `${href}${sep}from=${encodeURIComponent(JSON.stringify(trail))}`
}

// Solo una ruta INTERNA: empieza por `/` y lo que sigue no es otra `/` ni `\`
// (el navegador lee `/\host` como `//host`, o sea otro sitio).
const RUTA_INTERNA = /^\/(?![/\\])/

// Lee el rastro desde el valor del param `from` (string de la URL).
//
// El `from` viene de la URL, o sea de quien mande el enlace, y su `href` se
// pinta como `<Link>` en «Volver» (SEG-21OCT, 21/10). Hasta ese día pasaba
// cualquier `href`: con `javascript:alert(1)` el clic ejecutaba código con la
// sesión de quien abría el enlace, y con `https://otro.sitio` lo mandaba fuera
// desde un botón de la aplicación. Toda miga legítima la arma `withTrail` con
// una ruta que empieza por `/`, así que un paso con otro `href` se descarta.
export function parseTrail(from: string | null | undefined): Crumb[] {
  if (!from) return []
  try {
    const arr = JSON.parse(decodeURIComponent(from))
    if (Array.isArray(arr)) {
      return arr.filter(
        (c) =>
          c &&
          typeof c.label === 'string' &&
          (c.href === undefined || (typeof c.href === 'string' && RUTA_INTERNA.test(c.href))),
      )
    }
  } catch {
    /* param malformado → sin rastro */
  }
  return []
}

// Lee el rastro directamente de la URL del navegador (cliente). Útil en páginas
// standalone que no quieren depender de useSearchParams/Suspense.
export function trailFromLocation(): Crumb[] {
  if (typeof window === 'undefined') return []
  return parseTrail(new URLSearchParams(window.location.search).get('from'))
}
