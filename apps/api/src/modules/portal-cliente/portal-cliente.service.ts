import * as bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { PrismaClient } from '@prisma/client'
import { buildKey, getPresignedUpload, getPresignedGet } from '../../db/storage'

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function loginCliente(
  prisma: PrismaClient,
  email: string,
  password: string,
  tenantId: string,
) {
  const cliente = await (prisma as any).portalCliente.findUnique({ where: { email } })
  if (!cliente || !cliente.activo) {
    throw Object.assign(new Error('Credenciales incorrectas'), { statusCode: 401 })
  }
  const valid = await bcrypt.compare(password, cliente.passwordHash)
  if (!valid) {
    throw Object.assign(new Error('Credenciales incorrectas'), { statusCode: 401 })
  }

  const token = await new SignJWT({ tenantId, tipo: 'portal_cliente', nombre: cliente.nombre })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(cliente.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(jwtSecret())

  return { token, nombre: cliente.nombre, id: cliente.id }
}

export async function verifyPortalToken(token: string) {
  const { payload } = await jwtVerify<{ tenantId: string; tipo: string; nombre: string }>(
    token,
    jwtSecret(),
  )
  if (payload.tipo !== 'portal_cliente') throw new Error('Token inválido')
  return { clienteId: payload.sub!, tenantId: payload.tenantId, nombre: payload.nombre }
}

// ── Sitios ───────────────────────────────────────────────────────────────────

export async function getSitiosCliente(prisma: PrismaClient, clienteId: string) {
  const asignaciones = await (prisma as any).portalClienteSitio.findMany({
    where: { clienteId },
  })

  const sitioIds = asignaciones.map((a: any) => a.sitioId)
  if (sitioIds.length === 0) return []

  const sitios = await (prisma as any).sitio.findMany({
    where: { id: { in: sitioIds } },
    select: {
      id: true, nombre: true, claveInterna: true, ciudad: true, estado: true,
      direccion: true, tipoMedio: true, estatusOperativo: true,
    },
  })

  const ots = await (prisma as any).ordenTrabajo.findMany({
    where: { sitioId: { in: sitioIds } },
    select: { sitioId: true, estatus: true, instrucciones: true },
  })

  const stats: Record<string, { total: number; completadas: number; avanceSum: number }> = {}
  for (const o of ots) {
    if (!o.sitioId) continue
    if (o.estatus === 'CANCELADA') continue
    const s = stats[o.sitioId] ?? { total: 0, completadas: 0, avanceSum: 0 }
    s.total += 1
    if (o.estatus === 'COMPLETADA') s.completadas += 1
    s.avanceSum += avancePorOT(o.instrucciones, o.estatus)
    stats[o.sitioId] = s
  }

  return sitios.map((s: any) => {
    const st = stats[s.id] ?? { total: 0, completadas: 0, avanceSum: 0 }
    return {
      ...s,
      totalOTs: st.total,
      otsCompletadas: st.completadas,
      porcentajeAvance: st.total > 0 ? Math.round(st.avanceSum / st.total) : null,
    }
  })
}

function avancePorOT(instrucciones: string | null | undefined, estatus: string): number {
  if (instrucciones) {
    const m = instrucciones.match(/Avance:\s*(\d+(?:\.\d+)?)\s*%/i)
    if (m) return Math.max(0, Math.min(100, parseFloat(m[1])))
  }
  return estatus === 'COMPLETADA' ? 100 : 0
}

export async function getSitioDetalle(prisma: PrismaClient, clienteId: string, sitioId: string) {
  const acceso = await (prisma as any).portalClienteSitio.findUnique({
    where: { clienteId_sitioId: { clienteId, sitioId } },
  })
  if (!acceso) throw Object.assign(new Error('Sin acceso a este sitio'), { statusCode: 403 })

  const sitio = await (prisma as any).sitio.findUniqueOrThrow({
    where: { id: sitioId },
    select: { id: true, nombre: true, claveInterna: true, ciudad: true, estado: true, direccion: true, tipoMedio: true },
  })

  const ots = await (prisma as any).ordenTrabajo.findMany({
    where: { sitioId },
    orderBy: { creadoEn: 'desc' },
    select: {
      id: true, folio: true, tipo: true, descripcion: true, estatus: true,
      prioridad: true, fechaProgramada: true, fechaCompletada: true, creadoEn: true,
    },
  })

  const otIds = ots.map((o: any) => o.id)
  const comentariosCounts = await (prisma as any).comentarioPublico.groupBy({
    by: ['otId'],
    where: { otId: { in: otIds } },
    _count: { id: true },
  })
  const countMap: Record<string, number> = {}
  for (const c of comentariosCounts) countMap[c.otId] = c._count.id

  return {
    sitio,
    ots: ots.map((o: any) => ({ ...o, totalComentarios: countMap[o.id] ?? 0 })),
  }
}

// ── OT detalle con comentarios ────────────────────────────────────────────────

export async function getOTDetalle(prisma: PrismaClient, clienteId: string, otId: string) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({
    where: { id: otId },
    include: { evidencias: { orderBy: { timestamp: 'asc' } } },
  })

  if (ot.sitioId) {
    const acceso = await (prisma as any).portalClienteSitio.findUnique({
      where: { clienteId_sitioId: { clienteId, sitioId: ot.sitioId } },
    })
    if (!acceso) throw Object.assign(new Error('Sin acceso a este reporte'), { statusCode: 403 })
  }

  const sitio = ot.sitioId
    ? await (prisma as any).sitio.findUnique({
        where: { id: ot.sitioId },
        select: { nombre: true, claveInterna: true },
      })
    : null

  ot.evidencias = await Promise.all(
    ot.evidencias.map(async (ev: any) => ({
      ...ev,
      fotoUrlSigned: await getPresignedGet(ev.storageKey),
    })),
  )

  const comentarios = await getComentarios(prisma, otId)

  return { ot: { ...ot, sitioNombre: sitio ? `${sitio.claveInterna} — ${sitio.nombre}` : null }, comentarios }
}

// ── Comentarios ───────────────────────────────────────────────────────────────

export async function getComentarios(prisma: PrismaClient, otId: string) {
  const comentarios = await (prisma as any).comentarioPublico.findMany({
    where: { otId },
    orderBy: { timestamp: 'asc' },
  })
  return Promise.all(
    comentarios.map(async (c: any) => ({
      ...c,
      fotoUrlSigned: c.storageKey ? await getPresignedGet(c.storageKey) : null,
    })),
  )
}

export async function addComentarioCliente(
  prisma: PrismaClient,
  clienteId: string,
  otId: string,
  texto: string,
  storageKey?: string,
) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })
  if (ot.sitioId) {
    const acceso = await (prisma as any).portalClienteSitio.findUnique({
      where: { clienteId_sitioId: { clienteId, sitioId: ot.sitioId } },
    })
    if (!acceso) throw Object.assign(new Error('Sin acceso'), { statusCode: 403 })
  }

  const cliente = await (prisma as any).portalCliente.findUniqueOrThrow({ where: { id: clienteId } })
  const fotoUrl = storageKey ? `https://placeholder.storage/${storageKey}` : null

  return (prisma as any).comentarioPublico.create({
    data: {
      otId,
      texto,
      fotoUrl,
      storageKey: storageKey ?? null,
      autorTipo: 'cliente',
      autorNombre: cliente.nombre,
      clienteId,
    },
  })
}

export async function addComentarioTecnico(
  prisma: PrismaClient,
  userId: string,
  userName: string,
  otId: string,
  texto: string,
  storageKey?: string,
) {
  const fotoUrl = storageKey ? `https://placeholder.storage/${storageKey}` : null
  return (prisma as any).comentarioPublico.create({
    data: {
      otId,
      texto,
      fotoUrl,
      storageKey: storageKey ?? null,
      autorTipo: 'tecnico',
      autorNombre: userName,
      userId,
    },
  })
}

export async function getUploadUrl(tenantId: string, otId: string, filename: string) {
  const key = buildKey(tenantId, 'comentarios', otId, filename)
  const uploadUrl = await getPresignedUpload(key, 'image/jpeg')
  return { uploadUrl, key }
}

// ── Admin: gestión de portal clientes ────────────────────────────────────────

export async function createPortalCliente(
  prisma: PrismaClient,
  data: { email: string; password: string; nombre: string },
) {
  const passwordHash = await bcrypt.hash(data.password, 12)
  return (prisma as any).portalCliente.create({
    data: { email: data.email, passwordHash, nombre: data.nombre },
    select: { id: true, email: true, nombre: true, activo: true, creadoEn: true },
  })
}

export async function listPortalClientes(prisma: PrismaClient) {
  return (prisma as any).portalCliente.findMany({
    select: {
      id: true, email: true, nombre: true, activo: true, creadoEn: true,
      sitios: { select: { sitioId: true } },
    },
    orderBy: { creadoEn: 'desc' },
  })
}

export async function asignarSitios(prisma: PrismaClient, clienteId: string, sitioIds: string[]) {
  await (prisma as any).portalClienteSitio.deleteMany({ where: { clienteId } })
  if (sitioIds.length > 0) {
    await (prisma as any).portalClienteSitio.createMany({
      data: sitioIds.map((sitioId) => ({ clienteId, sitioId })),
      skipDuplicates: true,
    })
  }
  return (prisma as any).portalCliente.findUnique({
    where: { id: clienteId },
    select: { id: true, email: true, nombre: true, sitios: { select: { sitioId: true } } },
  })
}

export async function toggleActivoCliente(prisma: PrismaClient, clienteId: string, activo: boolean) {
  return (prisma as any).portalCliente.update({
    where: { id: clienteId },
    data: { activo },
    select: { id: true, nombre: true, activo: true },
  })
}
