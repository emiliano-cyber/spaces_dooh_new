import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Must match basePath in next.config.mjs
const BASE_PATH = '/spaces-dooh'

// Ruteo por subdominio. Los módulos del segundo frontend (inmuebles/operaciones/
// comercial/admin) se archivaron en /_archive (Bloque G), así que solo queda el
// portal externo, que sí es parte del producto vivo.
const moduleMap: Record<string, string> = {
  portal: '/portal',
}

function extractSubdomain(host: string): string | null {
  // Strip port
  const hostname = host.split(':')[0]
  const parts = hostname.split('.')
  // e.g. admin.westmedia.spaces.com → parts[0] = 'admin'
  if (parts.length >= 3) return parts[0]
  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''
  const isDev = process.env.NODE_ENV === 'development' || host.includes('localhost')

  // Normalize pathname: strip basePath prefix so route checks work regardless
  // of whether Next.js includes it in request.nextUrl.pathname at runtime.
  const normalizedPath = pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length) || '/'
    : pathname

  // ─── CSRF (Hardening 1 · Bloque E): double-submit en mutaciones con sesión ──
  // Toda mutación del BFF autenticada por la cookie de sesión debe traer el
  // header X-CSRF-Token igual a la cookie spaces_csrf. Exentos: el bootstrap de
  // sesión (login/signup/logout) y las rutas PÚBLICAS por token (portal y
  // propuesta compartible), que no dependen de la cookie de sesión. Si no hay
  // cookie de sesión, no hay credencial ambiental que proteger: se deja pasar.
  const MUTACIONES = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
  if (normalizedPath.startsWith('/api/') && MUTACIONES.has(request.method)) {
    const exento =
      normalizedPath.startsWith('/api/auth/login') ||
      normalizedPath.startsWith('/api/signup') ||
      normalizedPath.startsWith('/api/auth/logout') ||
      normalizedPath.startsWith('/api/portal/') ||
      normalizedPath.startsWith('/api/propuestas/publica/')
    const sesion = request.cookies.get('spaces_sesion')?.value
    if (!exento && sesion) {
      const cookieTok = request.cookies.get('spaces_csrf')?.value
      const headerTok = request.headers.get('x-csrf-token')
      if (!cookieTok || !headerTok || cookieTok !== headerTok) {
        return NextResponse.json(
          { error: 'Falta el token CSRF o no coincide. Recarga la página e intenta de nuevo.' },
          { status: 403 },
        )
      }
    }
  }

  // Ruteo por subdominio (producción multi-subdominio): admin.x.com → /admin
  if (!isDev) {
    const subdomain = extractSubdomain(host)
    if (subdomain && moduleMap[subdomain]) {
      const url = request.nextUrl.clone()
      if (!normalizedPath.startsWith(moduleMap[subdomain])) {
        url.pathname = BASE_PATH + moduleMap[subdomain] + normalizedPath
        return NextResponse.rewrite(url)
      }
    }
  }

  // Rutas PÚBLICAS (sin sesión): el login, las ligas compartibles (propuesta
  // /demo/p/… y portal de campaña /demo/portal/…), las APIs (que se auto-protegen)
  // y los assets. Cualquier OTRA ruta exige haber iniciado sesión.
  const publico =
    normalizedPath.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    normalizedPath === '/demo/login' ||
    normalizedPath.startsWith('/demo/login/') ||
    normalizedPath.startsWith('/demo/p/') ||
    normalizedPath.startsWith('/demo/portal/') ||
    normalizedPath.startsWith('/auth/') ||
    normalizedPath.startsWith('/portal/')

  // Gate: sin cookie de sesión → redirige al login (no expone ninguna otra ruta).
  if (!publico && !request.cookies.has('spaces_sesion')) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/demo/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
