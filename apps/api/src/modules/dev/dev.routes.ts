import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { alertasQueue } from '../../jobs/queue'

const devRoutes: FastifyPluginAsync = async (fastify) => {
  if (process.env.NODE_ENV !== 'development') return

  fastify.post('/dev/trigger-alertas', async (request, reply) => {
    const tenant = request.tenant
    const job = await alertasQueue.add(
      'check-vencimientos',
      { tenantId: tenant.id, dbSchema: tenant.dbSchema },
      { removeOnComplete: false, removeOnFail: false },
    )
    return reply.send({ jobId: job.id, message: 'Job encolado' })
  })
}

export default fp(devRoutes, { name: 'dev-routes' })
