import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
// tenants/sesiones están exentas de la RLS fail-closed (son pre-sesión), así que
// se consultan RAW, igual que auth.ts. Usar q() aquí recursaría.
import { qRaw as q, qRaw1 as q1 } from './db'
import { SESSION_COOKIE, exigir, usuarioActual, hashPassword, verifyPassword, validarPassword, type UsuarioSesion } from './auth'

// ============================================================================
//  lib/server/cambios.ts — Control de cambios con desbloqueo.
// ----------------------------------------------------------------------------
//  El Dueño hace cambios sin fricción. Los demás roles, para tocar dinero o
//  catálogo, tienen que teclear la contraseña que el Dueño fijó en
//  Administración; eso desbloquea SU sesión por un rato.
//
//  Dónde vive cada cosa y por qué:
//   • La contraseña: bcrypt en `tenants.cambios_password_hash`. Nunca en claro,
//     nunca viaja al cliente (ni siquiera el hash).
//   • El desbloqueo: `sesiones.desbloqueo_expira_en`, contra el token de sesión.
//     Vive en el SERVIDOR. Si estuviera en el navegador, cualquiera se lo
//     inventaría con las herramientas de desarrollo y el candado sería un adorno.
//
//  Apagado por defecto (hash null): encender esto por sorpresa dejaría al equipo
//  sin poder trabajar.
// ============================================================================

// Cuánto dura el desbloqueo. Suficiente para una tanda de correcciones, corto
// para que un equipo dejado a medias no quede abierto toda la tarde.
export const DESBLOQUEO_MINUTOS = 15

const ROL_SIN_CANDADO = 'DUENO'

function token(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null
}

async function hashDelTenant(tenantId: string | null): Promise<string | null> {
  if (!tenantId) return null
  const r = await q1<{ h: string | null }>(
    'select cambios_password_hash as h from tenants where id = $1',
    [tenantId],
  )
  return r?.h ?? null
}

export interface EstadoControlCambios {
  // ¿El Dueño puso contraseña? (nunca se expone la contraseña ni su hash)
  activo: boolean
  // ¿Este usuario necesita desbloquear para cambios sensibles?
  requiere: boolean
  // Hasta cuándo está desbloqueada esta sesión (ISO) o null.
  desbloqueadoHasta: string | null
  minutos: number
}

// Lo que la UI necesita saber: si hay candado, si a mí me aplica, y hasta cuándo
// estoy desbloqueado. No revela nada de la contraseña.
export async function estadoControlCambios(): Promise<EstadoControlCambios> {
  const u = await usuarioActual()
  const base = { activo: false, requiere: false, desbloqueadoHasta: null, minutos: DESBLOQUEO_MINUTOS }
  if (!u) return base
  const hash = await hashDelTenant(u.tenantId)
  const activo = !!hash
  if (!activo || u.rol === ROL_SIN_CANDADO) return { ...base, activo }
  const t = token()
  const s = t
    ? await q1<{ e: string | null }>(
        'select desbloqueo_expira_en as e from sesiones where token = $1 and expira_en > now()',
        [t],
      )
    : null
  const hasta = s?.e && new Date(s.e).getTime() > Date.now() ? new Date(s.e).toISOString() : null
  return { activo: true, requiere: true, desbloqueadoHasta: hasta, minutos: DESBLOQUEO_MINUTOS }
}

// Fija (o quita, con null) la contraseña de control de cambios. Solo el Dueño.
// Al cambiarla se cierran todos los desbloqueos vivos del tenant: si el Dueño la
// rota es porque no quiere que la anterior siga sirviendo.
export async function fijarPasswordCambios(
  tenantId: string,
  plano: string | null,
): Promise<{ error: string } | { ok: true; activo: boolean }> {
  if (plano !== null) {
    const malo = validarPassword(plano)
    if (malo) return { error: malo }
  }
  const hash = plano === null ? null : await hashPassword(plano)
  await q('update tenants set cambios_password_hash = $1 where id = $2', [hash, tenantId])
  await q(
    `update sesiones set desbloqueo_expira_en = null
      where usuario_id in (select id from usuarios where tenant_id = $1)`,
    [tenantId],
  )
  return { ok: true, activo: hash !== null }
}

// Verifica la contraseña y desbloquea ESTA sesión por DESBLOQUEO_MINUTOS.
// La comparación es bcrypt en el servidor: el cliente nunca ve el hash.
export async function desbloquear(
  password: string,
): Promise<{ ok: true; hasta: string } | { error: string; status: number }> {
  const u = await usuarioActual()
  if (!u) return { error: 'Sin sesión', status: 401 }
  const hash = await hashDelTenant(u.tenantId)
  if (!hash) return { error: 'El control de cambios no está activado', status: 400 }
  if (!(await verifyPassword(password, hash))) {
    return { error: 'Contraseña incorrecta', status: 403 }
  }
  const t = token()
  if (!t) return { error: 'Sin sesión', status: 401 }
  const hasta = new Date(Date.now() + DESBLOQUEO_MINUTOS * 60_000)
  await q('update sesiones set desbloqueo_expira_en = $1 where token = $2', [hasta.toISOString(), t])
  return { ok: true, hasta: hasta.toISOString() }
}

// Cierra el desbloqueo de esta sesión (botón "bloquear" o al terminar).
export async function bloquear(): Promise<void> {
  const t = token()
  if (t) await q('update sesiones set desbloqueo_expira_en = null where token = $1', [t])
}

export interface FaltaDesbloqueo {
  ok: false
  status: number
  error: string
  // Marca para que la UI abra el modal de contraseña en vez de mostrar un error.
  requiereDesbloqueo: true
}

// Guard para las rutas de cambios sensibles (dinero y catálogo). Se llama DESPUÉS
// de exigir(): primero el permiso del rol, luego el candado.
// Deja pasar si: es el Dueño, el control está apagado, o la sesión está
// desbloqueada y no ha expirado.
export async function exigirDesbloqueo(): Promise<{ ok: true } | FaltaDesbloqueo> {
  const u = await usuarioActual()
  if (!u) return { ok: false, status: 401, error: 'Sin sesión', requiereDesbloqueo: true }
  if (u.rol === ROL_SIN_CANDADO) return { ok: true }
  const hash = await hashDelTenant(u.tenantId)
  if (!hash) return { ok: true } // control apagado: todo sigue como antes
  const t = token()
  const s = t
    ? await q1<{ e: string | null }>('select desbloqueo_expira_en as e from sesiones where token = $1', [t])
    : null
  if (s?.e && new Date(s.e).getTime() > Date.now()) return { ok: true }
  return {
    ok: false,
    status: 403,
    error: 'Este cambio necesita la contraseña del Dueño.',
    requiereDesbloqueo: true,
  }
}

// Respuesta HTTP del guard. `requiereDesbloqueo` le dice a la UI que abra el
// modal de contraseña en vez de enseñar un error rojo.
export function respuestaDesbloqueo(d: FaltaDesbloqueo): NextResponse {
  return NextResponse.json({ error: d.error, requiereDesbloqueo: true }, { status: d.status })
}

// Azúcar para las rutas: exige permiso de rol Y desbloqueo, en ese orden.
// Devuelve la respuesta de error ya armada, o el usuario si todo pasa.
export async function exigirCambioSensible(
  modulo: string,
  accion: string,
): Promise<{ ok: true; usuario: UsuarioSesion } | { ok: false; res: NextResponse }> {
  const g = await exigir(modulo, accion)
  if (!g.ok) return { ok: false, res: NextResponse.json({ error: g.error }, { status: g.status }) }
  const d = await exigirDesbloqueo()
  if (!d.ok) return { ok: false, res: respuestaDesbloqueo(d) }
  return { ok: true, usuario: g.usuario }
}
