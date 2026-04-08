import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import * as usersService from './users.service'

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/users', { ...requirePermission('users:read') }, async (request) => {
    return usersService.list(request.tenant.id)
  })

  fastify.post('/admin/users', { ...requirePermission('users:manage') }, async (request) => {
    const body = request.body as {
      nombre: string
      email: string
      password: string
      rolId: string
    }
    return usersService.create({ ...body, tenantId: request.tenant.id })
  })

  fastify.patch('/admin/users/:id', { ...requirePermission('users:manage') }, async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { nombre?: string; rolId?: string; activo?: boolean }
    return usersService.update(id, body)
  })
}

export default fp(usersRoutes, { name: 'users-routes' })
