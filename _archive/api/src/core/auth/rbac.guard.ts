import { createError } from '@fastify/error'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { Permission } from '@spaces-dooh/types'

const Forbidden = createError('FST_FORBIDDEN', 'Forbidden', 403)

export function requirePermission(permission: Permission) {
  return {
    preHandler: async (request: FastifyRequest, _reply: FastifyReply) => {
      const user = request.user
      if (!user) throw new Forbidden()
      if (user.rol === 'owner' || user.rol === 'admin') return
      if ((user.permisos as string[]).includes('*')) return
      if (!user.permisos.includes(permission)) throw new Forbidden()
    },
  }
}

// Marker for routes that skip the auth plugin check (used as documentation / opt-in public routes)
export const skipAuth = { skipAuth: true } as const
