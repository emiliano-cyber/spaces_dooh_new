/**
 * Clientes routes.
 *
 * GET  /clientes          → list (optional ?search=)
 * POST /clientes          → create
 *
 * NOTE: These routes are co-located in campanas.routes.ts.
 * This file is a standalone plugin for future extraction.
 */
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import * as clientesService from './clientes.service'
import { CreateClienteSchema } from './comercial.schemas'

const clientesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/clientes', { ...requirePermission('campanas:read') }, async (request) => {
    const { search } = request.query as { search?: string }
    return clientesService.list(request.prisma, search)
  })

  fastify.post('/clientes', { ...requirePermission('campanas:create') }, async (request, reply) => {
    const body = CreateClienteSchema.parse(request.body)
    const cliente = await clientesService.create(request.prisma, body, request.user.id)
    return reply.code(201).send(cliente)
  })
}

export default fp(clientesRoutes, { name: 'clientes-routes' })
