import 'server-only'
import { randomBytes } from 'crypto'
import { qRaw, qRaw1, qConTenant } from './db'
import { hashPassword, validarPassword } from './auth'
import { AppError } from './errores'

// ============================================================================
//  lib/server/password-reset-repo.ts — Recuperar contraseña (pre-sesión).
//
//  crearReset: dado un correo, si existe un usuario ACTIVO, genera un token de
//  un solo uso (60 min). No revela si el correo existe (eso lo decide la ruta,
//  que siempre responde igual). La lectura del usuario va por la función
//  SECURITY DEFINER auth_usuario_por_email (usuarios es fail-closed).
//
//  consumirReset: valida el token y, con el tenant guardado, actualiza la
//  contraseña vía qConTenant, marca el token usado, invalida los demás tokens y
//  cierra todas las sesiones del usuario.
// ============================================================================

const VIGENCIA_MIN = 60

interface UsuarioAuth {
  id: string
  nombre: string
  email: string
  activo: boolean
  tenant_id: string
}

export interface ResetCreado {
  token: string
  usuarioId: string
  nombre: string
  email: string
}

// Crea un token de reseteo para el correo dado. Devuelve null si no hay un
// usuario activo con ese correo (el llamador responde igual en ambos casos).
export async function crearReset(email: string): Promise<ResetCreado | null> {
  const u = await qRaw1<UsuarioAuth>(
    `select id, nombre, email, activo, tenant_id from auth_usuario_por_email($1)`,
    [email.trim()],
  )
  if (!u || !u.activo) return null

  const token = randomBytes(32).toString('hex')
  const expira = new Date(Date.now() + VIGENCIA_MIN * 60_000)
  await qRaw(
    `insert into password_resets (token, usuario_id, tenant_id, expira_en) values ($1,$2,$3,$4)`,
    [token, u.id, u.tenant_id, expira.toISOString()],
  )
  return { token, usuarioId: u.id, nombre: u.nombre, email: u.email }
}

interface ResetRow {
  usuario_id: string
  tenant_id: string
  expira_en: string
  usado_en: string | null
}

// ¿El token existe, no se usó y no expiró? (para mostrar el formulario o no).
export async function tokenResetValido(token: string): Promise<boolean> {
  if (!token) return false
  const row = await qRaw1<ResetRow>(
    `select usuario_id, tenant_id, expira_en, usado_en from password_resets where token = $1`,
    [token],
  )
  return !!row && !row.usado_en && new Date(row.expira_en) > new Date()
}

// Consume el token: valida, cambia la contraseña, invalida token y sesiones.
export async function consumirReset(token: string, nuevaPassword: string): Promise<void> {
  const row = await qRaw1<ResetRow>(
    `select usuario_id, tenant_id, expira_en, usado_en from password_resets where token = $1`,
    [token],
  )
  if (!row) throw new AppError('El enlace no es válido.', 400)
  if (row.usado_en) throw new AppError('Este enlace ya se usó. Solicita uno nuevo.', 400)
  if (new Date(row.expira_en) <= new Date()) throw new AppError('El enlace expiró. Solicita uno nuevo.', 400)

  const err = validarPassword(nuevaPassword)
  if (err) throw new AppError(err, 400)

  const hash = await hashPassword(nuevaPassword)
  // usuarios es fail-closed: la escritura va con el tenant del token.
  await qConTenant(
    row.tenant_id,
    `update usuarios set password_hash = $1 where id = $2 and tenant_id = $3`,
    [hash, row.usuario_id, row.tenant_id],
  )
  // Un solo uso + invalida cualquier otro token pendiente del usuario.
  await qRaw(`update password_resets set usado_en = now() where usuario_id = $1 and usado_en is null`, [
    row.usuario_id,
  ])
  // Cierra todas las sesiones activas (fuerza reingreso con la nueva contraseña).
  await qRaw(`delete from sesiones where usuario_id = $1`, [row.usuario_id])
}
