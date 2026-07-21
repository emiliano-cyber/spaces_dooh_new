import * as bcrypt from 'bcryptjs'
import { publicPrisma } from '../../db/client'

const USER_SELECT = { id: true, nombre: true, email: true, rolId: true, activo: true, creadoEn: true, tenantId: true }

export function list(tenantId: string) {
  return publicPrisma.user.findMany({ where: { tenantId }, select: USER_SELECT })
}

export async function create(data: {
  nombre: string
  email: string
  password: string
  rolId: string
  tenantId: string
}) {
  const passwordHash = await bcrypt.hash(data.password, 10)
  return publicPrisma.user.create({
    data: {
      tenantId: data.tenantId,
      nombre: data.nombre,
      email: data.email,
      passwordHash,
      rolId: data.rolId,
    },
    select: USER_SELECT,
  })
}

export function update(id: string, data: { nombre?: string; rolId?: string; activo?: boolean }) {
  return publicPrisma.user.update({ where: { id }, data, select: USER_SELECT })
}
