import type { PrismaClient } from '@prisma/client'
import { logAudit } from '../../core/audit/audit.service'
import { eventBus } from '../../core/events/event-bus'
import type { CreateSitioInput, UpdateSitioInput } from './inmuebles.schemas'

interface ListFilters {
  ciudad?: string
  tipoMedio?: string
  estatusComercial?: string
  search?: string
  page?: number
  limit?: number
}

interface GeoJSONFilters {
  bbox?: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
}

export async function list(prisma: PrismaClient, filters: ListFilters) {
  const { ciudad, tipoMedio, estatusComercial, search, page = 1, limit = 50 } = filters
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (ciudad) where.ciudad = { contains: ciudad, mode: 'insensitive' }
  if (tipoMedio) where.tipoMedio = tipoMedio
  if (estatusComercial) where.estatusComercial = estatusComercial
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { claveInterna: { contains: search, mode: 'insensitive' } },
      { direccion: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    (prisma as any).sitio.findMany({
      where,
      orderBy: { nombre: 'asc' },
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            incidencias: { where: { estatus: 'ABIERTA' } },
          },
        },
      },
    }),
    (prisma as any).sitio.count({ where }),
  ])

  return {
    data: items,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  }
}

export async function getById(prisma: PrismaClient, id: string) {
  return (prisma as any).sitio.findUniqueOrThrow({
    where: { id },
    include: {
      contratos: {
        include: { arrendador: true },
        orderBy: { creadoEn: 'desc' },
      },
      licencias: { orderBy: { fechaVencimiento: 'asc' } },
      incidencias: {
        where: { estatus: { in: ['ABIERTA', 'EN_PROCESO'] } },
        orderBy: { creadoEn: 'desc' },
      },
    },
  })
}

export async function getMapGeoJSON(prisma: PrismaClient, filters: GeoJSONFilters) {
  const where: Record<string, unknown> = {}

  if (filters.bbox) {
    const [minLng, minLat, maxLng, maxLat] = filters.bbox
    where.lat = { gte: minLat, lte: maxLat }
    where.lng = { gte: minLng, lte: maxLng }
  }

  const sitios = await (prisma as any).sitio.findMany({
    where,
    select: {
      id: true,
      nombre: true,
      claveInterna: true,
      tipoMedio: true,
      estatusComercial: true,
      estatusLegal: true,
      estatusOperativo: true,
      lat: true,
      lng: true,
    },
  })

  return {
    type: 'FeatureCollection',
    features: sitios.map((s: any) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(s.lng), Number(s.lat)],
      },
      properties: {
        id: s.id,
        nombre: s.nombre,
        claveInterna: s.claveInterna,
        tipoMedio: s.tipoMedio,
        estatusComercial: s.estatusComercial,
        estatusLegal: s.estatusLegal,
        estatusOperativo: s.estatusOperativo,
      },
    })),
  }
}

export async function checkDisponibilidad(
  _prisma: PrismaClient,
  _sitioId: string,
  _fechaInicio: Date,
  _fechaFin: Date,
) {
  // Fase 2: CampaignLine no existe aún
  return { disponible: true, conflictos: [] }
}

export async function create(prisma: PrismaClient, data: CreateSitioInput, userId: string) {
  const sitio = await (prisma as any).sitio.create({ data })

  await logAudit(prisma, {
    userId,
    accion: 'sitio.created',
    entidadTipo: 'Sitio',
    entidadId: sitio.id,
  })

  return sitio
}

export async function update(
  prisma: PrismaClient,
  id: string,
  data: UpdateSitioInput,
  userId: string,
) {
  const current = await (prisma as any).sitio.findUniqueOrThrow({ where: { id } })

  const updated = await (prisma as any).sitio.update({ where: { id }, data })

  // Detectar campos que cambiaron para el audit
  const cambiosJson: Record<string, { antes: unknown; despues: unknown }> = {}
  for (const key of Object.keys(data)) {
    const k = key as keyof UpdateSitioInput
    if (data[k] !== undefined && String(current[k]) !== String(data[k])) {
      cambiosJson[key] = { antes: current[key], despues: data[k] }
    }
  }

  if (data.estatusComercial && data.estatusComercial !== current.estatusComercial) {
    eventBus.emit({
      type: 'sitio.estatus.changed',
      payload: {
        sitioId: id,
        tenantId: current.tenantId ?? userId, // tenantId se infiere del contexto externo
        estatusComercial: data.estatusComercial,
      },
    })
  }

  await logAudit(prisma, {
    userId,
    accion: 'sitio.updated',
    entidadTipo: 'Sitio',
    entidadId: id,
    cambiosJson,
  })

  return updated
}
