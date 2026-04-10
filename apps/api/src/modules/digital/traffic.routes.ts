import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import { buildKey, putObject } from '../../db/storage'
import * as trafficService from '../comercial/traffic.service'

const trafficRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/traffic-orders', { ...requirePermission('traffic:read') }, async (request) => {
    const q = request.query as { campanaId?: string; estadoTecnico?: string }
    return trafficService.list(request.prisma, {
      campanaId: q.campanaId,
      estadoTecnico: q.estadoTecnico,
    })
  })

  fastify.get('/traffic-orders/:id', { ...requirePermission('traffic:read') }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const to = await trafficService.getById(request.prisma, id)
    if (!to) return reply.code(404).send({ error: 'TrafficOrder no encontrada' })
    return to
  })

  fastify.patch('/traffic-orders/:id/estado', { ...requirePermission('traffic:manage') }, async (request) => {
    const { id } = request.params as { id: string }
    const { estadoTecnico, nota } = request.body as { estadoTecnico: string; nota?: string }
    return trafficService.updateEstado(
      request.prisma,
      id,
      estadoTecnico,
      nota ?? '',
      request.user.id,
      request.tenant.id,
    )
  })

  fastify.post('/traffic-orders/:id/delivery', { ...requirePermission('traffic:manage') }, async (request) => {
    const { id } = request.params as { id: string }
    const data = await request.file()
    if (!data) throw Object.assign(new Error('No se proporcionó archivo'), { statusCode: 400 })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const key = buildKey(request.tenant.id, 'delivery', id, data.filename)
    const url = await putObject(key, buffer, data.mimetype)

    return trafficService.attachDelivery(request.prisma, id, { storageKey: key, url }, request.user.id)
  })
}

export default fp(trafficRoutes, { name: 'traffic-routes' })
