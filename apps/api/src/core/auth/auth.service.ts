import { createHash, randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import * as bcrypt from 'bcryptjs'
import type { AuthUser, LoginResponse } from '@spaces-dooh/types'
import { publicPrisma } from '../../db/client'

export interface LoginServiceResult extends LoginResponse {
  refreshToken: string
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    tenantId: user.tenantId,
    rol: user.rol,
    permisos: user.permisos,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(jwtSecret())
}

export async function login(
  email: string,
  password: string,
  tenantId: string,
): Promise<LoginServiceResult> {
  const dbUser = await publicPrisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  })

  if (!dbUser || !dbUser.activo) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
  }

  const valid = await bcrypt.compare(password, dbUser.passwordHash)
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
  }

  const role = await publicPrisma.role.findUnique({
    where: { tenantId_nombre: { tenantId, nombre: dbUser.rolId } },
  })

  const authUser: AuthUser = {
    id: dbUser.id,
    tenantId,
    rol: dbUser.rolId,
    permisos: (role?.permisos ?? []) as AuthUser['permisos'],
  }

  const accessToken = await signAccessToken(authUser)

  const tokenRaw = randomUUID()
  const tokenHash = sha256(tokenRaw)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await publicPrisma.refreshToken.create({
    data: { userId: dbUser.id, tokenHash, expiresAt },
  })

  return { accessToken, refreshToken: tokenRaw, user: authUser }
}

export async function refresh(
  tokenRaw: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = sha256(tokenRaw)

  const stored = await publicPrisma.refreshToken.findUnique({ where: { tokenHash } })

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 })
  }

  // Rotation: revoke old token
  await publicPrisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  })

  // Issue new refresh token
  const newRaw = randomUUID()
  const newHash = sha256(newRaw)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await publicPrisma.refreshToken.create({
    data: { userId: stored.userId, tokenHash: newHash, expiresAt },
  })

  // Rebuild AuthUser from DB to get fresh permisos
  const dbUser = await publicPrisma.user.findUnique({ where: { id: stored.userId } })
  if (!dbUser || !dbUser.activo) {
    throw Object.assign(new Error('User not found'), { statusCode: 401 })
  }

  const role = await publicPrisma.role.findUnique({
    where: { tenantId_nombre: { tenantId: dbUser.tenantId, nombre: dbUser.rolId } },
  })

  const authUser: AuthUser = {
    id: dbUser.id,
    tenantId: dbUser.tenantId,
    rol: dbUser.rolId,
    permisos: (role?.permisos ?? []) as AuthUser['permisos'],
  }

  const accessToken = await signAccessToken(authUser)

  return { accessToken, refreshToken: newRaw }
}

export async function logout(tokenRaw: string): Promise<void> {
  const tokenHash = sha256(tokenRaw)

  await publicPrisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
