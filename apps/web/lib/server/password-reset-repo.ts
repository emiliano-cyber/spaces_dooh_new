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
//
//  ── `password_resets` es fail-closed desde el 07/08 ────────────────────────
//  Antes NO llevaba RLS y estos accesos iban por `qRaw`. Ahora la tabla está
//  bajo la misma política que el resto (20260807_password_resets_rls.sql), así
//  que:
//
//    · LEER va por `auth_reset_por_token()`, SECURITY DEFINER, porque resolver
//      un token es PRE-SESIÓN: todavía no se sabe de qué organización es quien
//      lo presenta. Igual que `auth_usuario_por_email()`.
//    · ESCRIBIR va por `qConTenant`, porque para entonces el tenant YA se
//      conoce — del usuario al crear, y de la propia fila al consumir.
//
//  Si alguien devuelve cualquiera de estos accesos a `qRaw`, el flujo NO falla:
//  devuelve cero filas y todos los enlaces pasan a ser «inválidos», en silencio.
//  Es el modo de fallo que dejó el desbloqueo roto un despliegue entero
//  (43f9284). Hay prueba de integración que lo cubre.
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
  // `qConTenant` y no `qRaw`: desde 20260807_password_resets_rls.sql la tabla es
  // fail-closed + FORCE, así que un INSERT sin `app.tenant_id` fallaría el WITH
  // CHECK. El tenant lo acabamos de resolver del propio usuario.
  await qConTenant(
    u.tenant_id,
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
    `select usuario_id, tenant_id, expira_en, usado_en from auth_reset_por_token($1)`,
    [token],
  )
  return !!row && !row.usado_en && new Date(row.expira_en) > new Date()
}

// Consume el token: valida, cambia la contraseña, invalida token y sesiones.
export async function consumirReset(token: string, nuevaPassword: string): Promise<void> {
  const row = await qRaw1<ResetRow>(
    `select usuario_id, tenant_id, expira_en, usado_en from auth_reset_por_token($1)`,
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
  // Un solo uso + invalida cualquier otro token pendiente del usuario. Con el
  // tenant de la fila y el filtro explícito además de la RLS — las dos capas.
  await qConTenant(
    row.tenant_id,
    `update password_resets set usado_en = now()
      where usuario_id = $1 and tenant_id = $2 and usado_en is null`,
    [row.usuario_id, row.tenant_id],
  )
  // Cierra todas las sesiones activas (fuerza reingreso con la nueva contraseña).
  await qRaw(`delete from sesiones where usuario_id = $1`, [row.usuario_id])
}
