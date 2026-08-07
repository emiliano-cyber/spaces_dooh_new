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
  // ADR 0009: true tras un restablecimiento por un administrador. Mientras lo
  // esté, `exigir()` cierra todo salvo el cambio de la propia contraseña.
  debeCambiarPassword: boolean
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

// Contraseña que NADIE va a ver ni teclear, para las cuentas que entran por un
// proveedor externo (ADR 0012). La fila conserva un `password_hash` de un
// secreto aleatorio en vez de quedarse en NULL, y eso es deliberado:
//
//   · un usuario sin hash no puede desbloquear las operaciones de dinero ni
//     cambiar su propio perfil, y si un administrador le «restablece» la
//     contraseña queda ENCERRADO —la única salida le pide algo que nunca tuvo—.
//     Es el estado terminal que el ADR describe en su restricción 4;
//   · con hash, todo lo existente sigue funcionando igual y no hay que abrir un
//     segundo camino en `cambios.ts`, que gobierna las ocho rutas de dinero.
//
// Se CONSTRUYE cumpliendo `validarPassword` en vez de confiar en que el azar
// meta una letra y un dígito: base64url puede salir sin ninguno de los dos, y
// entonces el alta fallaría una vez de cada tantas, que es el peor tipo de
// fallo.
export function passwordAleatoria(): string {
  const cuerpo = randomBytes(24).toString('base64url').replace(/[^a-zA-Z0-9]/g, '')
  return `${cuerpo}aA1`
}

// Resuelve con qué contraseña nace una cuenta. La usan las DOS altas que
// admiten Google —usuario suelto y organización nueva—, y vive aquí para que no
// diverjan: si una de las dos se olvidara de comprobar que Google está
// habilitado, crearía cuentas incapaces de entrar y nadie sabría por qué.
export function passwordDeAlta(opts: {
  entraConGoogle?: boolean
  password?: string
  googleDisponible: boolean
}): { password: string } | { error: string } {
  if (opts.entraConGoogle) {
    if (!opts.googleDisponible) {
      return {
        error:
          'El acceso con Google no está disponible en este servidor. Crea la cuenta con una contraseña.',
      }
    }
    return { password: passwordAleatoria() }
  }
  const err = validarPassword(opts.password)
  if (err) return { error: err }
  return { password: opts.password as string }
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
    `select id, nombre, email, cargo, rol, activo, tenant_id as "tenantId",
            debe_cambiar_password as "debeCambiarPassword"
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
  // ADR 0009: con una contraseña temporal recién puesta por un administrador,
  // lo ÚNICO que se puede hacer es cambiarla.
  //
  // El corte NO puede condicionarse a que la ruta declare módulo. `/api/estado`
  // llama a `exigir()` a secas y devuelve TODO el conjunto de datos del tenant
  // —campañas, clientes, propuestas, cifras financieras—; con la condición
  // puesta en `modulo`, quien tuviera la temporal podía leerlo entero sin
  // cambiarla. Justo la ventana de suplantación que el forzado venía a cerrar.
  //
  // Por eso se corta SIEMPRE, sin excepciones ni listas que mantener. La salida
  // no hace falta abrirla aquí porque las dos rutas que el usuario necesita para
  // salir del estado —`/api/auth/me` (resolver la sesión) y `/api/perfil`
  // (cambiar la contraseña)— resuelven con `usuarioActual()` y nunca pasan por
  // este guard. Si alguna de las dos se migrara a `exigir()`, el usuario
  // quedaría encerrado sin poder cambiarla: está anotado en ambas.
  if (usuario.debeCambiarPassword) {
    return {
      ok: false,
      status: 403,
      error: 'Tienes una contraseña temporal. Cámbiala en Configuración antes de seguir.',
    }
  }
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
