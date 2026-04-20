/**
 * Contratos de arrendamiento routes.
 *
 * GET  /sitios/:id/contratos          → list contracts for a site
 * POST /sitios/:id/contratos          → create contract
 * GET  /contratos/vencimientos        → contracts expiring soon
 *
 * NOTE: The first two routes are co-located in sitios.routes.ts (nested under /sitios).
 * This file exposes a standalone plugin that adds the vencimientos query endpoint
 * at the top-level /contratos prefix.
 */
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import * as contratosService from './contratos.service'

const contratosRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/contratos/vencimientos',
    { ...requirePermission('contratos:read') },
    async (request) => {
      const { diasUmbral } = request.query as { diasUmbral?: string }
      return contratosService.getVencimientosProximos(
        request.prisma,
        diasUmbral ? Number(diasUmbral) : 30,
      )
    },
  )
}

export default fp(contratosRoutes, { name: 'contratos-routes' })
