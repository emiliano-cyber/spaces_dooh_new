/**
 * Inventario disponible routes.
 *
 * GET /inventario        → paginated list of available sites
 * GET /inventario/map    → GeoJSON FeatureCollection for map rendering
 *
 * NOTE: These routes are co-located in campanas.routes.ts.
 * This file is a standalone plugin for future extraction.
 */
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import * as inventarioService from './inventario.service'

const inventarioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/inventario', { ...requirePermission('inventario:read') }, async (request) => {
    const q = request.query as {
      fechaInicio?: string
      fechaFin?: string
      ciudad?: string
      tipoMedio?: string
      search?: string
      page?: string
      limit?: string
    }
    return inventarioService.getDisponibles(request.prisma, {
      fechaInicio: q.fechaInicio,
      fechaFin: q.fechaFin,
      ciudad: q.ciudad,
      tipoMedio: q.tipoMedio,
      search: q.search,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    })
  })

  fastify.get('/inventario/costos', { ...requirePermission('inventario:read_costs') }, async (request) => {
    const q = request.query as { ciudad?: string; tipoMedio?: string; search?: string }
    const sitios = await (request.prisma as any).sitio.findMany({
      where: { estatusOperativo: 'ACTIVO' },
      select: {
        id: true, claveInterna: true, nombre: true, ciudad: true, tipoMedio: true,
        tarifaBase: true, tarifaTrafico: true,
      },
      orderBy: [{ ciudad: 'asc' }, { nombre: 'asc' }],
      take: 200,
    })
    return { data: sitios, total: sitios.length }
  })

  fastify.get('/inventario/map', { ...requirePermission('inventario:read') }, async (request) => {
    const q = request.query as {
      fechaInicio?: string
      fechaFin?: string
      ciudad?: string
      tipoMedio?: string
      bbox?: string
    }
    const bbox = q.bbox
      ? (q.bbox.split(',').map(Number) as [number, number, number, number])
      : undefined

    return inventarioService.getDisponiblesGeoJSON(request.prisma, {
      fechaInicio: q.fechaInicio,
      fechaFin: q.fechaFin,
      ciudad: q.ciudad,
      tipoMedio: q.tipoMedio,
      bbox,
    })
  })
}

export default fp(inventarioRoutes, { name: 'inventario-routes' })
