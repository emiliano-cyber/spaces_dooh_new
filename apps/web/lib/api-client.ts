const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// In-memory token store — never touches localStorage
let _accessToken: string | null = null

export function setAccessToken(token: string | null) {
  _accessToken = token
}

export function getAccessToken(): string | null {
  return _accessToken
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = await res.json()
    _accessToken = data.accessToken
    return true
  } catch {
    return false
  }
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = '/auth/login'
  }
}

const TENANT_SLUG =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'test-tenant'
    : 'test-tenant'

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-slug': TENANT_SLUG,
    ...(options.headers as Record<string, string>),
  }

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh()
    if (!refreshed) {
      redirectToLogin()
      throw new Error('Session expired')
    }

    // Retry original request with new token
    const retryHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }
    if (_accessToken) retryHeaders['Authorization'] = `Bearer ${_accessToken}`

    const retryRes = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: retryHeaders,
    })

    if (!retryRes.ok) throw new Error(await retryRes.text())
    return retryRes.json() as Promise<T>
  }

  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}

export default apiFetch
