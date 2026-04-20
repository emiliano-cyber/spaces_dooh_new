import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import { publicPrisma } from '../../db/client'

const rolesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/roles', { ...requirePermission('roles:read') }, async (request) => {
    return publicPrisma.role.findMany({ where: { tenantId: request.tenant.id } })
  })

  fastify.post('/admin/roles', { ...requirePermission('roles:manage') }, async (request) => {
    const body = request.body as { nombre: string; permisos: string[] }
    return publicPrisma.role.create({
      data: {
        tenantId: request.tenant.id,
        nombre: body.nombre,
        permisos: body.permisos,
        esBuiltin: false,
      },
    })
  })

  fastify.patch('/admin/roles/:id', { ...requirePermission('roles:manage') }, async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { permisos: string[] }
    return publicPrisma.role.update({ where: { id }, data: { permisos: body.permisos } })
  })

  fastify.delete('/admin/roles/:id', { ...requirePermission('roles:manage') }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await publicPrisma.role.findUniqueOrThrow({ where: { id } })
    if (role.esBuiltin) return reply.code(400).send({ error: 'No se puede eliminar un rol builtin' })
    const usersCount = await publicPrisma.user.count({ where: { rolId: id } })
    if (usersCount > 0) return reply.code(400).send({ error: `Este rol tiene ${usersCount} usuario(s) asignado(s)` })
    await publicPrisma.role.delete({ where: { id } })
    return reply.code(204).send()
  })
}

export default fp(rolesRoutes, { name: 'roles-routes' })
