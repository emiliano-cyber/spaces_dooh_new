import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import { CreateOTSchema, UpdateOTSchema, ChecklistItemSchema } from './ots.schemas'
import * as otsService from './ots.service'
import * as evidenciasService from './evidencias.service'
import { validateUpload } from '../../core/upload/validate'

const IMAGEN_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const operacionesRoutes: FastifyPluginAsync = async (fastify) => {
  // ── List ──────────────────────────────────────────────────────────────────────
  fastify.get('/ordenes-trabajo', { ...requirePermission('ots:read') }, async (request) => {
    const q = request.query as {
      asignadoA?: string
      estatus?: string
      tipo?: string
      prioridad?: string
      fechaDesde?: string
      fechaHasta?: string
      sitioId?: string
      page?: string
      limit?: string
    }
    return otsService.list(request.prisma, {
      asignadoAUserId: q.asignadoA,
      estatus: q.estatus,
      tipo: q.tipo,
      prioridad: q.prioridad,
      fechaDesde: q.fechaDesde,
      fechaHasta: q.fechaHasta,
      sitioId: q.sitioId,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Math.min(Number(q.limit), 200) : undefined,
    })
  })

  // ── Create ────────────────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo', { ...requirePermission('ots:create') }, async (request, reply) => {
    const body = CreateOTSchema.parse(request.body)
    const ot = await otsService.create(request.prisma, body, request.user.id)
    return reply.code(201).send(ot)
  })

  // ── Calendario — MUST be before /:id ─────────────────────────────────────────
  fastify.get('/ordenes-trabajo/calendario', { ...requirePermission('ots:read') }, async (request) => {
    const q = request.query as { desde: string; hasta: string; userId?: string }
    return otsService.getCalendario(request.prisma, {
      desde: q.desde,
      hasta: q.hasta,
      userId: q.userId,
    })
  })

  // ── Get by ID ─────────────────────────────────────────────────────────────────
  fastify.get('/ordenes-trabajo/:id', { ...requirePermission('ots:read') }, async (request) => {
    const { id } = request.params as { id: string }
    return otsService.getById(request.prisma, id)
  })

  // ── Update ────────────────────────────────────────────────────────────────────
  fastify.patch('/ordenes-trabajo/:id', { ...requirePermission('ots:assign') }, async (request) => {
    const { id } = request.params as { id: string }
    const body = UpdateOTSchema.parse(request.body)
    return otsService.update(request.prisma, id, body, request.user.id)
  })

  // ── Update Checklist ──────────────────────────────────────────────────────────
  fastify.patch(
    '/ordenes-trabajo/:id/checklist',
    { ...requirePermission('ots:complete') },
    async (request) => {
      const { id } = request.params as { id: string }
      const { itemId, completado } = ChecklistItemSchema.parse(request.body)
      return otsService.updateChecklist(request.prisma, id, itemId, completado, request.user.id)
    },
  )

  // ── Presigned Upload URL ──────────────────────────────────────────────────────
  fastify.post(
    '/ordenes-trabajo/:id/evidencias/upload-url',
    { ...requirePermission('ots:complete') },
    async (request) => {
      const { id } = request.params as { id: string }
      const { filename, contentType } = request.body as { filename: string; contentType: string }
      if (!IMAGEN_TYPES.includes(contentType)) {
        throw Object.assign(
          new Error(`Formato no permitido. Acepta: ${IMAGEN_TYPES.join(', ')}`),
          { statusCode: 400 },
        )
      }
      return evidenciasService.getPresignedUploadUrl(request.tenant.id, id, filename, contentType)
    },
  )

  // ── Register Evidencia ────────────────────────────────────────────────────────
  fastify.post(
    '/ordenes-trabajo/:id/evidencias',
    { ...requirePermission('ots:complete') },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        storageKey: string
        lat?: number
        lng?: number
        tipo?: string
      }
      const fotoUrl = `https://placeholder.storage/${body.storageKey}`
      const evidencia = await evidenciasService.addEvidencia(
        request.prisma,
        id,
        { fotoUrl, storageKey: body.storageKey, lat: body.lat, lng: body.lng, tipo: body.tipo },
        request.user.id,
      )
      return reply.code(201).send(evidencia)
    },
  )

  // ── Completar ─────────────────────────────────────────────────────────────────
  fastify.post(
    '/ordenes-trabajo/:id/completar',
    { ...requirePermission('ots:complete') },
    async (request) => {
      const { id } = request.params as { id: string }
      const { notas } = (request.body as { notas?: string }) ?? {}
      return otsService.completar(request.prisma, id, { notas }, request.user.id, request.tenant.id)
    },
  )
}

export default fp(operacionesRoutes, { name: 'operaciones-routes' })
