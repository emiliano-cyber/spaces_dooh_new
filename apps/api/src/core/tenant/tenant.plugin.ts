import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { publicPrisma, getPrismaForTenant } from '../../db/client'

interface RequestTenant {
  id: string
  nombre: string
  subdominioBase: string
  dbSchema: string
  plan: string
  activo: boolean
  config: unknown
  creadoEn: Date
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant: RequestTenant
    prisma: PrismaClient
  }
}

const EXCLUDED = ['/health']
// Portal routes resolve tenant from the portalToken itself, not from the host/header
const PORTAL_PATTERN = /^\/portal\/[^/]+$/

function isExcluded(url: string): boolean {
  const path = url.split('?')[0]
  return EXCLUDED.some((prefix) => path === prefix || path.startsWith(prefix + '/'))
    || PORTAL_PATTERN.test(path)
}

function extractSlug(host: string): string | null {
  // 'comercial.westmedia.spaces.com' → parts[1] = 'westmedia'
  const parts = host.split('.')
  if (parts.length >= 4) return parts[1]
  // 'westmedia.spaces.com' → parts[0] = 'westmedia'
  if (parts.length === 3) return parts[0]
  return null
}

const tenantPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    if (isExcluded(request.url)) return

    const isDev = process.env.NODE_ENV !== 'production'
    const host = (request.headers['x-forwarded-host'] as string | undefined)
      ?? (request.headers['host'] as string | undefined)
      ?? ''

    let slug: string | null = null

    if (isDev) {
      slug = (request.headers['x-tenant-slug'] as string | undefined) ?? extractSlug(host)
    } else {
      slug = extractSlug(host)
    }

    if (!slug) {
      return reply.code(404).send({ error: 'Tenant not found' })
    }

    const tenant = await publicPrisma.tenant.findUnique({
      where: { subdominioBase: slug },
    })

    if (!tenant || !tenant.activo) {
      return reply.code(404).send({ error: 'Tenant not found' })
    }

    request.tenant = tenant
    request.prisma = getPrismaForTenant(tenant.dbSchema)
  })
}

export default fp(tenantPlugin, { name: 'tenant-plugin' })
