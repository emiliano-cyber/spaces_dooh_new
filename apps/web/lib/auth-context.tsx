'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import type { AuthUser } from '@spaces-dooh/types'
import { setAccessToken } from './api-client'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'test-tenant'
const SESSION_KEY = 'spaces_session'

interface StoredSession {
  accessToken: string
  user: AuthUser
}

function saveSession(token: string, user: AuthUser) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: token, user }))
  } catch {}
}

function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    async function rehidrate() {
      try {
        // 1. Try sessionStorage first (survives full-page reloads, same tab)
        const stored = loadSession()
        if (stored) {
          // Verify the token is still valid via /auth/me
          const meRes = await fetch(`${BASE_URL}/auth/me`, {
            credentials: 'include',
            headers: {
              Authorization: `Bearer ${stored.accessToken}`,
              'x-tenant-slug': TENANT_SLUG,
            },
          })
          if (meRes.ok) {
            tokenRef.current = stored.accessToken
            setAccessToken(stored.accessToken)
            const userData: AuthUser = await meRes.json()
            setUser(userData)
            return
          }
          // Token expired — clear and fall through to cookie refresh
          clearSession()
        }

        // 2. Fallback: try refresh cookie
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-tenant-slug': TENANT_SLUG },
        })
        if (!refreshRes.ok) return

        const { accessToken } = await refreshRes.json()
        tokenRef.current = accessToken
        setAccessToken(accessToken)

        const meRes = await fetch(`${BASE_URL}/auth/me`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-slug': TENANT_SLUG },
        })
        if (!meRes.ok) return

        const userData: AuthUser = await meRes.json()
        saveSession(accessToken, userData)
        setUser(userData)
      } catch {
        // No active session — silently ignore
      } finally {
        setIsLoading(false)
      }
    }

    rehidrate()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-tenant-slug': TENANT_SLUG },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(err.error ?? 'Login failed')
    }

    const data: { accessToken: string; user: AuthUser } = await res.json()
    tokenRef.current = data.accessToken
    setAccessToken(data.accessToken)
    saveSession(data.accessToken, data.user)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-tenant-slug': TENANT_SLUG },
      })
    } finally {
      tokenRef.current = null
      setAccessToken(null)
      clearSession()
      setUser(null)
      router.push('/auth/login')
    }
  }, [router])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
