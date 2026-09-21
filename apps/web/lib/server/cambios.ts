import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
// tenants/sesiones están exentas de la RLS fail-closed (son pre-sesión), así que
// se consultan RAW, igual que auth.ts. Usar q() aquí recursaría.
// `q`/`q1` son las RAW (sin GUC): `tenants` y `sesiones` están exentas de la
// RLS y se consultan así, igual que en auth.ts.
//
// `q1ConTenant` NO es un lujo: `usuarios` SÍ tiene RLS fail-closed + FORCE
// desde Hardening 1, y en producción la app conecta con un rol NOBYPASSRLS. Una
// lectura RAW de esa tabla devuelve CERO filas, siempre.
import { qRaw as q, qRaw1 as q1, qConTenant } from './db'
import { SESSION_COOKIE, exigir, usuarioActual, hashPassword, verifyPassword, type UsuarioSesion } from './auth'
import { validarPassword } from '@/lib/password'
import { MENSAJE_DESBLOQUEO } from '@/lib/cambios-mensajes'

// ============================================================================
//  lib/server/cambios.ts — Control de cambios, con DOS contraseñas posibles.
// ----------------------------------------------------------------------------
//  Para tocar dinero o catálogo hay que desbloquear la sesión con UNA de dos
//  contraseñas: la PROPIA de login, o una COMPARTIDA que asigna el Dueño
//  (`tenants.cambios_password_hash`). ADR 0009 + ADR 0036.
//
//  Historia corta: nació con solo la compartida. El ADR 0009 la retiró porque
//  un secreto colectivo no prueba identidad: la bitácora afirmaba «Ana facturó»
//  cuando lo único verificado era «alguien que conoce el secreto del equipo
//  facturó». El ADR 0036 (2026-09-21) la trae de vuelta, a propósito, como
//  decisión explícita del dueño del producto — PERO sin perder esa garantía
//  donde de verdad importa: ver el punto 3 más abajo.
//
//  Dónde vive cada cosa y por qué:
//   • Las contraseñas: `usuarios.password_hash` (de siempre) y
//     `tenants.cambios_password_hash` (bcrypt, nunca viaja al cliente, null =
//     sin asignar).
//   • El desbloqueo: `sesiones.desbloqueo_expira_en` + `desbloqueo_es_propio`,
//     contra el token de sesión. Vive en el SERVIDOR. Si estuviera en el
//     navegador, cualquiera se lo inventaría con las herramientas de
//     desarrollo y el candado sería un adorno.
//
//  Apagado por defecto (`tenants.exigir_reautenticacion = false`): encender esto
//  por sorpresa dejaría al equipo sin poder trabajar.
//
//  NO hay exención por rol para el candado general. La había para el Dueño y se
//  retiró (ADR 0009): es justo la sesión del Dueño la que más daño hace
//  desatendida.
//
//  3 · Por qué la compartida NO sirve para tocar el acceso de otra persona.
//  `exigirReautenticacionSiempre()` protege `POST /api/usuarios/:id/restablecer`
//  — resetear la contraseña de un TERCERO. Si la compartida abriera esa puerta,
//  cualquiera que la supiera podría resetear a otra persona sin probar que es
//  quien dice ser: exactamente el hueco de impersonación que el ADR 0009 cerró.
//  Por eso `desbloquear()` guarda CON QUÉ contraseña se concedió
//  (`desbloqueo_es_propio`), y esa ruta exige que sea `true`.
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

// Hasta cuándo está desbloqueada la sesión del token dado, o null. `soloPropio`
// exige además que se haya concedido con la contraseña PROPIA (para
// `exigirReautenticacionSiempre`, ver el punto 3 del encabezado).
async function desbloqueoVigente(t: string | null, soloPropio = false): Promise<string | null> {
  if (!t) return null
  const s = await q1<{ e: string | null; propio: boolean }>(
    'select desbloqueo_expira_en as e, desbloqueo_es_propio as propio from sesiones where token = $1',
    [t],
  )
  if (!s?.e) return null
  if (soloPropio && !s.propio) return null
  return new Date(s.e).getTime() > Date.now() ? new Date(s.e).toISOString() : null
}

// La contraseña compartida del tenant, o null si no se ha asignado ninguna.
// `tenants` está exenta de la RLS (pre-sesión), se lee con `q1` como el resto.
async function contrasenaCompartidaDe(tenantId: string | null): Promise<string | null> {
  if (!tenantId) return null
  const r = await q1<{ h: string | null }>(
    'select cambios_password_hash as h from tenants where id = $1',
    [tenantId],
  )
  return r?.h ?? null
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
  // ¿El Dueño ya asignó una contraseña compartida? NUNCA el hash: solo si hay
  // una o no, para que la UI sepa si ofrecer "asignar" o "cambiar".
  tieneContrasenaCompartida: boolean
}

// Lo que la UI necesita saber: si hay candado y hasta cuándo estoy desbloqueado.
export async function estadoControlCambios(): Promise<EstadoControlCambios> {
  const u = await usuarioActual()
  const base = {
    activo: false, requiere: false, desbloqueadoHasta: null, minutos: DESBLOQUEO_MINUTOS,
    tieneContrasenaCompartida: false,
  }
  if (!u) return base
  const tieneContrasenaCompartida = !!(await contrasenaCompartidaDe(u.tenantId))
  const activo = await exigeReautenticacion(u.tenantId)
  if (!activo) return { ...base, tieneContrasenaCompartida }
  return {
    activo: true,
    requiere: true,
    desbloqueadoHasta: await desbloqueoVigente(token()),
    minutos: DESBLOQUEO_MINUTOS,
    tieneContrasenaCompartida,
  }
}

// Enciende o apaga la exigencia de reautenticación del tenant. Solo el Dueño.
// El interruptor sigue sin recibir ninguna contraseña: eso es aparte, ver
// `fijarContrasenaCambios`. Se puede encender sin haber asignado ninguna
// compartida — en ese caso el candado solo acepta la contraseña propia de
// cada quien, como en el ADR 0009.
//
// Al APAGARLO no se cierran los desbloqueos vivos (no hay nada que revocar: se
// concedieron con una contraseña que sigue siendo válida). Al ENCENDERLO sí se
// cierran, para que nadie herede un desbloqueo de antes de que el candado
// existiera.
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

// Asigna (o rota) la contraseña compartida del candado de cambios. Solo el
// Dueño. Independiente del interruptor: se puede fijar sin encenderlo, o
// dejarlo encendido sin ninguna asignada (ver `fijarExigirReautenticacion`).
// Misma regla que cualquier otra contraseña del sistema (`validarPassword`):
// no tiene sentido exigirle 8 caracteres a la de login y aceptar «1234» aquí.
export async function fijarContrasenaCambios(
  tenantId: string,
  password: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const motivo = validarPassword(password)
  if (motivo) return { error: motivo, status: 400 }
  const hash = await hashPassword(password)
  await q('update tenants set cambios_password_hash = $1 where id = $2', [hash, tenantId])
  return { ok: true }
}

// Verifica la contraseña — PROPIA o la COMPARTIDA del tenant, en ese orden —
// y desbloquea ESTA sesión por DESBLOQUEO_MINUTOS. La comparación es bcrypt en
// el servidor: el cliente nunca ve ningún hash.
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
  // CON contexto de tenant. Leerlo con `q1` (raw) devolvía cero filas en
  // producción —`usuarios` es fail-closed + FORCE y el rol de la app no puede
  // saltarse la RLS—, así que TODO desbloqueo contestaba «tu usuario no tiene
  // contraseña» y, con él, el restablecimiento de contraseñas de A7 quedaba
  // inservible. Las unitarias no lo vieron porque simulan la BD; lo cazó la
  // primera prueba de integración que lo ejerció de verdad.
  //
  // Y con `u.tenantId`, NO con `passwordHashDe()` de usuarios-repo, que hace
  // esta misma consulta: aquel va por `q1()`, que toma el tenant de
  // `tenantActual()`, y ese honra la cookie de cambio de CRM del super-admin de
  // plataforma. Un Dueño de plataforma metido en OTRA organización tiene
  // tenant activo ≠ el suyo, y su propia fila de `usuarios` vive en el suyo:
  // la lectura daría cero filas y volveríamos al mismo 400. La contraseña que
  // se verifica es la de QUIEN TECLEA, así que el tenant es el de su sesión.
  const filas = await qConTenant<{ h: string | null }>(
    u.tenantId ?? '',
    'select password_hash as h from usuarios where id = $1 and tenant_id = $2',
    [u.id, u.tenantId],
  )
  const propioHash = filas[0]?.h ?? null
  const compartidaHash = await contrasenaCompartidaDe(u.tenantId)

  // Sin NINGUNA contraseña posible que comparar (alta a medias y el Dueño
  // tampoco asignó la compartida): no puede desbloquear con nada. Mensaje
  // aparte de «incorrecta», que mandaría a probar contraseñas que no existen.
  if (!propioHash && !compartidaHash) {
    return { error: 'Tu usuario no tiene contraseña. Pide que te la restablezcan.', status: 400 }
  }

  // La PROPIA primero: si coincide, este desbloqueo sirve para TODO, incluida
  // `exigirReautenticacionSiempre` (tocar el acceso de otra persona).
  if (propioHash && (await verifyPassword(password, propioHash))) {
    return concederDesbloqueo(true)
  }
  // La COMPARTIDA, si el Dueño asignó una: desbloquea el candado de cambios,
  // pero NO sirve para tocar el acceso de otra persona (ver encabezado, punto 3).
  if (compartidaHash && (await verifyPassword(password, compartidaHash))) {
    return concederDesbloqueo(false)
  }
  return { error: 'Contraseña incorrecta', status: 403 }
}

async function concederDesbloqueo(
  esPropio: boolean,
): Promise<{ ok: true; hasta: string } | { error: string; status: number }> {
  const t = token()
  if (!t) return { error: 'Sin sesión', status: 401 }
  const hasta = new Date(Date.now() + DESBLOQUEO_MINUTOS * 60_000)
  await q(
    'update sesiones set desbloqueo_expira_en = $1, desbloqueo_es_propio = $2 where token = $3',
    [hasta.toISOString(), esPropio, t],
  )
  return { ok: true, hasta: hasta.toISOString() }
}

// Cierra el desbloqueo de esta sesión (botón "bloquear" o al terminar).
export async function bloquear(): Promise<void> {
  const t = token()
  if (t) {
    await q(
      'update sesiones set desbloqueo_expira_en = null, desbloqueo_es_propio = false where token = $1',
      [t],
    )
  }
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
//
// Exige además que el desbloqueo sea con la contraseña PROPIA (`soloPropio`,
// ADR 0036): la compartida no prueba identidad, así que no basta para tocar el
// acceso de otra persona, aunque sí baste para el candado general de cambios.
export async function exigirReautenticacionSiempre(): Promise<{ ok: true } | FaltaDesbloqueo> {
  const u = await usuarioActual()
  if (!u) return { ok: false, status: 401, error: 'Sin sesión', requiereDesbloqueo: true }
  if (await desbloqueoVigente(token(), true)) return { ok: true }
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
