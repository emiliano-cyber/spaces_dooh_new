import { describe, it, expect, afterEach, vi } from 'vitest'
import { cookieSecure, cookieSesion, cookieCsrf } from './auth'

// ============================================================================
//  Hardening 1 · Bloque E — Secure por default en prod + cookie CSRF legible.
//  El valor de `secure` se decide en runtime (no en import), así que basta con
//  mutar process.env dentro de cada caso.
// ============================================================================

const setEnv = (nodeEnv: string, cookieSecureVar?: string) => {
  vi.stubEnv('NODE_ENV', nodeEnv)
  if (cookieSecureVar === undefined) vi.stubEnv('COOKIE_SECURE', '')
  else vi.stubEnv('COOKIE_SECURE', cookieSecureVar)
}

afterEach(() => vi.unstubAllEnvs())

describe('cookieSecure (E3)', () => {
  it('producción sin override → Secure ON', () => {
    setEnv('production')
    expect(cookieSecure()).toBe(true)
    expect(cookieSesion('t').secure).toBe(true)
  })

  it('producción con COOKIE_SECURE=0 → Secure OFF (escape hatch dev-local)', () => {
    setEnv('production', '0')
    expect(cookieSecure()).toBe(false)
  })

  it('desarrollo sin override → Secure OFF (no rompe HTTP local)', () => {
    setEnv('development')
    expect(cookieSecure()).toBe(false)
  })

  it('desarrollo con COOKIE_SECURE=1 → Secure ON', () => {
    setEnv('development', '1')
    expect(cookieSecure()).toBe(true)
  })
})

describe('cookieCsrf (E4)', () => {
  it('es legible por JS (httpOnly:false) para el double-submit', () => {
    const c = cookieCsrf('tok123')
    expect(c.httpOnly).toBe(false)
    expect(c.name).toBe('spaces_csrf')
    expect(c.sameSite).toBe('lax')
    expect(c.value).toBe('tok123')
  })

  it('la cookie de sesión SÍ es httpOnly (no la toca el CSRF)', () => {
    expect(cookieSesion('t').httpOnly).toBe(true)
    expect(cookieSesion('t').sameSite).toBe('lax')
  })
})
