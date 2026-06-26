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

// Lee el rastro desde el valor del param `from` (string de la URL).
export function parseTrail(from: string | null | undefined): Crumb[] {
  if (!from) return []
  try {
    const arr = JSON.parse(decodeURIComponent(from))
    if (Array.isArray(arr)) {
      return arr.filter((c) => c && typeof c.label === 'string')
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
