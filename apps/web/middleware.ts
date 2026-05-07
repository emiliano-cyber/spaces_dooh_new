import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Must match basePath in next.config.mjs
const BASE_PATH = '/spaces-dooh'

const moduleMap: Record<string, string> = {
  inmuebles: '/inmuebles',
  operaciones: '/operaciones',
  comercial: '/comercial',
  admin: '/admin',
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

  // Auth and portal routes are always public
  const isPublic =
    normalizedPath.startsWith('/auth/') ||
    normalizedPath.startsWith('/portal/') ||
    normalizedPath === '/auth/login' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')

  // In development: skip subdomain logic, only enforce cookie guard
  if (!isDev) {
    const subdomain = extractSubdomain(host)
    if (subdomain && moduleMap[subdomain]) {
      const url = request.nextUrl.clone()
      // Rewrite internally: admin.example.com/foo → /admin/foo
      // Use normalizedPath so the rewrite target doesn't double-include basePath
      if (!normalizedPath.startsWith(moduleMap[subdomain])) {
        url.pathname = BASE_PATH + moduleMap[subdomain] + normalizedPath
        return NextResponse.rewrite(url)
      }
    }
  }

  // Cookie guard: require spaces_rt for protected routes
  // In development, skip — the API runs on a different port (3001) so the
  // browser never attaches the spaces_rt cookie to requests to port 3000.
  // Auth is enforced at the layout level via sessionStorage instead.
  if (!isDev && !isPublic) {
    const hasSession = request.cookies.has('spaces_rt')
    if (!hasSession) {
      const loginUrl = request.nextUrl.clone()
      // nextUrl already applies basePath on serialization — don't add it manually
      loginUrl.pathname = '/auth/login'
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
