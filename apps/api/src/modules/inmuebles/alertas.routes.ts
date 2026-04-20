/**
 * Alertas de vencimiento routes.
 *
 * GET /alertas/vencimientos   → contratos, licencias y pagos próximos a vencer
 *
 * NOTE: This endpoint is already registered inside sitios.routes.ts.
 * This file exists as a standalone mountable plugin for future service decomposition.
 */
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import * as alertasService from './alertas.service'

const alertasRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/alertas/vencimientos',
    { ...requirePermission('sitios:read') },
    async (request) => {
      const { diasUmbral } = request.query as { diasUmbral?: string }
      return alertasService.getAlertasVencimiento(
        request.prisma,
        diasUmbral ? Number(diasUmbral) : 30,
      )
    },
  )
}

export default fp(alertasRoutes, { name: 'alertas-routes' })
