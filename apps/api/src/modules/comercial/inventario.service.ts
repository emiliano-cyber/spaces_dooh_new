import type { PrismaClient } from '@prisma/client'

interface InventarioFilters {
  fechaInicio?: string
  fechaFin?: string
  ciudad?: string
  tipoMedio?: string
  search?: string
  page?: number
  limit?: number
  bbox?: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
}

async function buildQuery(prisma: PrismaClient, filters: InventarioFilters) {
  const limit = filters.limit ?? 50
  const page = filters.page ?? 1
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {
    estatusComercial: 'DISPONIBLE',
    estatusLegal: 'EN_ORDEN',
    estatusOperativo: 'ACTIVO',
  }

  if (filters.ciudad) where['ciudad'] = { contains: filters.ciudad, mode: 'insensitive' }
  if (filters.tipoMedio) where['tipoMedio'] = filters.tipoMedio
  if (filters.search) {
    where['OR'] = [
      { nombre: { contains: filters.search, mode: 'insensitive' } },
      { claveInterna: { contains: filters.search, mode: 'insensitive' } },
      { direccion: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  // Exclude sites with overlapping campaign lines
  if (filters.fechaInicio && filters.fechaFin) {
    where['NOT'] = {
      id: {
        in: await getOcupados(prisma, filters.fechaInicio, filters.fechaFin),
      },
    }
  }

  return { where, limit, skip }
}

async function getOcupados(
  prisma: PrismaClient,
  fechaInicio: string,
  fechaFin: string,
): Promise<string[]> {
  const lines = await (prisma as any).campaignLine.findMany({
    where: {
      estatus: 'ACTIVA',
      fechaInicio: { lt: new Date(fechaFin) },
      fechaFin: { gt: new Date(fechaInicio) },
    },
    select: { sitioId: true },
  })
  return lines.map((l: { sitioId: string }) => l.sitioId)
}

async function enrichSitios(prisma: PrismaClient, sitios: any[]) {
  return Promise.all(
    sitios.map(async (sitio) => {
      const [campanasActivas, incidenciasAbiertas] = await Promise.all([
        (prisma as any).campaignLine.count({
          where: {
            sitioId: sitio.id,
            estatus: 'ACTIVA',
            fechaFin: { gte: new Date() },
          },
        }),
        (prisma as any).incidencia.count({
          where: { sitioId: sitio.id, estatus: { in: ['ABIERTA', 'EN_PROCESO'] } },
        }),
      ])
      return {
        ...sitio,
        campanasActivas,
        tieneIncidencia: incidenciasAbiertas > 0,
      }
    }),
  )
}

export async function getDisponibles(prisma: PrismaClient, filters: InventarioFilters) {
  const { where, limit, skip } = await buildQuery(prisma, filters)

  const sitios = await (prisma as any).sitio.findMany({
    where,
    skip,
    take: limit,
    orderBy: [{ nombre: 'asc' }],
  })

  const enriched = await enrichSitios(prisma, sitios)

  // Sort: no incidencia first
  return enriched.sort((a, b) => {
    if (a.tieneIncidencia === b.tieneIncidencia) return 0
    return a.tieneIncidencia ? 1 : -1
  })
}

export async function getDisponiblesGeoJSON(
  prisma: PrismaClient,
  filters: InventarioFilters & { bbox?: [number, number, number, number] },
) {
  const { where } = await buildQuery(prisma, filters)

  if (filters.bbox) {
    const [minLng, minLat, maxLng, maxLat] = filters.bbox
    where['lat'] = { gte: minLat, lte: maxLat }
    where['lng'] = { gte: minLng, lte: maxLng }
  }

  const sitios = await (prisma as any).sitio.findMany({ where })
  const enriched = await enrichSitios(prisma, sitios)

  return {
    type: 'FeatureCollection' as const,
    features: enriched.map((s) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(s.lng), Number(s.lat)],
      },
      properties: {
        id: s.id,
        nombre: s.nombre,
        claveInterna: s.claveInterna,
        tipoMedio: s.tipoMedio,
        ciudad: s.ciudad,
        estatusComercial: s.estatusComercial,
        disponible: s.estatusComercial === 'DISPONIBLE',
        tieneIncidencia: s.tieneIncidencia,
        lat: Number(s.lat),
        lng: Number(s.lng),
      },
    })),
  }
}
