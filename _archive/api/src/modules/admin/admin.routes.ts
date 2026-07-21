import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import { publicPrisma } from '../../db/client'

const CONNECTOR_TYPES = ['DOOHMAIN', 'BROADSIGN', 'INVIAN'] as const

function maskApiKey(raw: string): string {
  return raw.length > 4 ? '••••••••' + raw.slice(-4) : '••••'
}

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Audit Log ─────────────────────────────────────────────────────────────

  fastify.get('/admin/audit-log', { ...requirePermission('audit:read') }, async (request) => {
    const q = request.query as {
      entidadTipo?: string
      userId?: string
      desde?: string
      hasta?: string
      page?: string
      limit?: string
    }
    const page = q.page ? Math.max(1, Number(q.page)) : 1
    const limit = Math.min(q.limit ? Number(q.limit) : 50, 100)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (q.entidadTipo) where.entidadTipo = q.entidadTipo
    if (q.userId) where.userId = q.userId
    if (q.desde || q.hasta) {
      const ts: Record<string, unknown> = {}
      if (q.desde) ts.gte = new Date(q.desde)
      if (q.hasta) ts.lte = new Date(q.hasta)
      where.timestamp = ts
    }

    const [items, total] = await Promise.all([
      (request.prisma as any).auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      (request.prisma as any).auditLog.count({ where }),
    ])

    // Enrich with user details from public schema
    const userIds = [...new Set(items.map((i: any) => i.userId as string))] as string[]
    const users = userIds.length
      ? await publicPrisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nombre: true, email: true },
        })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    return {
      data: items.map((item: any) => ({
        ...item,
        usuario: userMap[item.userId] ?? { nombre: 'Sistema', email: item.userId },
      })),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    }
  })

  // ── Tenant configuration ──────────────────────────────────────────────────

  fastify.get('/admin/tenant', { ...requirePermission('tenant:manage') }, async (request) => {
    const tenant = await publicPrisma.tenant.findUniqueOrThrow({
      where: { id: request.tenant.id },
      select: { id: true, nombre: true, subdominioBase: true, plan: true, activo: true, config: true, creadoEn: true },
    })
    return tenant
  })

  fastify.patch('/admin/tenant', { ...requirePermission('tenant:manage') }, async (request) => {
    const body = request.body as { nombre?: string; config?: Record<string, unknown> }
    const data: Record<string, unknown> = {}
    if (body.nombre !== undefined) data.nombre = body.nombre
    if (body.config !== undefined) data.config = body.config
    return publicPrisma.tenant.update({ where: { id: request.tenant.id }, data })
  })

  // ── Connectors ───────────────────────────────────────────────────────────

  fastify.get('/admin/connectors', { ...requirePermission('tenant:manage') }, async (request) => {
    const configs = await (request.prisma as any).connectorConfig.findMany()
    const configMap = Object.fromEntries(configs.map((c: any) => [c.tipo, c]))

    return CONNECTOR_TYPES.map((tipo) => {
      const cfg = configMap[tipo]
      if (!cfg) return { tipo, activo: false, configurado: false, apiKeyMasked: null, baseUrl: null }

      let apiKeyMasked: string | null = null
      let baseUrl: string | null = null
      try {
        const decoded = JSON.parse(Buffer.from(cfg.credencialesEnc, 'base64').toString())
        if (decoded.apiKey) apiKeyMasked = maskApiKey(decoded.apiKey)
        if (decoded.baseUrl) baseUrl = decoded.baseUrl
      } catch {}

      return { tipo, activo: cfg.activo, configurado: true, apiKeyMasked, baseUrl }
    })
  })

  fastify.patch(
    '/admin/connectors/:tipo',
    { ...requirePermission('tenant:manage') },
    async (request, reply) => {
      const { tipo } = request.params as { tipo: string }
      if (!(CONNECTOR_TYPES as readonly string[]).includes(tipo)) {
        return reply.code(404).send({ error: 'Tipo de conector no válido' })
      }
      const body = request.body as { apiKey: string; baseUrl: string; activo?: boolean }
      const creds = Buffer.from(JSON.stringify({ apiKey: body.apiKey, baseUrl: body.baseUrl })).toString('base64')

      const existing = await (request.prisma as any).connectorConfig.findUnique({ where: { tipo } })
      if (existing) {
        return (request.prisma as any).connectorConfig.update({
          where: { tipo },
          data: { credencialesEnc: creds, activo: body.activo ?? existing.activo, config: { baseUrl: body.baseUrl } },
        })
      }
      return (request.prisma as any).connectorConfig.create({
        data: { tipo, credencialesEnc: creds, activo: body.activo ?? false, config: { baseUrl: body.baseUrl } },
      })
    },
  )
}

export default fp(adminRoutes, { name: 'admin-routes' })
