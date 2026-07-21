import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as bcrypt from 'bcryptjs'
import { app } from '../src/app'
import { publicPrisma, disconnectAll } from '../src/db/client'

const TENANT_SLUG = 'test-tenant'
const OWNER_EMAIL = 'test-owner@integration.com'
const OWNER_PASSWORD = 'TestPass123!'

function getRefreshToken(response: { cookies: Array<{ name: string; value: string }> }): string | null {
  return response.cookies.find((c) => c.name === 'spaces_rt')?.value ?? null
}

async function login(email = OWNER_EMAIL, password = OWNER_PASSWORD) {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { 'x-tenant-slug': TENANT_SLUG },
    payload: { email, password },
  })
}

beforeAll(async () => {
  await app.ready()

  let tenant = await publicPrisma.tenant.findUnique({ where: { subdominioBase: TENANT_SLUG } })
  if (!tenant) {
    tenant = await publicPrisma.tenant.create({
      data: { nombre: 'Test Tenant', subdominioBase: TENANT_SLUG, dbSchema: 'public' },
    })
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10)
  await publicPrisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: OWNER_EMAIL } },
    create: { tenantId: tenant.id, nombre: 'Integration Owner', email: OWNER_EMAIL, passwordHash, rolId: 'owner' },
    update: { passwordHash },
  })
})

afterAll(async () => {
  await app.close()
  await disconnectAll()
})

// ─── login ────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('login exitoso → accessToken y cookie spaces_rt', async () => {
    const res = await login()

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('accessToken')
    expect(typeof body.accessToken).toBe('string')
    expect(body).toHaveProperty('user')
    expect(body.user.rol).toBe('owner')

    const rt = getRefreshToken(res)
    expect(rt).toBeTruthy()
  })

  it('password incorrecto → 401', async () => {
    const res = await login(OWNER_EMAIL, 'wrong-password')
    expect(res.statusCode).toBe(401)
  })

  it('email inexistente → 401', async () => {
    const res = await login('nobody@nowhere.com', OWNER_PASSWORD)
    expect(res.statusCode).toBe(401)
  })
})

// ─── refresh ──────────────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('token válido → nuevo accessToken', async () => {
    const loginRes = await login()
    const rt = getRefreshToken(loginRes)!

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { 'x-tenant-slug': TENANT_SLUG, cookie: `spaces_rt=${rt}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('accessToken')
    expect(typeof body.accessToken).toBe('string')

    const newRt = getRefreshToken(res)
    expect(newRt).toBeTruthy()
    expect(newRt).not.toBe(rt)
  })

  it('token ya revocado → 401', async () => {
    const loginRes = await login()
    const rt = getRefreshToken(loginRes)!

    // primer refresh: rota el token
    await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { 'x-tenant-slug': TENANT_SLUG, cookie: `spaces_rt=${rt}` },
    })

    // segundo intento con el token revocado
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { 'x-tenant-slug': TENANT_SLUG, cookie: `spaces_rt=${rt}` },
    })

    expect(res.statusCode).toBe(401)
  })
})

// ─── logout ───────────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('logout → cookie limpiada, siguiente refresh con ese token → 401', async () => {
    const loginRes = await login()
    const rt = getRefreshToken(loginRes)!

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { 'x-tenant-slug': TENANT_SLUG, cookie: `spaces_rt=${rt}` },
    })
    expect(logoutRes.statusCode).toBe(200)

    // la cookie debe tener maxAge 0 (vacía o expirada)
    const clearedCookie = logoutRes.cookies.find((c) => c.name === 'spaces_rt')
    expect(clearedCookie?.value ?? '').toBe('')

    // refresh con el token revocado → 401
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { 'x-tenant-slug': TENANT_SLUG, cookie: `spaces_rt=${rt}` },
    })
    expect(refreshRes.statusCode).toBe(401)
  })
})

// ─── /auth/me ─────────────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  it('token válido → retorna user', async () => {
    const loginRes = await login()
    const { accessToken } = JSON.parse(loginRes.body)

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        'x-tenant-slug': TENANT_SLUG,
        authorization: `Bearer ${accessToken}`,
      },
    })

    expect(res.statusCode).toBe(200)
    const user = JSON.parse(res.body)
    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('tenantId')
    expect(user.rol).toBe('owner')
    expect(user.permisos).toContain('*')
  })

  it('sin token → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { 'x-tenant-slug': TENANT_SLUG },
    })
    expect(res.statusCode).toBe(401)
  })
})
