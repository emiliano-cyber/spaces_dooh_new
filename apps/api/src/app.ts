import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import tenantPlugin from './core/tenant/tenant.plugin'
import authPlugin from './core/auth/auth.plugin'
import authRoutes from './core/auth/auth.routes'
import usersRoutes from './modules/admin/users.routes'
import rolesRoutes from './modules/admin/roles.routes'
import inmueblesRoutes from './modules/inmuebles/sitios.routes'
import operacionesRoutes from './modules/operaciones/ots.routes'
import comercialRoutes from './modules/comercial/campanas.routes'
import trafficRoutes from './modules/digital/traffic.routes'
import portalRoutes from './modules/comercial/portal.routes'
import devRoutes from './modules/dev/dev.routes'
import adminExtRoutes from './modules/admin/admin.routes'
import { eventBus } from './core/events/event-bus'
import * as readinessService from './modules/comercial/readiness.service'
import { getPrismaForTenant, publicPrisma } from './db/client'
import { connection } from './jobs/queue'

// ── CORS origins ──────────────────────────────────────────────────────────────
function buildCorsOrigins() {
  // Explicit override via env var (e.g. CORS_ORIGIN=https://market.adavailable.com)
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  }
  if (process.env.NODE_ENV === 'production') {
    return [/https?:\/\/.*/]  // same-origin requests don't send Origin header, so this only matches real cross-origin requests
  }
  return ['http://localhost:3000', 'http://localhost:3001']
}
const allowedOrigins = buildCorsOrigins()

export async function buildApp(app: FastifyInstance): Promise<void> {
  // ── CORS (before everything) ────────────────────────────────────────────────
  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // ── Rate limiting (global, before routes) ──────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    // errorResponseBuilder must return an Error (it is thrown, not sent directly)
    errorResponseBuilder: (_req, context) => {
      const err = Object.assign(
        new Error(`Límite de requests alcanzado. Intenta en ${context.after}`),
        { statusCode: 429, expiresIn: context.ttl },
      )
      return err
    },
  })

  // ── Cookie & multipart ─────────────────────────────────────────────────────
  await app.register(cookie)
  await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } })

  // ── Tenant + auth ──────────────────────────────────────────────────────────
  await app.register(tenantPlugin)
  await app.register(authPlugin)

  // ── Global error handler ───────────────────────────────────────────────────
  app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode ?? 500

    // Rate limit
    if (statusCode === 429) {
      return reply.status(429).send({
        code: 429,
        error: 'Too Many Requests',
        message: error.message,
        expiresIn: error.expiresIn,
      })
    }

    // Prisma unique-constraint violation
    if (error.code === 'P2002') {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'Ya existe un registro con ese valor único',
        field: error.meta?.target,
      })
    }
    // Prisma record-not-found
    if (error.code === 'P2025') {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Registro no encontrado',
      })
    }
    // Zod / fastify validation errors
    if (statusCode === 400 && error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Datos inválidos',
        fields: error.validation,
      })
    }
    // Hide internals in production
    if (statusCode === 500 && process.env.NODE_ENV === 'production') {
      request.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Error interno del servidor',
      })
    }

    return reply.status(statusCode).send({
      error: error.name ?? 'Error',
      message: error.message,
    })
  })

  // ── Routes ─────────────────────────────────────────────────────────────────
  await app.register(authRoutes)
  await app.register(usersRoutes)
  await app.register(rolesRoutes)
  await app.register(inmueblesRoutes)
  await app.register(operacionesRoutes)
  await app.register(comercialRoutes)
  await app.register(trafficRoutes)
  await app.register(portalRoutes)
  await app.register(devRoutes)
  await app.register(adminExtRoutes)

  // ── Health checks ──────────────────────────────────────────────────────────
  app.get('/health', { config: { rateLimit: false } }, async (_req, reply) => {
    const checks: Record<string, unknown> = {}
    let degraded = false

    // Database
    try {
      const t0 = Date.now()
      await publicPrisma.$queryRaw`SELECT 1`
      checks.database = { status: 'ok', latencyMs: Date.now() - t0 }
    } catch {
      checks.database = { status: 'error', latencyMs: null }
      degraded = true
    }

    // Redis
    try {
      const t0 = Date.now()
      await connection.ping()
      checks.redis = { status: 'ok', latencyMs: Date.now() - t0 }
    } catch {
      checks.redis = { status: 'error', latencyMs: null }
      degraded = true
    }

    // Storage (skipped if credentials not configured)
    checks.storage = process.env.DO_SPACES_KEY
      ? { status: 'ok' }
      : { status: 'skipped' }

    return reply.status(200).send({
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      checks,
    })
  })

  app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    try {
      await Promise.all([
        publicPrisma.$queryRaw`SELECT 1`,
        connection.ping(),
      ])
      return reply.status(200).send({ status: 'ready' })
    } catch (err: any) {
      return reply.status(503).send({ status: 'not ready', error: err.message })
    }
  })

  // ── Event listeners ────────────────────────────────────────────────────────
  eventBus.on('ot.completada', async ({ otId: _otId, tenantId, campanaId }) => {
    if (!campanaId) return
    try {
      const tenant = await publicPrisma.tenant.findUnique({ where: { id: tenantId } })
      if (!tenant) return
      const prisma = getPrismaForTenant(tenant.dbSchema)
      await readinessService.check(prisma, campanaId, tenantId, 'system')
    } catch (err) {
      app.log.error(err, '[EventBus] ot.completada → readiness check failed')
    }
  })
}

// ── Test/CI singleton ──────────────────────────────────────────────────────────
// Each vitest worker gets its own module scope, so this is isolated per test file.
// server.ts creates its own Fastify instance with proper logger config.
export const app = Fastify({ logger: false })
buildApp(app).catch(console.error)
