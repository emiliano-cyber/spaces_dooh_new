import { describe, it, expect, vi, afterEach } from 'vitest'

// ============================================================================
//  La cookie `spaces_tenant_activo` decide `Secure` con `cookieSecure()`.
// ----------------------------------------------------------------------------
//  El defecto (P9, abierto desde el 07/08, cerrado el 2026-10-05):
//  `app/api/tenant-activo/route.ts` ponía `secure: COOKIE_SECURE === '1'` en
//  vez de llamar a `cookieSecure()`, que es la fuente única de la decisión para
//  `spaces_sesion` y `spaces_csrf`. En producción SIN `COOKIE_SECURE`, el helper
//  cae a `NODE_ENV === 'production'` y da Secure; la ruta daba `false`. Las dos
//  cookies hermanas iban protegidas y ésta no, y una divergencia así no falla:
//  solo deja de proteger.
//
//  Se prueba el handler real con `exigir` y el acceso a tenants simulados; lo
//  que NO se simula es `cookieSecure()`, que es justo lo que se defiende.
// ============================================================================

vi.mock('@/lib/server/auth', async (original) => ({
  ...(await original<typeof import('@/lib/server/auth')>()),
  exigir: vi.fn(async () => ({ ok: true, usuario: { id: 'u1', rol: 'superadmin' } })),
}))

vi.mock('@/lib/server/tenant', () => ({
  TENANT_COOKIE: 'spaces_tenant_activo',
  puedeCambiarCrm: vi.fn(async () => true),
  listarTenants: vi.fn(async () => [{ id: 't-1', nombre: 'Org 1' }]),
}))

afterEach(() => vi.unstubAllEnvs())

async function cambiarA(tenantId: string) {
  const { POST } = await import('@/app/api/tenant-activo/route')
  return POST(
    new Request('http://127.0.0.1/api/tenant-activo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    }),
  )
}

describe('POST /api/tenant-activo · Secure de la cookie', () => {
  it('producción SIN COOKIE_SECURE → la cookie sale con Secure (como la de sesión)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('COOKIE_SECURE', '')
    const res = await cambiarA('t-1')
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('spaces_tenant_activo=t-1')
    expect(cookie).toMatch(/;\s*secure/i)
  })

  it('producción con COOKIE_SECURE=0 → sin Secure (la salida de emergencia del helper)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('COOKIE_SECURE', '0')
    const cookie = (await cambiarA('t-1')).headers.get('set-cookie') ?? ''
    expect(cookie).toContain('spaces_tenant_activo=t-1')
    expect(cookie).not.toMatch(/;\s*secure/i)
  })

  it('desarrollo sin COOKIE_SECURE → sin Secure (no rompe HTTP local)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('COOKIE_SECURE', '')
    const cookie = (await cambiarA('t-1')).headers.get('set-cookie') ?? ''
    expect(cookie).not.toMatch(/;\s*secure/i)
  })
})
