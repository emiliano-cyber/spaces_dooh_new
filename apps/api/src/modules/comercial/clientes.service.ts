import type { PrismaClient } from '@prisma/client'
import { logAudit } from '../../core/audit/audit.service'
import type { CreateClienteInput } from './comercial.schemas'

export async function list(prisma: PrismaClient, search?: string) {
  const where: Record<string, unknown> = {}

  if (search) {
    where['OR'] = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { rfc: { contains: search, mode: 'insensitive' } },
    ]
  }

  return (prisma as any).cliente.findMany({
    where,
    orderBy: { nombre: 'asc' },
  })
}

export async function create(
  prisma: PrismaClient,
  data: CreateClienteInput,
  userId: string,
) {
  const cliente = await (prisma as any).cliente.create({
    data: {
      nombre: data.nombre,
      rfc: data.rfc ?? null,
      tipo: data.tipo ?? 'DIRECTO',
      contactoJson: data.contactoJson ?? {},
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'cliente.created',
    entidadTipo: 'Cliente',
    entidadId: cliente.id,
    cambiosJson: { nombre: cliente.nombre },
  })

  return cliente
}
