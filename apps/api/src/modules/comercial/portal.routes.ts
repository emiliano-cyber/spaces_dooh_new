import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { buildKey, putObject } from '../../db/storage'
import { validateUpload } from '../../core/upload/validate'
import { publicPrisma, getPrismaForTenant } from '../../db/client'

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'pdf', 'mp4', 'mov']
const PORTAL_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'video/mp4', 'video/quicktime',
]

function ext(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function calcularEtapas(campana: any) {
  const trafficEnPublicacion = campana.trafficOrders?.some(
    (to: any) => to.estadoTecnico === 'EN_PUBLICACION',
  ) ?? false
  const otCompletada = campana.ordenesTrabajo?.some(
    (ot: any) => ot.estatus === 'COMPLETADA',
  ) ?? false
  const creatividadAprobada = campana.creatividades?.some(
    (c: any) => c.estatusValidacion === 'APROBADO',
  ) ?? false

  return [
    { nombre: 'Campaña creada',           completado: true,                                                              activo: false },
    { nombre: 'Inventario confirmado',     completado: (campana.lines?.length ?? 0) > 0,                                  activo: false },
    { nombre: 'Orden de compra recibida',  completado: campana.ocRecibida,                                                activo: !campana.ocRecibida },
    { nombre: 'Creativo recibido',         completado: (campana.creatividades?.length ?? 0) > 0,                          activo: false },
    { nombre: 'Creativo validado',         completado: creatividadAprobada,                                               activo: false },
    { nombre: 'En publicación',            completado: trafficEnPublicacion || otCompletada,                              activo: false },
    { nombre: 'Reporte generado',          completado: campana.reportePublicacion,                                        activo: !campana.reportePublicacion },
    { nombre: 'Listo para facturar',       completado: campana.estadoComercial === 'LISTA_FACTURAR',                       activo: false },
  ]
}

const portalRoutes: FastifyPluginAsync = async (fastify) => {
  // Public routes — no authPlugin guard
  // tenant is still resolved via tenantPlugin (x-tenant-slug header or host)

  fastify.get('/portal/:token', async (request, reply) => {
    const { token } = request.params as { token: string }

    // Resolve prisma: tenant plugin skips /portal/:token, so we do cross-tenant lookup
    let prisma = (request as any).prisma as any
    if (!prisma) {
      // Search all active tenants for this portalToken
      const tenants = await publicPrisma.tenant.findMany({ where: { activo: true } })
      for (const t of tenants) {
        const tp = getPrismaForTenant(t.dbSchema)
        const found = await (tp as any).campana.findFirst({
          where: { portalToken: token, portalActivo: true },
          select: { id: true },
        })
        if (found) { prisma = tp; break }
      }
      if (!prisma) return reply.code(404).send({ error: 'Portal no encontrado o inactivo' })
    }

    const campana = await (prisma as any).campana.findFirst({
      where: { portalToken: token, portalActivo: true },
      include: {
        cliente: { select: { nombre: true } },
        lines: true,
        creatividades: {
          select: {
            id: true, nombre: true, formato: true, resolucion: true,
            duracionSeg: true, pesoMb: true, estatusValidacion: true,
            subioPorExterno: true, creadoEn: true,
            // intentionally exclude archivoUrl / storageKey (internal)
          },
        },
        trafficOrders: { select: { estadoTecnico: true } },
      },
    })

    if (!campana) {
      return reply.code(404).send({ error: 'Portal no encontrado o inactivo' })
    }

    // OrdenTrabajo has campanaId but Campana has no reverse relation in schema
    const ordenesTrabajo = await (prisma as any).ordenTrabajo.findMany({
      where: { campanaId: campana.id },
      select: { estatus: true },
    })
    campana.ordenesTrabajo = ordenesTrabajo

    return {
      campana: {
        folio: campana.folio,
        nombre: campana.nombre,
        clienteNombre: campana.cliente.nombre,
        fechaInicio: campana.fechaInicio,
        fechaFin: campana.fechaFin,
        estadoComercial: campana.estadoComercial,
        tipoCampana: campana.tipoCampana,
      },
      etapas: calcularEtapas(campana),
      creatividades: campana.creatividades,
    }
  })

  fastify.post('/portal/:token/creatividades', async (request, reply) => {
    const { token } = request.params as { token: string }

    const campana = await (request.prisma as any).campana.findFirst({
      where: { portalToken: token, portalActivo: true },
      select: { id: true, estadoComercial: true },
    })

    if (!campana) {
      return reply.code(404).send({ error: 'Portal no encontrado o inactivo' })
    }

    const data = await request.file()
    if (!data) {
      return reply.code(400).send({ error: 'No se proporcionó archivo' })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    validateUpload(data, buffer, PORTAL_MIME_TYPES, 500)

    const extension = ext(data.filename)
    if (!ALLOWED_FORMATS.includes(extension)) {
      return reply.code(400).send({
        error: `Extensión no permitida. Formatos aceptados: ${ALLOWED_FORMATS.join(', ')}`,
      })
    }

    const pesoMb = buffer.length / (1024 * 1024)

    const nombre = (request.body as any)?.nombre ?? data.filename
    const key = buildKey(request.tenant.id, 'creatividades', campana.id, data.filename)
    const archivoUrl = await putObject(key, buffer, data.mimetype)

    const creatividad = await (request.prisma as any).creatividad.create({
      data: {
        campanaId: campana.id,
        nombre,
        archivoUrl,
        storageKey: key,
        formato: extension.toUpperCase(),
        pesoMb: pesoMb.toFixed(2),
        subioPorExterno: true,
      },
    })

    return reply.code(201).send({
      creatividad: {
        id: creatividad.id,
        nombre: creatividad.nombre,
        formato: creatividad.formato,
        pesoMb: creatividad.pesoMb,
        estatusValidacion: creatividad.estatusValidacion,
        subioPorExterno: creatividad.subioPorExterno,
        creadoEn: creatividad.creadoEn,
      },
      mensaje: 'Creativo recibido correctamente',
    })
  })
}

export default fp(portalRoutes, { name: 'portal-routes' })
