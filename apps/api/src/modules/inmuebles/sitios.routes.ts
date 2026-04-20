import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import * as sitiosService from './sitios.service'
import * as contratosService from './contratos.service'
import * as incidenciasService from './incidencias.service'
import * as alertasService from './alertas.service'
import {
  CreateSitioSchema,
  UpdateSitioSchema,
  CreateContratoSchema,
  CreateIncidenciaSchema,
  CreateLicenciaSchema,
} from './inmuebles.schemas'

const inmueblesRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Alertas ────────────────────────────────────────────────────────────────
  fastify.get(
    '/alertas/vencimientos',
    { ...requirePermission('sitios:read') },
    async (request) => {
      const { diasUmbral } = request.query as { diasUmbral?: string }
      return alertasService.getAlertasVencimiento(request.prisma, diasUmbral ? Number(diasUmbral) : 30)
    },
  )

  // ── Incidencias list ──────────────────────────────────────────────────────
  fastify.get('/incidencias', { ...requirePermission('sitios:read') }, async (request) => {
    const q = request.query as { estatusResolucion?: string; limit?: string }
    const limit = Math.min(q.limit ? Number(q.limit) : 100, 200)
    const where: Record<string, unknown> = {}
    if (q.estatusResolucion === 'ABIERTA') where.estatus = 'ABIERTA'
    const [items, total] = await Promise.all([
      (request.prisma as any).incidencia.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        take: limit,
        include: { sitio: { select: { id: true, nombre: true, claveInterna: true } } },
      }),
      (request.prisma as any).incidencia.count({ where }),
    ])
    return { data: items, meta: { total } }
  })

  // ── Sitios ─────────────────────────────────────────────────────────────────
  fastify.get('/sitios', { ...requirePermission('sitios:read') }, async (request) => {
    const q = request.query as {
      ciudad?: string
      tipoMedio?: string
      estatusComercial?: string
      search?: string
      page?: string
      limit?: string
    }
    return sitiosService.list(request.prisma, {
      ciudad: q.ciudad,
      tipoMedio: q.tipoMedio,
      estatusComercial: q.estatusComercial,
      search: q.search,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    })
  })

  fastify.get('/sitios/map', { ...requirePermission('sitios:read') }, async (request) => {
    const { bbox } = request.query as { bbox?: string }
    const parsed = bbox
      ? (bbox.split(',').map(Number) as [number, number, number, number])
      : undefined
    return sitiosService.getMapGeoJSON(request.prisma, { bbox: parsed })
  })

  fastify.post('/sitios', { ...requirePermission('sitios:create') }, async (request, reply) => {
    const body = CreateSitioSchema.parse(request.body)
    const sitio = await sitiosService.create(request.prisma, body, request.user.id)
    return reply.code(201).send(sitio)
  })

  fastify.get('/sitios/:id', { ...requirePermission('sitios:read') }, async (request) => {
    const { id } = request.params as { id: string }
    return sitiosService.getById(request.prisma, id)
  })

  fastify.patch('/sitios/:id', { ...requirePermission('sitios:edit') }, async (request) => {
    const { id } = request.params as { id: string }
    const body = UpdateSitioSchema.parse(request.body)
    return sitiosService.update(request.prisma, id, body, request.user.id)
  })

  // ── Contratos ──────────────────────────────────────────────────────────────
  fastify.get(
    '/sitios/:id/contratos',
    { ...requirePermission('contratos:read') },
    async (request) => {
      const { id } = request.params as { id: string }
      return contratosService.listBySitio(request.prisma, id)
    },
  )

  fastify.post(
    '/sitios/:id/contratos',
    { ...requirePermission('contratos:create') },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = CreateContratoSchema.parse(request.body)
      const contrato = await contratosService.create(request.prisma, id, body, request.user.id)
      return reply.code(201).send(contrato)
    },
  )

  // ── Incidencias ────────────────────────────────────────────────────────────
  fastify.post(
    '/sitios/:id/incidencias',
    { ...requirePermission('incidencias:create') },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = CreateIncidenciaSchema.parse(request.body)
      const incidencia = await incidenciasService.create(request.prisma, id, body, request.user.id)
      return reply.code(201).send(incidencia)
    },
  )

  fastify.patch(
    '/sitios/:id/incidencias/:iid',
    { ...requirePermission('incidencias:resolve') },
    async (request) => {
      const { iid } = request.params as { id: string; iid: string }
      const body = request.body as { notas?: string; fechaResolucion?: string }
      return incidenciasService.resolve(
        request.prisma,
        iid,
        {
          notas: body.notas,
          fechaResolucion: body.fechaResolucion ? new Date(body.fechaResolucion) : undefined,
        },
        request.user.id,
      )
    },
  )

  // ── Licencias ──────────────────────────────────────────────────────────────
  fastify.get(
    '/sitios/:id/licencias',
    { ...requirePermission('sitios:read') },
    async (request) => {
      const { id } = request.params as { id: string }
      return (request.prisma as any).licenciaPermiso.findMany({
        where: { sitioId: id },
        orderBy: { fechaVencimiento: 'asc' },
      })
    },
  )

  fastify.post(
    '/sitios/:id/licencias',
    { ...requirePermission('sitios:edit') },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = CreateLicenciaSchema.parse(request.body)
      const licencia = await (request.prisma as any).licenciaPermiso.create({
        data: { sitioId: id, ...body },
      })
      return reply.code(201).send(licencia)
    },
  )
}

export default fp(inmueblesRoutes, { name: 'inmuebles-routes' })
