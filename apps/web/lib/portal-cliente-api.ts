const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const TOKEN_KEY = 'portal_cliente_token'
const NOMBRE_KEY = 'portal_cliente_nombre'

export function getPortalToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setPortalSession(token: string, nombre: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(NOMBRE_KEY, nombre)
}

export function clearPortalSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(NOMBRE_KEY)
}

export function getPortalNombre(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(NOMBRE_KEY)
}

export async function portalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getPortalToken()
  const tenantSlug = typeof window !== 'undefined'
    ? (document.cookie.match(/tenant_slug=([^;]+)/)?.[1] ?? localStorage.getItem('tenant_slug') ?? 'market')
    : 'market'

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-slug': tenantSlug,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (res.status === 401) {
    clearPortalSession()
    if (typeof window !== 'undefined') window.location.href = '/spaces-dooh/portal/cliente/login'
    throw new Error('Sesión expirada')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).message ?? `Error ${res.status}`)
  }

  return res.json()
}
