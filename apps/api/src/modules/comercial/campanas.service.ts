import type { PrismaClient } from '@prisma/client'
import { logAudit } from '../../core/audit/audit.service'
import { eventBus } from '../../core/events/event-bus'
import * as otsService from '../operaciones/ots.service'
import * as readinessService from './readiness.service'
import { ManualConnector } from '../../connectors/manual/manual.connector'
import type { TrafficInstruction } from '../../connectors/connector.interface'
import type { CreateCampanaInput, CreateCampaignLineInput } from './comercial.schemas'

const EDITABLE_ESTADOS = ['DRAFT', 'COTIZACION']

export async function generateFolio(prisma: PrismaClient): Promise<string> {
  const count = await (prisma as any).campana.count()
  const year = new Date().getFullYear()
  const seq = String(count + 1).padStart(4, '0')
  return `CAMP-${year}-${seq}`
}

async function generateTrafficFolio(prisma: PrismaClient): Promise<string> {
  const count = await (prisma as any).trafficOrder.count()
  const year = new Date().getFullYear()
  const seq = String(count + 1).padStart(4, '0')
  return `TO-${year}-${seq}`
}

interface ListFilters {
  estadoComercial?: string
  clienteId?: string
  search?: string
  fechaDesde?: string
  fechaHasta?: string
  page?: number
  limit?: number
}

export async function list(prisma: PrismaClient, filters: ListFilters) {
  const limit = filters.limit ?? 50
  const page = filters.page ?? 1
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (filters.estadoComercial) where['estadoComercial'] = filters.estadoComercial
  if (filters.clienteId) where['clienteId'] = filters.clienteId
  if (filters.search) {
    where['OR'] = [
      { nombre: { contains: filters.search, mode: 'insensitive' } },
      { folio: { contains: filters.search, mode: 'insensitive' } },
      { marca: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  if (filters.fechaDesde || filters.fechaHasta) {
    where['fechaInicio'] = {}
    if (filters.fechaDesde) (where['fechaInicio'] as any)['gte'] = new Date(filters.fechaDesde)
    if (filters.fechaHasta) (where['fechaInicio'] as any)['lte'] = new Date(filters.fechaHasta)
  }

  return (prisma as any).campana.findMany({
    where,
    skip,
    take: limit,
    include: {
      cliente: { select: { nombre: true } },
      _count: { select: { lines: true, trafficOrders: true } },
    },
    orderBy: { actualizadoEn: 'desc' },
  })
}

export async function getById(prisma: PrismaClient, id: string) {
  return (prisma as any).campana.findUnique({
    where: { id },
    include: {
      cliente: true,
      lines: true,
      creatividades: true,
      trafficOrders: true,
    },
  })
}

export async function create(
  prisma: PrismaClient,
  data: CreateCampanaInput,
  userId: string,
) {
  const folio = await generateFolio(prisma)

  const campana = await (prisma as any).campana.create({
    data: {
      folio,
      nombre: data.nombre,
      clienteId: data.clienteId,
      agencia: data.agencia ?? null,
      marca: data.marca ?? null,
      tipoCampana: data.tipoCampana,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      presupuestoBruto: data.presupuestoBruto ?? null,
      presupuestoNeto: data.presupuestoNeto ?? null,
      moneda: data.moneda ?? 'MXN',
      notas: data.notas ?? null,
      estadoComercial: 'DRAFT',
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'campana.created',
    entidadTipo: 'Campana',
    entidadId: campana.id,
    cambiosJson: { folio, nombre: campana.nombre },
  })

  return campana
}

export async function update(
  prisma: PrismaClient,
  id: string,
  data: Partial<CreateCampanaInput>,
  userId: string,
) {
  const existing = await (prisma as any).campana.findUniqueOrThrow({ where: { id } })

  if (!EDITABLE_ESTADOS.includes(existing.estadoComercial)) {
    const err = new Error('No se puede editar una campaña confirmada')
    ;(err as any).statusCode = 400
    throw err
  }

  const updated = await (prisma as any).campana.update({
    where: { id },
    data: {
      ...(data.nombre && { nombre: data.nombre }),
      ...(data.agencia !== undefined && { agencia: data.agencia }),
      ...(data.marca !== undefined && { marca: data.marca }),
      ...(data.tipoCampana && { tipoCampana: data.tipoCampana }),
      ...(data.fechaInicio && { fechaInicio: new Date(data.fechaInicio) }),
      ...(data.fechaFin && { fechaFin: new Date(data.fechaFin) }),
      ...(data.presupuestoBruto !== undefined && { presupuestoBruto: data.presupuestoBruto }),
      ...(data.presupuestoNeto !== undefined && { presupuestoNeto: data.presupuestoNeto }),
      ...(data.moneda && { moneda: data.moneda }),
      ...(data.notas !== undefined && { notas: data.notas }),
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'campana.updated',
    entidadTipo: 'Campana',
    entidadId: id,
    cambiosJson: data as Record<string, unknown>,
  })

  return updated
}

export async function confirmar(
  prisma: PrismaClient,
  campanaId: string,
  userId: string,
  tenantId: string,
) {
  const campana = await (prisma as any).campana.findUniqueOrThrow({
    where: { id: campanaId },
    include: {
      lines: true,
      cliente: { select: { nombre: true } },
      creatividades: true,
    },
  })

  if (!EDITABLE_ESTADOS.includes(campana.estadoComercial)) {
    const err = new Error('Solo se puede confirmar una campaña en DRAFT o COTIZACION')
    ;(err as any).statusCode = 400
    throw err
  }

  if (campana.lines.length === 0) {
    const err = new Error('La campaña debe tener al menos una línea de campaña')
    ;(err as any).statusCode = 400
    throw err
  }

  if (new Date(campana.fechaInicio) < new Date(new Date().toDateString())) {
    const err = new Error('La fecha de inicio debe ser mayor o igual a hoy')
    ;(err as any).statusCode = 400
    throw err
  }

  const updated = await (prisma as any).campana.update({
    where: { id: campanaId },
    data: { estadoComercial: 'CONFIRMADA' },
  })

  // OOH / HIBRIDA → create OrdenTrabajo
  if (['OOH', 'HIBRIDA'].includes(campana.tipoCampana)) {
    const primeraLine = campana.lines[0]
    await otsService.create(
      prisma,
      {
        tipo: 'MONTAJE_LONA',
        descripcion: `Montaje campaña ${campana.nombre}`,
        campanaId: campana.id,
        sitioId: primeraLine?.sitioId,
        checklist: [
          { texto: 'Verificar estado del sitio' },
          { texto: 'Instalar material' },
          { texto: 'Fotografiar instalación' },
          { texto: 'Confirmar visibilidad' },
        ],
      },
      userId,
    )
  }

  // DOOH / HIBRIDA → create TrafficOrders per line
  if (['DOOH', 'HIBRIDA'].includes(campana.tipoCampana)) {
    const connector = new ManualConnector()

    for (const line of campana.lines) {
      const instruction: TrafficInstruction = {
        campanaId: campana.id,
        trafficOrderId: '', // will be filled after creation
        campanaFolio: campana.folio,
        clienteNombre: campana.cliente.nombre,
        pantallasExternas: line.pantallasIds ?? [],
        creatividades: campana.creatividades.map((c: any) => ({
          url: c.archivoUrl ?? '',
          storageKey: c.storageKey ?? '',
          formato: c.formato ?? '',
          duracionSeg: c.duracionSeg ?? 0,
          resolucion: c.resolucion ?? '',
        })),
        horario: {
          fechaInicio: new Date(campana.fechaInicio),
          fechaFin: new Date(campana.fechaFin),
          horaInicio: line.horarioJson?.horaInicio,
          horaFin: line.horarioJson?.horaFin,
          diasSemana: line.horarioJson?.diasSemana,
        },
        prioridad: 5,
        tipoVenta: line.tipoVenta,
      }

      const { referenciaExterna } = await connector.publish(instruction)
      const folio = await generateTrafficFolio(prisma)

      await (prisma as any).trafficOrder.create({
        data: {
          folio,
          campanaId: campana.id,
          campaignLineId: line.id,
          connectorTipo: 'MANUAL',
          instruccionJson: instruction as unknown as Record<string, unknown>,
          referenciaExterna,
          estadoTecnico: 'PENDIENTE',
        },
      })
    }
  }

  eventBus.emit({
    type: 'campana.confirmada',
    payload: { campanaId, tenantId, tipoCampana: campana.tipoCampana },
  })

  await logAudit(prisma, {
    userId,
    accion: 'campana.confirmada',
    entidadTipo: 'Campana',
    entidadId: campanaId,
    cambiosJson: { tipoCampana: campana.tipoCampana, linesCount: campana.lines.length },
  })

  return updated
}

export async function cancelar(
  prisma: PrismaClient,
  campanaId: string,
  motivo: string,
  userId: string,
) {
  const campana = await (prisma as any).campana.findUniqueOrThrow({
    where: { id: campanaId },
    include: {
      trafficOrders: {
        where: { estadoTecnico: { notIn: ['FINALIZADA', 'PAUSADA'] } },
      },
    },
  })

  if (campana.estadoComercial === 'LISTA_FACTURAR') {
    const err = new Error('No se puede cancelar una campaña lista para facturar')
    ;(err as any).statusCode = 400
    throw err
  }

  const updated = await (prisma as any).campana.update({
    where: { id: campanaId },
    data: { estadoComercial: 'CANCELADA', notas: motivo },
  })

  // Cancel active traffic orders
  if (campana.trafficOrders.length > 0) {
    const connector = new ManualConnector()
    for (const to of campana.trafficOrders) {
      if (to.referenciaExterna) {
        try {
          await connector.cancel(to.referenciaExterna)
        } catch {
          // log but don't fail
          console.warn(`[cancelar] No se pudo cancelar TO ${to.id} en CMS`)
        }
      }
    }
  }

  await logAudit(prisma, {
    userId,
    accion: 'campana.cancelada',
    entidadTipo: 'Campana',
    entidadId: campanaId,
    cambiosJson: { motivo },
  })

  return updated
}

export async function addLine(
  prisma: PrismaClient,
  campanaId: string,
  data: CreateCampaignLineInput,
  userId: string,
  tenantId: string,
) {
  const campana = await (prisma as any).campana.findUniqueOrThrow({ where: { id: campanaId } })

  if (!EDITABLE_ESTADOS.includes(campana.estadoComercial)) {
    const err = new Error('Solo se pueden agregar líneas a campañas en DRAFT o COTIZACION')
    ;(err as any).statusCode = 400
    throw err
  }

  const line = await (prisma as any).campaignLine.create({
    data: {
      campanaId,
      sitioId: data.sitioId,
      pantallasIds: data.pantallasIds ?? [],
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      tipoVenta: data.tipoVenta,
      precio: data.precio,
      cantidad: data.cantidad ?? 1,
      unidad: data.unidad ?? 'DIA',
      duracionSpot: data.duracionSpot ?? null,
      frecuencia: data.frecuencia ?? null,
      horarioJson: data.horarioJson ?? {},
    },
  })

  await readinessService.check(prisma, campanaId, tenantId, userId)

  return line
}

export async function removeLine(
  prisma: PrismaClient,
  campanaId: string,
  lineId: string,
  userId: string,
  tenantId: string,
) {
  const campana = await (prisma as any).campana.findUniqueOrThrow({ where: { id: campanaId } })

  if (!EDITABLE_ESTADOS.includes(campana.estadoComercial)) {
    const err = new Error('Solo se pueden eliminar líneas de campañas en DRAFT o COTIZACION')
    ;(err as any).statusCode = 400
    throw err
  }

  await (prisma as any).campaignLine.delete({ where: { id: lineId } })

  await readinessService.check(prisma, campanaId, tenantId, userId)
}

export async function activatePortal(
  prisma: PrismaClient,
  campanaId: string,
  userId: string,
  tenantSlug: string,
) {
  const { randomUUID } = await import('node:crypto')
  const portalToken = randomUUID()

  await (prisma as any).campana.update({
    where: { id: campanaId },
    data: { portalToken, portalActivo: true },
  })

  await logAudit(prisma, {
    userId,
    accion: 'campana.portal.activated',
    entidadTipo: 'Campana',
    entidadId: campanaId,
    cambiosJson: { portalToken },
  })

  return {
    portalToken,
    url: `https://portal.${tenantSlug}.spaces.com/${portalToken}`,
  }
}
