import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import tenantPlugin from './core/tenant/tenant.plugin'
import authPlugin from './core/auth/auth.plugin'
import authRoutes from './core/auth/auth.routes'
import usersRoutes from './modules/admin/users.routes'
import rolesRoutes from './modules/admin/roles.routes'

export const app = Fastify({ logger: true })

app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? process.env.NODE_ENV === 'development',
  credentials: true,
})

app.register(cookie)

// Tenant resolution (sets request.tenant + request.prisma)
app.register(tenantPlugin)

// JWT auth (sets request.user)
app.register(authPlugin)

// Routes
app.register(authRoutes)
app.register(usersRoutes)
app.register(rolesRoutes)

app.get('/health', async () => ({ status: 'ok', timestamp: new Date() }))
