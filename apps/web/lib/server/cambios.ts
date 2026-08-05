import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
// tenants/sesiones están exentas de la RLS fail-closed (son pre-sesión), así que
// se consultan RAW, igual que auth.ts. Usar q() aquí recursaría.
import { qRaw as q, qRaw1 as q1, qConTenant } from './db'
import { SESSION_COOKIE, exigir, usuarioActual, verifyPassword, type UsuarioSesion } from './auth'
import { MENSAJE_DESBLOQUEO } from '@/lib/cambios-mensajes'

// ============================================================================
//  lib/server/cambios.ts — Control de cambios con reautenticación INDIVIDUAL.
// ----------------------------------------------------------------------------
//  Para tocar dinero o catálogo hay que volver a teclear LA PROPIA contraseña
//  de login; eso desbloquea esa sesión por un rato. ADR 0009.
//
//  Antes esto era una contraseña ÚNICA por tenant (`cambios_password_hash`) que
//  todo el equipo compartía. Se retiró porque un secreto colectivo no prueba
//  identidad: la bitácora afirmaba «Ana facturó» cuando lo único verificado era
//  «alguien que conoce el secreto del equipo facturó», y esa es la peor
//  propiedad que puede tener un registro de auditoría en un sistema que mueve
//  dinero. Con la contraseña propia, cada desbloqueo sí prueba quién era, y dar
//  de baja a una persona basta para revocarle el acceso — antes había que rotar
//  la contraseña de todos.
//
//  Dónde vive cada cosa y por qué:
//   • La contraseña: `usuarios.password_hash`, la de siempre. No hay ningún
//     secreto nuevo que guardar ni que rotar.
//   • El desbloqueo: `sesiones.desbloqueo_expira_en`, contra el token de sesión.
//     Vive en el SERVIDOR. Si estuviera en el navegador, cualquiera se lo
//     inventaría con las herramientas de desarrollo y el candado sería un adorno.
//
//  Apagado por defecto (`tenants.exigir_reautenticacion = false`): encender esto
//  por sorpresa dejaría al equipo sin poder trabajar.
//
//  NO hay exención por rol. La había para el Dueño y se retiró: con la
//  contraseña propia el coste para él es el mismo que para los demás —teclear lo
//  que ya sabe—, así que la exención dejó de comprar comodidad y solo compraba
//  riesgo. Es justo la sesión del Dueño la que más daño hace desatendida.
// ============================================================================

// Cuánto dura el desbloqueo. Suficiente para una tanda de correcciones, corto
// para que un equipo dejado a medias no quede abierto toda la tarde.
export const DESBLOQUEO_MINUTOS = 15

function token(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null
}

async function exigeReautenticacion(tenantId: string | null): Promise<boolean> {
  if (!tenantId) return false
  const r = await q1<{ e: boolean }>(
    'select exigir_reautenticacion as e from tenants where id = $1',
    [tenantId],
  )
  return !!r?.e
}

// Hasta cuándo está desbloqueada la sesión del token dado, o null.
async function desbloqueoVigente(t: string | null): Promise<string | null> {
  if (!t) return null
  const s = await q1<{ e: string | null }>(
    'select desbloqueo_expira_en as e from sesiones where token = $1',
    [t],
  )
  if (!s?.e) return null
  return new Date(s.e).getTime() > Date.now() ? new Date(s.e).toISOString() : null
}

export interface EstadoControlCambios {
  // ¿El tenant exige reautenticación para cambios sensibles?
  activo: boolean
  // ¿Este usuario necesita desbloquear? Sin exenciones, es igual que `activo`;
  // se mantiene separado porque la UI ya lo consume y porque un futuro ADR
  // podría reintroducir excepciones (documentadas, no por rol).
  requiere: boolean
  // Hasta cuándo está desbloqueada esta sesión (ISO) o null.
  desbloqueadoHasta: string | null
  minutos: number
}

// Lo que la UI necesita saber: si hay candado y hasta cuándo estoy desbloqueado.
export async function estadoControlCambios(): Promise<EstadoControlCambios> {
  const u = await usuarioActual()
  const base = { activo: false, requiere: false, desbloqueadoHasta: null, minutos: DESBLOQUEO_MINUTOS }
  if (!u) return base
  const activo = await exigeReautenticacion(u.tenantId)
  if (!activo) return base
  return {
    activo: true,
    requiere: true,
    desbloqueadoHasta: await desbloqueoVigente(token()),
    minutos: DESBLOQUEO_MINUTOS,
  }
}

// Enciende o apaga la exigencia de reautenticación del tenant. Solo el Dueño.
// Ya no recibe ninguna contraseña: no hay secreto que fijar.
//
// Al APAGARLO no se cierran los desbloqueos vivos (no hay nada que revocar: se
// concedieron con la contraseña personal de cada quien, que sigue siendo válida).
// Al ENCENDERLO sí se cierran, para que nadie herede un desbloqueo de antes de
// que el candado existiera.
export async function fijarExigirReautenticacion(
  tenantId: string,
  exigir: boolean,
): Promise<{ ok: true; activo: boolean }> {
  await q('update tenants set exigir_reautenticacion = $1 where id = $2', [exigir, tenantId])
  if (exigir) {
    // OJO con la RLS: este archivo importa `qRaw` bajo el nombre `q`, y `qRaw`
    // NO fija `app.tenant_id`. `sesiones` está exenta, pero `usuarios` es
    // fail-closed + FORCE, así que un subconsulta `select id from usuarios
    // where tenant_id = $1` por esta vía devuelve CERO filas y el update queda
    // en un no-op silencioso — el candado se encendía y quien ya estaba
    // desbloqueado seguía operando hasta 15 minutos, sin que nada fallara.
    //
    // Se usa `qConTenant`, que fija el GUC explícitamente con el tenant que ya
    // tenemos, en vez de derivarlo de la request.
    await qConTenant(
      tenantId,
      `update sesiones set desbloqueo_expira_en = null
        where usuario_id in (select id from usuarios where tenant_id = $1)`,
      [tenantId],
    )
  }
  return { ok: true, activo: exigir }
}

// Verifica la contraseña PROPIA y desbloquea ESTA sesión por DESBLOQUEO_MINUTOS.
// La comparación es bcrypt en el servidor: el cliente nunca ve el hash.
// No comprueba si el tenant tiene el candado encendido: reautenticarse siempre
// está permitido. Antes se rechazaba con «el control no está activado», y eso
// dejaba sin salida a las operaciones que exigen reautenticación SIEMPRE (ver
// `exigirReautenticacionSiempre`): pedían la contraseña y el endpoint para
// dársela contestaba que no hacía falta.
export async function desbloquear(
  password: string,
): Promise<{ ok: true; hasta: string } | { error: string; status: number }> {
  const u = await usuarioActual()
  if (!u) return { error: 'Sin sesión', status: 401 }
  const fila = await q1<{ h: string | null }>(
    'select password_hash as h from usuarios where id = $1',
    [u.id],
  )
  // Un usuario sin contraseña (alta a medias) no puede desbloquear. Mensaje
  // aparte: «incorrecta» lo mandaría a probar contraseñas que no existen.
  if (!fila?.h) {
    return { error: 'Tu usuario no tiene contraseña. Pide que te la restablezcan.', status: 400 }
  }
  if (!(await verifyPassword(password, fila.h))) {
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
// Deja pasar si el tenant no lo exige, o si la sesión está desbloqueada y no ha
// expirado. Sin exenciones por rol (ADR 0009).
export async function exigirDesbloqueo(): Promise<{ ok: true } | FaltaDesbloqueo> {
  const u = await usuarioActual()
  if (!u) return { ok: false, status: 401, error: 'Sin sesión', requiereDesbloqueo: true }
  if (!(await exigeReautenticacion(u.tenantId))) return { ok: true }
  if (await desbloqueoVigente(token())) return { ok: true }
  return {
    ok: false,
    status: 403,
    error: MENSAJE_DESBLOQUEO,
    requiereDesbloqueo: true,
  }
}

// Reautenticación INCONDICIONAL: no mira `tenants.exigir_reautenticacion`.
//
// Existe porque el interruptor del tenant está APAGADO por defecto —y lo está
// en los cinco tenants de producción—, así que `exigirDesbloqueo()` deja pasar
// sin pedir nada. Para los cambios sensibles de negocio eso es lo querido (el
// Dueño decide si quiere la fricción), pero hay operaciones que no deberían
// depender de ese interruptor: tocar el ACCESO de otra persona es una de ellas.
// Sin esto, restablecer la contraseña de un tercero seguiría sin pedir nada, que
// es exactamente lo que señaló A7.
export async function exigirReautenticacionSiempre(): Promise<{ ok: true } | FaltaDesbloqueo> {
  const u = await usuarioActual()
  if (!u) return { ok: false, status: 401, error: 'Sin sesión', requiereDesbloqueo: true }
  if (await desbloqueoVigente(token())) return { ok: true }
  return { ok: false, status: 403, error: MENSAJE_DESBLOQUEO, requiereDesbloqueo: true }
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
