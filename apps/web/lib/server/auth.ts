import 'server-only'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
// Autenticación (usuarios/sesiones): consultas RAW sin GUC. El login resuelve al
// usuario ANTES de conocer el tenant; usuarios/tenants están exentas de RLS
// fail-closed. Usar q() aquí recursaría (q -> tenantActual -> usuarioActual -> q).
import { qRaw as q, qRaw1 as q1 } from './db'

// ============================================================================
//  lib/server/auth.ts — Contraseñas (bcrypt), sesiones (cookie httpOnly) y
//  permisos por rol. Solo servidor.
// ============================================================================

export const SESSION_COOKIE = 'spaces_sesion'
const SESSION_DAYS = 30

export interface UsuarioSesion {
  id: string
  nombre: string
  email: string
  cargo: string | null
  rol: string
  activo: boolean
  tenantId: string | null
}

// ─── Contraseñas ────────────────────────────────────────────────────────────
// Política de contraseñas: mínimo 8, con al menos una letra y un número. Devuelve
// un mensaje de error si no cumple, o null si es válida. Único origen de verdad
// para signup, alta de usuarios y cambio de contraseña (perfil).
export function validarPassword(plano: unknown): string | null {
  const p = typeof plano === 'string' ? plano : ''
  if (p.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (!/[a-zA-Z]/.test(p)) return 'La contraseña debe incluir al menos una letra'
  if (!/[0-9]/.test(p)) return 'La contraseña debe incluir al menos un número'
  if (/\s/.test(p)) return 'La contraseña no puede contener espacios'
  return null
}

export function hashPassword(plano: string): Promise<string> {
  return bcrypt.hash(plano, 10)
}
export function verifyPassword(plano: string, hash: string | null): Promise<boolean> {
  if (!hash) return Promise.resolve(false)
  return bcrypt.compare(plano, hash)
}

// ─── Sesiones ───────────────────────────────────────────────────────────────
export async function crearSesion(usuarioId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expira = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await q('insert into sesiones (token, usuario_id, expira_en) values ($1,$2,$3)', [
    token,
    usuarioId,
    expira.toISOString(),
  ])
  return token
}

export async function destruirSesion(token: string): Promise<void> {
  await q('delete from sesiones where token = $1', [token])
}

// Usuario de la sesión actual (lee la cookie). null si no hay/expiró.
export async function usuarioActual(): Promise<UsuarioSesion | null> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null
  // `usuarios` es fail-closed + FORCE (Hardening 1 · Bloque A) y aquí todavía no
  // hay tenant que fijar: la sesión es justo lo que estamos resolviendo. Va por
  // la función SECURITY DEFINER acotada, que devuelve una sola fila por token.
  const u = await q1<UsuarioSesion>(
    `select id, nombre, email, cargo, rol, activo, tenant_id as "tenantId"
       from auth_usuario_por_sesion($1)`,
    [token],
  )
  if (!u || !u.activo) return null
  return u
}

// ─── Permisos ───────────────────────────────────────────────────────────────
// Devuelve { modulo: [acciones] } para un rol.
export async function permisosDeRol(rol: string): Promise<Record<string, string[]>> {
  const rows = await q<{ modulo: string; accion: string }>(
    'select modulo, accion from rol_permisos where rol = $1',
    [rol],
  )
  const out: Record<string, string[]> = {}
  for (const r of rows) (out[r.modulo] ??= []).push(r.accion)
  return out
}

export async function tienePermiso(rol: string, modulo: string, accion: string): Promise<boolean> {
  const r = await q1(
    'select 1 from rol_permisos where rol = $1 and modulo = $2 and accion = $3',
    [rol, modulo, accion],
  )
  return !!r
}

// Guard para route handlers: exige sesión y, si se indica, un permiso concreto.
// Devuelve el usuario o un objeto de error con su status (401/403).
export async function exigir(
  modulo?: string,
  accion?: string,
): Promise<{ ok: true; usuario: UsuarioSesion } | { ok: false; status: number; error: string }> {
  const usuario = await usuarioActual()
  if (!usuario) return { ok: false, status: 401, error: 'Sin sesión' }
  if (modulo && accion && !(await tienePermiso(usuario.rol, modulo, accion))) {
    return { ok: false, status: 403, error: 'No tienes permiso para esta acción' }
  }
  return { ok: true, usuario }
}

// Cookie `Secure` (Hardening 1 · Bloque E): en producción va ON por default y
// solo se apaga con COOKIE_SECURE=0 explícito (dev local sobre HTTP). Fuera de
// producción va OFF salvo COOKIE_SECURE=1. Así prod nunca manda la sesión en
// claro por un olvido de env, pero el dev local sigue funcionando sobre HTTP.
export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === '1') return true
  if (process.env.COOKIE_SECURE === '0') return false
  return process.env.NODE_ENV === 'production'
}

// Opciones de cookie de sesión (para set/clear en las respuestas).
export function cookieSesion(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cookieSecure(),
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  }
}

// ─── CSRF (double-submit cookie) ────────────────────────────────────────────
// Token anti-CSRF: se emite junto con la sesión como cookie LEGIBLE por JS
// (httpOnly:false a propósito) y el front lo reenvía en el header X-CSRF-Token.
// El middleware exige que header == cookie en toda mutación con sesión. Un sitio
// atacante no puede leer la cookie (SOP) ni fijar el header cross-site, así que
// no puede falsificar la pareja. `sameSite: lax` se mantiene como primera capa.
export const CSRF_COOKIE = 'spaces_csrf'
export const CSRF_HEADER = 'x-csrf-token'

export function nuevoCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

export function cookieCsrf(token: string) {
  return {
    name: CSRF_COOKIE,
    value: token,
    httpOnly: false, // el front DEBE poder leerla para reenviarla en el header
    sameSite: 'lax' as const,
    secure: cookieSecure(),
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  }
}
