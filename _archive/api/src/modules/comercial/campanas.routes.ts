import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../core/auth/rbac.guard'
import { logAudit } from '../../core/audit/audit.service'
import { buildKey, putObject, getPresignedGet } from '../../db/storage'
import { CreateClienteSchema, CreateCampanaSchema, CreateCampaignLineSchema } from './comercial.schemas'
import * as clientesService from './clientes.service'
import * as inventarioService from './inventario.service'
import * as campanasService from './campanas.service'
import * as readinessService from './readiness.service'
import { validateUpload } from '../../core/upload/validate'

const PDF_TYPES = ['application/pdf']
const PDF_ZIP_TYPES = ['application/pdf', 'application/zip', 'application/x-zip-compressed']

const comercialRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Clientes ──────────────────────────────────────────────────────────────────

  fastify.get('/clientes', { ...requirePermission('campanas:read') }, async (request) => {
    const q = request.query as { search?: string }
    return clientesService.list(request.prisma, q.search)
  })

  fastify.post('/clientes', { ...requirePermission('campanas:create') }, async (request, reply) => {
    const body = CreateClienteSchema.parse(request.body)
    const cliente = await clientesService.create(request.prisma, body, request.user.id)
    return reply.code(201).send(cliente)
  })

  // ── Inventario ────────────────────────────────────────────────────────────────

  fastify.get('/inventario', { ...requirePermission('inventario:read') }, async (request) => {
    const q = request.query as {
      fechaInicio?: string; fechaFin?: string; ciudad?: string
      tipoMedio?: string; search?: string; page?: string; limit?: string
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
    const sitios = await (request.prisma as any).sitio.findMany({
      where: { estatusOperativo: 'ACTIVO' },
      select: {
        id: true, claveInterna: true, nombre: true, ciudad: true, tipoMedio: true,
        tarifaBase: true, tarifaTrafico: true,
      },
      orderBy: [{ ciudad: 'asc' }, { nombre: 'asc' }],
    })
    return { data: sitios, total: sitios.length }
  })

  fastify.get('/inventario/map', { ...requirePermission('inventario:read') }, async (request) => {
    const q = request.query as {
      fechaInicio?: string; fechaFin?: string; ciudad?: string
      tipoMedio?: string; search?: string; page?: string; limit?: string
      bbox?: string // comma-separated: minLng,minLat,maxLng,maxLat
    }
    const bbox = q.bbox
      ? (q.bbox.split(',').map(Number) as [number, number, number, number])
      : undefined
    return inventarioService.getDisponiblesGeoJSON(request.prisma, {
      fechaInicio: q.fechaInicio,
      fechaFin: q.fechaFin,
      ciudad: q.ciudad,
      tipoMedio: q.tipoMedio,
      search: q.search,
      bbox,
    })
  })

  // ── Campanas ──────────────────────────────────────────────────────────────────

  fastify.get('/campanas', { ...requirePermission('campanas:read') }, async (request) => {
    const q = request.query as {
      estadoComercial?: string; clienteId?: string; search?: string
      fechaDesde?: string; fechaHasta?: string; page?: string; limit?: string
    }
    return campanasService.list(request.prisma, {
      estadoComercial: q.estadoComercial,
      clienteId: q.clienteId,
      search: q.search,
      fechaDesde: q.fechaDesde,
      fechaHasta: q.fechaHasta,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    })
  })

  fastify.post('/campanas', { ...requirePermission('campanas:create') }, async (request, reply) => {
    const body = CreateCampanaSchema.parse(request.body)
    const campana = await campanasService.create(request.prisma, body, request.user.id)
    return reply.code(201).send(campana)
  })

  // GET /campanas/:id — MUST be before /campanas/:id/... routes
  fastify.get('/campanas/:id', { ...requirePermission('campanas:read') }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const campana = await campanasService.getById(request.prisma, id)
    if (!campana) return reply.code(404).send({ error: 'Campaña no encontrada' })
    return campana
  })

  fastify.patch('/campanas/:id', { ...requirePermission('campanas:create') }, async (request) => {
    const { id } = request.params as { id: string }
    const body = CreateCampanaSchema.partial().parse(request.body)
    return campanasService.update(request.prisma, id, body, request.user.id)
  })

  fastify.post('/campanas/:id/confirmar', { ...requirePermission('campanas:confirm') }, async (request) => {
    const { id } = request.params as { id: string }
    return campanasService.confirmar(request.prisma, id, request.user.id, request.tenant.id)
  })

  fastify.post('/campanas/:id/cancelar', { ...requirePermission('campanas:cancel') }, async (request) => {
    const { id } = request.params as { id: string }
    const { motivo } = request.body as { motivo: string }
    return campanasService.cancelar(request.prisma, id, motivo ?? '', request.user.id)
  })

  // ── Campaign Lines ────────────────────────────────────────────────────────────

  fastify.get('/campanas/:id/lines', { ...requirePermission('campanas:read') }, async (request) => {
    const { id } = request.params as { id: string }
    return (request.prisma as any).campaignLine.findMany({
      where: { campanaId: id },
      include: { sitio: { select: { nombre: true, ciudad: true, tipoMedio: true } } },
      orderBy: { creadoEn: 'asc' },
    })
  })

  fastify.post('/campanas/:id/lines', { ...requirePermission('campanas:create') }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = CreateCampaignLineSchema.parse(request.body)
    const line = await campanasService.addLine(request.prisma, id, body, request.user.id, request.tenant.id)
    return reply.code(201).send(line)
  })

  fastify.delete('/campanas/:id/lines/:lineId', { ...requirePermission('campanas:create') }, async (request, reply) => {
    const { id, lineId } = request.params as { id: string; lineId: string }
    await campanasService.removeLine(request.prisma, id, lineId, request.user.id, request.tenant.id)
    return reply.code(204).send()
  })

  // ── Readiness ─────────────────────────────────────────────────────────────────

  fastify.get('/campanas/:id/readiness', { ...requirePermission('campanas:read') }, async (request) => {
    const { id } = request.params as { id: string }
    return readinessService.check(request.prisma, id, request.tenant.id, request.user.id)
  })

  fastify.post('/campanas/:id/readiness/oc', { ...requirePermission('campanas:readiness') }, async (request) => {
    const { id } = request.params as { id: string }
    const data = await request.file()
    if (!data) throw Object.assign(new Error('No se proporcionó archivo'), { statusCode: 400 })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    validateUpload(data, buffer, PDF_TYPES, 50)

    const key = buildKey(request.tenant.id, 'ocs', id, data.filename)
    const url = await putObject(key, buffer, data.mimetype)

    await (request.prisma as any).campana.update({
      where: { id },
      data: { ocRecibida: true, ocUrl: url },
    })

    return readinessService.check(request.prisma, id, request.tenant.id, request.user.id)
  })

  fastify.post('/campanas/:id/readiness/reporte', { ...requirePermission('campanas:readiness') }, async (request) => {
    const { id } = request.params as { id: string }
    const data = await request.file()
    if (!data) throw Object.assign(new Error('No se proporcionó archivo'), { statusCode: 400 })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    validateUpload(data, buffer, PDF_ZIP_TYPES, 100)

    const key = buildKey(request.tenant.id, 'reportes', id, data.filename)
    const reporteUrl = await putObject(key, buffer, data.mimetype)

    await (request.prisma as any).campana.update({
      where: { id },
      data: { reportePublicacion: true, reportePublicacionUrl: reporteUrl },
    })

    return readinessService.check(request.prisma, id, request.tenant.id, request.user.id)
  })

  // ── Reporte visual ───────────────────────────────────────────────────────────

  fastify.get('/campanas/:id/reporte-visual', { ...requirePermission('campanas:read') }, async (request) => {
    const { id } = request.params as { id: string }

    const campana = await (request.prisma as any).campana.findUniqueOrThrow({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true } },
        trafficOrders: { select: { id: true, folio: true, estadoTecnico: true, creadoEn: true } },
      },
    })

    const ots = await (request.prisma as any).ordenTrabajo.findMany({
      where: { campanaId: id },
      include: { evidencias: true },
      orderBy: [{ fechaProgramada: 'asc' }, { creadoEn: 'asc' }],
    })

    const otsConFotos = await Promise.all(
      ots.map(async (ot: any) => ({
        ...ot,
        evidencias: await Promise.all(
          ot.evidencias.map(async (ev: any) => ({
            ...ev,
            fotoUrlSigned: await getPresignedGet(ev.storageKey),
          })),
        ),
      })),
    )

    return {
      campana: {
        id: campana.id,
        folio: campana.folio,
        nombre: campana.nombre,
        tipoCampana: campana.tipoCampana,
        estadoComercial: campana.estadoComercial,
        fechaInicio: campana.fechaInicio,
        fechaFin: campana.fechaFin,
        reportePublicacionUrl: campana.reportePublicacionUrl ?? undefined,
        presupuestoBruto: campana.presupuestoBruto,
        cliente: campana.cliente,
      },
      ots: otsConFotos,
      trafficOrders: campana.trafficOrders,
    }
  })

  // ── Portal ────────────────────────────────────────────────────────────────────

  fastify.post('/campanas/:id/portal-activate', { ...requirePermission('portal:manage') }, async (request) => {
    const { id } = request.params as { id: string }
    return campanasService.activatePortal(
      request.prisma,
      id,
      request.user.id,
      request.tenant.subdominioBase,
    )
  })

  // ── Creatividades ─────────────────────────────────────────────────────────────

  fastify.get('/campanas/:id/creatividades', { ...requirePermission('campanas:read') }, async (request) => {
    const { id } = request.params as { id: string }
    const creatividades = await (request.prisma as any).creatividad.findMany({
      where: { campanaId: id },
      orderBy: { creadoEn: 'desc' },
    })
    // Attach signed URLs
    return Promise.all(
      creatividades.map(async (c: any) => ({
        ...c,
        archivoUrlSigned: c.storageKey ? await getPresignedGet(c.storageKey) : null,
      })),
    )
  })

  fastify.post('/campanas/:id/creatividades/validate', { ...requirePermission('campanas:create') }, async (request) => {
    const { id } = request.params as { id: string }
    const { creatividadId, estatusValidacion, motivo } = request.body as {
      creatividadId: string
      estatusValidacion: 'APROBADO' | 'RECHAZADO'
      motivo?: string
    }
    const updated = await (request.prisma as any).creatividad.update({
      where: { id: creatividadId, campanaId: id },
      data: {
        estatusValidacion,
        rechazadoMotivo: motivo ?? null,
      },
    })
    await logAudit(request.prisma, {
      userId: request.user.id,
      accion: 'creatividad.validada',
      entidadTipo: 'Creatividad',
      entidadId: creatividadId,
      cambiosJson: { estatusValidacion, motivo },
    })
    return updated
  })
}

export default fp(comercialRoutes, { name: 'comercial-routes' })
