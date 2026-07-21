import type { PrismaClient } from '@prisma/client'
import type { AuthUser } from '@spaces-dooh/types'

// Minimal Tenant shape needed on request — mirrors the Prisma model
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
    user: AuthUser
  }
}
