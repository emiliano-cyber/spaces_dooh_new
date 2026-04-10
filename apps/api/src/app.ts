import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
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
import { eventBus } from './core/events/event-bus'
import * as readinessService from './modules/comercial/readiness.service'
import { getPrismaForTenant, publicPrisma } from './db/client'

export const app = Fastify({ logger: true })

app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? process.env.NODE_ENV === 'development',
  credentials: true,
})

app.register(cookie)

// Multipart file uploads (max 500MB)
app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } })

// Tenant resolution (sets request.tenant + request.prisma)
app.register(tenantPlugin)

// JWT auth (sets request.user)
app.register(authPlugin)

// Routes
app.register(authRoutes)
app.register(usersRoutes)
app.register(rolesRoutes)
app.register(inmueblesRoutes)
app.register(operacionesRoutes)
app.register(comercialRoutes)
app.register(trafficRoutes)
app.register(portalRoutes)
app.register(devRoutes)

app.get('/health', async () => ({ status: 'ok', timestamp: new Date() }))

// ── Event listeners ────────────────────────────────────────────────────────────

// When an OT is completed, immediately run readiness check so the campaign
// auto-transitions to LISTA_FACTURAR as soon as all criteria are satisfied.
eventBus.on('ot.completada', async ({ otId, tenantId, campanaId }) => {
  if (!campanaId) return
  try {
    const tenant = await publicPrisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return
    const prisma = await getPrismaForTenant(tenant.dbSchema)
    await readinessService.check(prisma, campanaId, tenantId, 'system')
  } catch (err) {
    console.error('[EventBus] ot.completada → readiness check failed:', err)
  }
})
