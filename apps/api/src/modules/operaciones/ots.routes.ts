import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import { CreateOTSchema, UpdateOTSchema, ChecklistItemSchema } from './ots.schemas'
import * as otsService from './ots.service'
import * as evidenciasService from './evidencias.service'

const IMAGEN_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const operacionesRoutes: FastifyPluginAsync = async (fastify) => {
  // ── List ──────────────────────────────────────────────────────────────────────
  fastify.get('/ordenes-trabajo', { ...requirePermission('ots:read') }, async (request) => {
    const q = request.query as {
      asignadoA?: string; estatus?: string; tipo?: string; prioridad?: string
      fechaDesde?: string; fechaHasta?: string; sitioId?: string; campanaId?: string
      page?: string; limit?: string
    }
    return otsService.list(request.prisma, {
      asignadoAUserId: q.asignadoA,
      estatus: q.estatus,
      tipo: q.tipo,
      prioridad: q.prioridad,
      fechaDesde: q.fechaDesde,
      fechaHasta: q.fechaHasta,
      sitioId: q.sitioId,
      campanaId: q.campanaId,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Math.min(Number(q.limit), 200) : undefined,
    }, request.user)
  })

  // ── Create ────────────────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo', { ...requirePermission('ots:create') }, async (request, reply) => {
    const body = CreateOTSchema.parse(request.body)
    const ot = await otsService.create(request.prisma, body, request.user.id)
    return reply.code(201).send(ot)
  })

  // ── Mis Sitios (campo roles) ──────────────────────────────────────────────────
  fastify.get('/ordenes-trabajo/mis-sitios', { ...requirePermission('ots:read') }, async (request) => {
    return otsService.getMisSitios(request.prisma, request.user)
  })

  // ── Calendario — MUST be before /:id ─────────────────────────────────────────
  fastify.get('/ordenes-trabajo/calendario', { ...requirePermission('ots:read') }, async (request) => {
    const q = request.query as { desde: string; hasta: string; userId?: string }
    return otsService.getCalendario(request.prisma, { desde: q.desde, hasta: q.hasta, userId: q.userId }, request.user)
  })

  // ── Get by ID ─────────────────────────────────────────────────────────────────
  fastify.get('/ordenes-trabajo/:id', { ...requirePermission('ots:read') }, async (request) => {
    const { id } = request.params as { id: string }
    return otsService.getById(request.prisma, id, request.user)
  })

  // ── Update basic fields ───────────────────────────────────────────────────────
  fastify.patch('/ordenes-trabajo/:id', { ...requirePermission('ots:assign') }, async (request) => {
    const { id } = request.params as { id: string }
    const body = UpdateOTSchema.parse(request.body)
    return otsService.update(request.prisma, id, body, request.user.id)
  })

  // ── Update Checklist ──────────────────────────────────────────────────────────
  fastify.patch('/ordenes-trabajo/:id/checklist', { ...requirePermission('ots:complete') }, async (request) => {
    const { id } = request.params as { id: string }
    const { itemId, completado, notaRealizado, notaPendiente } = ChecklistItemSchema.parse(request.body)
    return otsService.updateChecklist(request.prisma, id, itemId, completado, request.user.id, notaRealizado, notaPendiente)
  })

  // ── Presigned Upload URL ──────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/evidencias/upload-url', { ...requirePermission('ots:complete') }, async (request) => {
    const { id } = request.params as { id: string }
    const { filename, contentType } = request.body as { filename: string; contentType: string }
    if (!IMAGEN_TYPES.includes(contentType)) {
      throw Object.assign(new Error(`Formato no permitido. Acepta: ${IMAGEN_TYPES.join(', ')}`), { statusCode: 400 })
    }
    return evidenciasService.getPresignedUploadUrl(request.tenant.id, id, filename, contentType)
  })

  // ── Register Evidencia ────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/evidencias', { ...requirePermission('ots:complete') }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      storageKey: string; tipo?: string; lat?: number; lng?: number
      precision?: number; tamanoMb?: number; formato?: string; deviceInfo?: string
    }
    const fotoUrl = `https://placeholder.storage/${body.storageKey}`
    const evidencia = await evidenciasService.addEvidencia(
      request.prisma, id,
      { fotoUrl, storageKey: body.storageKey, tipo: body.tipo, lat: body.lat, lng: body.lng,
        precision: body.precision, tamanoMb: body.tamanoMb, formato: body.formato, deviceInfo: body.deviceInfo },
      request.user.id,
    )
    return reply.code(201).send(evidencia)
  })

  // ── Guardar notas ─────────────────────────────────────────────────────────────
  fastify.patch('/ordenes-trabajo/:id/notas', { ...requirePermission('ots:complete') }, async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { notas?: string }
    return otsService.update(request.prisma, id, { notas: body?.notas }, request.user.id)
  })

  // ── Iniciar labores ───────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/iniciar-labores', { ...requirePermission('ots:complete') }, async (request) => {
    const { id } = request.params as { id: string }
    return otsService.iniciarLabores(request.prisma, id, request.user.id)
  })

  // ── Terminar labores ──────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/terminar-labores', { ...requirePermission('ots:complete') }, async (request) => {
    const { id } = request.params as { id: string }
    return otsService.terminarLabores(request.prisma, id, request.user.id)
  })

  // ── Completar ─────────────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/completar', { ...requirePermission('ots:complete') }, async (request) => {
    const { id } = request.params as { id: string }
    const { notas } = (request.body as { notas?: string }) ?? {}
    return otsService.completar(request.prisma, id, { notas }, request.user.id, request.tenant.id)
  })

  // ── Bloquear ──────────────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/bloquear', { ...requirePermission('ots:complete') }, async (request) => {
    const { id } = request.params as { id: string }
    const { motivo } = request.body as { motivo: string }
    return otsService.bloquear(request.prisma, id, { motivo }, request.user.id)
  })

  // ── Aprobar ───────────────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/aprobar', { ...requirePermission('ots:assign') }, async (request) => {
    const { id } = request.params as { id: string }
    const { notas } = (request.body as { notas?: string }) ?? {}
    return otsService.aprobar(request.prisma, id, { notas }, request.user.id, request.tenant.id)
  })

  // ── Rechazar ──────────────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/rechazar', { ...requirePermission('ots:assign') }, async (request) => {
    const { id } = request.params as { id: string }
    const { motivo } = request.body as { motivo: string }
    return otsService.rechazar(request.prisma, id, { motivo }, request.user.id)
  })

  // ── Reabrir ───────────────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/reabrir', { ...requirePermission('ots:assign') }, async (request) => {
    const { id } = request.params as { id: string }
    const { instrucciones } = (request.body as { instrucciones?: string }) ?? {}
    return otsService.reabrir(request.prisma, id, { instrucciones }, request.user.id)
  })

  // ── Cancelar ──────────────────────────────────────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/cancelar', { ...requirePermission('ots:assign') }, async (request) => {
    const { id } = request.params as { id: string }
    const { motivo } = request.body as { motivo: string }
    return otsService.cancelar(request.prisma, id, { motivo }, request.user.id)
  })

  // ── Eliminar ──────────────────────────────────────────────────────────────────
  fastify.delete('/ordenes-trabajo/:id', { ...requirePermission('ots:assign') }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await otsService.deleteOT(request.prisma, id, request.user.id)
    return reply.code(200).send({ ok: true })
  })
}

export default fp(operacionesRoutes, { name: 'operaciones-routes' })
