import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { etiquetaDeHost } from './lib/host'

// Must match basePath in next.config.mjs
const BASE_PATH = '/spaces-dooh'

// Ruteo por subdominio. Los módulos del segundo frontend (inmuebles/operaciones/
// comercial/admin) se archivaron en /_archive (Bloque G), así que solo queda el
// portal externo, que sí es parte del producto vivo.
const moduleMap: Record<string, string> = {
  portal: '/portal',
}

// ─── Las redirecciones van con `Location` RELATIVA ──────────────────────────
//
// Medido en la instancia `g500` el 2026-09-09: una ruta interna sin sesión
// contestaba `location: https://localhost:3000/spaces-dooh/login/` y el
// navegador se iba a `localhost`. No era nginx —la misma petición directa al
// contenedor con la cabecera `Host` correcta daba lo mismo— ni `APP_URL`, que
// estaba bien puesta.
//
// El mecanismo: `request.nextUrl` NO toma su origen de la cabecera `Host`, sino
// de la dirección donde escucha el propio servidor (`HOSTNAME` y `PORT` de la
// imagen, `Dockerfile:72-73`, que Next presenta como `localhost:3000`). Así que
// `NextResponse.redirect(request.nextUrl.clone())` mandaba al cliente a la
// dirección INTERNA del contenedor. En una instancia de cliente eso deja la
// aplicación inalcanzable salvo yendo a mano a `/login/`.
//
// Se descartaron las dos alternativas evidentes, y por qué importa:
//   · leer la cabecera `Host` — la controla quien hace la petición, y convertiría
//     este gate de sesión en un open redirect;
//   · `process.env.APP_URL` — el middleware corre en el runtime edge, donde
//     `process.env` puede quedar horneado en el BUILD. Sería el mismo error que
//     `HSTS` y `NEXT_PUBLIC_AUTOREGISTRO`: un valor POR INSTANCIA congelado en el
//     artefacto de toda la flota.
//
// Una `Location` relativa la resuelve el navegador contra la URL que ya tiene:
// sale correcta en cualquier dominio sin que la aplicación sepa cuál es. El RFC
// 7231 §7.1.2 las permite, y es lo que ya emite `next.config.mjs`.
//
// El `basePath` se antepone AQUÍ a propósito: lo hacía Next al redirigir con
// `nextUrl`, y al construir la cabecera a mano esa magia deja de aplicar.
// `trailingSlash: true` obliga a la barra final; sin ella Next añadiría otro
// salto para ponerla.
function redirigir(ruta: string, estado: 307 | 308, query = '') {
  const conBarra = ruta.endsWith('/') ? ruta : `${ruta}/`
  return new NextResponse(null, {
    status: estado,
    headers: { location: `${BASE_PATH}${conBarra}${query}` },
  })
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

  // Compatibilidad: se quitó el segmento '/demo' de las rutas de página. Las URLs
  // viejas /demo/* (bookmarks, correos de recuperar contraseña ya enviados,
  // deep-links) redirigen permanentemente a /* para no romperse.
  if (normalizedPath === '/demo' || normalizedPath.startsWith('/demo/')) {
    // El viejo dashboard vivía en /demo/ (la raíz del shell); ahora es /inicio.
    // El resto conserva su subruta ya sin el segmento '/demo'.
    const resto = normalizedPath.slice('/demo'.length)
    const destino = resto === '' || resto === '/' ? '/inicio' : resto
    return redirigir(destino, 308, request.nextUrl.search)
  }

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
      normalizedPath.startsWith('/api/auth/forgot') ||
      normalizedPath.startsWith('/api/auth/reset') ||
      normalizedPath.startsWith('/api/signup') ||
      normalizedPath.startsWith('/api/auth/logout') ||
      normalizedPath.startsWith('/api/portal/') ||
      // Firma pública del contrato: el arrendador no tiene sesión, así que no
      // hay cookie que proteger con CSRF. El token del enlace es la credencial.
      normalizedPath.startsWith('/api/firma/') ||
      normalizedPath.startsWith('/api/propuestas/publica/') ||
      // Arranque de una instancia recién aprovisionada (F5.2): no hay sesión
      // —la base está vacía—, así que no hay cookie que proteger. Su credencial
      // es `BOOTSTRAP_TOKEN`, y su cerrojo real es que `tenants` esté vacía.
      normalizedPath.startsWith('/api/bootstrap')
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

  // Ruteo por subdominio: portal.x.com → /portal. `etiquetaDeHost` (lib/host.ts)
  // descarta las IP literales, que la versión anterior confundía con subdominios
  // —entrar por 209.97.146.136 daba la etiqueta «209»—.
  if (!isDev) {
    const etiqueta = etiquetaDeHost(host)
    if (etiqueta && moduleMap[etiqueta]) {
      const url = request.nextUrl.clone()
      if (!normalizedPath.startsWith(moduleMap[etiqueta])) {
        url.pathname = BASE_PATH + moduleMap[etiqueta] + normalizedPath
        return NextResponse.rewrite(url)
      }
    }
  }

  // Rutas PÚBLICAS (sin sesión): el login, las ligas compartibles (propuesta
  // /p/… y portal de campaña /portal/…), las APIs (que se auto-protegen) y los
  // assets. Cualquier OTRA ruta exige haber iniciado sesión.
  const publico =
    normalizedPath.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    normalizedPath === '/login' ||
    normalizedPath.startsWith('/login/') ||
    normalizedPath.startsWith('/recuperar/') ||
    normalizedPath.startsWith('/p/') ||
    normalizedPath.startsWith('/firmar/') ||
    normalizedPath.startsWith('/portal/')

  // Gate: sin cookie de sesión → redirige al login (no expone ninguna otra ruta).
  if (!publico && !request.cookies.has('spaces_sesion')) {
    return redirigir('/login', 307, request.nextUrl.search)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
