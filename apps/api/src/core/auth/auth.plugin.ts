import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { jwtVerify } from 'jose'
import type { AuthUser, JWTPayload } from '@spaces-dooh/types'

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
  }
}

const EXCLUDED_PREFIXES = ['/auth/login', '/auth/refresh', '/auth/logout', '/portal/', '/health']

function isExcluded(url: string): boolean {
  const path = url.split('?')[0]
  return EXCLUDED_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix),
  )
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    if (isExcluded(request.url)) return

    const authHeader = request.headers['authorization']
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const token = authHeader.slice(7)
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

    try {
      const { payload } = await jwtVerify<JWTPayload>(token, secret)
      request.user = {
        id: payload.sub,
        tenantId: payload.tenantId,
        rol: payload.rol,
        permisos: payload.permisos,
        nombre: payload.nombre,
        email: payload.email,
      } as AuthUser
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })
}

export default fp(authPlugin, { name: 'auth-plugin' })
