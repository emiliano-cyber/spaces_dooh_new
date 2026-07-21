'use client'

// ============================================================================
//  lib/csrf-client.ts — Parche de `fetch` para el double-submit anti-CSRF
//  (Hardening 1 · Bloque E).
//
//  El BFF (middleware) exige el header X-CSRF-Token igual a la cookie
//  `spaces_csrf` en TODA mutación autenticada por sesión. Como las llamadas al
//  BFF están repartidas en muchos `*-api.ts` sin un chokepoint único, en vez de
//  tocar cada sitio se parchea `window.fetch` UNA vez: a toda petición
//  same-origin que muta (POST/PUT/PATCH/DELETE) se le añade el header con el
//  valor de la cookie. Las lecturas (GET/HEAD) y las peticiones cross-origin no
//  se tocan. Es idempotente.
// ============================================================================

const CSRF_COOKIE = 'spaces_csrf'
const CSRF_HEADER = 'x-csrf-token'
const MUTACIONES = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function leerCookie(nombre: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + nombre + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

function esMismoOrigen(url: string): boolean {
  if (url.startsWith('/')) return true // ruta relativa → mismo origen
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

let instalado = false

export function instalarCsrf(): void {
  if (instalado || typeof window === 'undefined') return
  instalado = true
  const original = window.fetch.bind(window)

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const metodo = (
        init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET') ?? 'GET'
      ).toUpperCase()

      if (esMismoOrigen(url) && MUTACIONES.has(metodo)) {
        const token = leerCookie(CSRF_COOKIE)
        if (token) {
          // Une los headers ya presentes (de init o del Request) y añade el CSRF
          // solo si no venía puesto explícitamente.
          const headers = new Headers(
            init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined),
          )
          if (!headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, token)
          return original(input, { ...init, headers })
        }
      }
    } catch {
      /* ante cualquier duda, no rompas la petición: cae al fetch original */
    }
    return original(input, init)
  }
}
