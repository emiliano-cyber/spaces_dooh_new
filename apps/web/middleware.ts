import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  // Auth and portal routes are always public
  const isPublic =
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/portal/') ||
    pathname === '/auth/login' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')

  // In development: skip subdomain logic, only enforce cookie guard
  if (!isDev) {
    const subdomain = extractSubdomain(host)
    if (subdomain && moduleMap[subdomain]) {
      const url = request.nextUrl.clone()
      // Rewrite internally: admin.example.com/foo → /admin/foo
      if (!pathname.startsWith(moduleMap[subdomain])) {
        url.pathname = moduleMap[subdomain] + pathname
        return NextResponse.rewrite(url)
      }
    }
  }

  // Cookie guard: require spaces_rt for protected routes
  if (!isPublic) {
    const hasSession = request.cookies.has('spaces_rt')
    if (!hasSession) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/auth/login'
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
