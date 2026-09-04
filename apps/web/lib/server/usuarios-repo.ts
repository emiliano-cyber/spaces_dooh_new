import 'server-only'
import { q, q1, qConTenant, qRaw, qRaw1 } from './db'
import type { PoolClient } from 'pg'
import { tenantActual } from './tenant'
import { hashPassword } from './auth'

// ============================================================================
//  lib/server/usuarios-repo.ts — Gestión de usuarios y matriz de permisos.
//  Nunca expone password_hash.
//
//  Aislamiento (Hardening 1 · Bloque A): TODA operación por `id` lleva además
//  `tenant_id = $n` con el tenant tomado de la SESIÓN del servidor
//  (tenantActual()), nunca del body ni del query string. La RLS fail-closed de
//  `usuarios` ya lo cubre, pero el filtro explícito es la segunda capa: si algún
//  día la app conectara con un rol BYPASSRLS, esto sigue aislando.
// ============================================================================

// Tenant de la sesión. Lanza si no hay: una operación por id sin tenant sería
// exactamente el IDOR que este bloque cierra, así que falla cerrado.
async function tenantOblig(): Promise<string> {
  const t = await tenantActual()
  if (!t) throw new Error('Sin tenant en la sesión: operación no permitida')
  return t
}

function rowToUsuario(r: any) {
  return {
    id: r.id, nombre: r.nombre, email: r.email, cargo: r.cargo,
    rol: r.rol, activo: !!r.activo, creadoEn: r.creado_en,
  }
}

export async function listarUsuarios() {
  const rows = await q('select id, nombre, email, cargo, rol::text as rol, activo, creado_en from usuarios where tenant_id = $1 order by creado_en asc', [await tenantActual()])
  return rows.map(rowToUsuario)
}

// F5.1: con `client`, el INSERT va por la transaccion del alta y se deshace con
// ella. Sin el, todo sigue como hoy con `qConTenant`. NO se duplica la funcion:
// el propio repo advierte que duplicar es «la forma segura de que las tres
// divergieran» (`cuentas-controller.ts:36-40`).
//
// Con `client` NO se vuelve a fijar el GUC: quien abre la transaccion ya lo hizo
// con `fijarTenant`, y volver a hacerlo aqui escondería el caso en que no se
// hizo — un INSERT que deberia fallar por RLS pasaria inadvertido.
export async function crearUsuario(input: {
  nombre: string; email: string; cargo?: string; rol?: string; password?: string; tenantId?: string | null
  // Solo lo pide quien NO eligio la contrasena: el alta de una instancia la
  // genera el operador y se imprime en su consola, asi que tiene que morir en el
  // primer acceso. Por omision `false`, que es lo correcto cuando la persona
  // eligio la suya (autoregistro).
  debeCambiarPassword?: boolean
}, client?: PoolClient) {
  // Nunca un default débil: la contraseña debe venir validada por la ruta.
  if (!input.password) throw new Error('Se requiere una contraseña para crear el usuario')
  const hash = await hashPassword(input.password)
  const tenantId = input.tenantId ?? (await tenantOblig())
  // El signup crea el tenant y su Dueño ANTES de que exista sesión, así que
  // tenantActual() es null y q() fijaría app.tenant_id='' → el WITH CHECK de la
  // RLS fail-closed rechazaría el INSERT. Ahí fijamos el GUC explícitamente al
  // tenant recién creado (id de servidor, nunca del cliente).
  // `debe_cambiar_password` va EXPLICITO y no se deja al default de la columna.
  // Medido el 2026-09-04 en el ensayo de F5.6 contra una instancia real: el Dueno
  // nacia con `f` porque este INSERT no nombraba la columna, y su contrasena
  // --generada por el operador e impresa en su consola-- valia para siempre.
  const texto = `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id, debe_cambiar_password)
     values ($1,$2,$3,$4,$5,true,$6,$7) returning id, nombre, email, cargo, rol::text as rol, activo, creado_en`
  const params = [input.nombre, input.email.toLowerCase(), input.cargo ?? null, input.rol ?? 'COMERCIAL', hash, tenantId, input.debeCambiarPassword ?? false]
  const rows = client
    ? (await client.query(texto, params as any[])).rows
    : await qConTenant(tenantId, texto, params)
  return rowToUsuario(rows[0])
}

export async function actualizarUsuario(
  id: string,
  cambios: {
    nombre?: string
    cargo?: string
    rol?: string
    activo?: boolean
    passwordHash?: string
    debeCambiarPassword?: boolean
  },
) {
  // passwordHash y debeCambiarPassword solo los escribe `restablecerPasswordCtrl`
  // (ADR 0009); el PATCH público ya no los acepta.
  const map: Record<string, string> = {
    nombre: 'nombre',
    cargo: 'cargo',
    rol: 'rol',
    activo: 'activo',
    passwordHash: 'password_hash',
    debeCambiarPassword: 'debe_cambiar_password',
  }
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, v] of Object.entries(cambios)) {
    if (!(k in map)) continue
    vals.push(v)
    sets.push(`${map[k]} = $${vals.length}`)
  }
  if (!sets.length) return null
  const tenantId = await tenantOblig()
  vals.push(id, tenantId)
  const filas = await q(
    `update usuarios set ${sets.join(', ')}
      where id = $${vals.length - 1} and tenant_id = $${vals.length}
      returning id, nombre, email, cargo, rol::text as rol, activo, creado_en`,
    vals,
  )
  // 0 filas = no existe O es de otro tenant. La ruta lo mapea a 404 (nunca 403:
  // un 403 confirmaría que el id existe en otra organización).
  return filas.length ? rowToUsuario(filas[0]) : null
}

// Cierra TODAS las sesiones vivas de un usuario (ADR 0009: restablecimiento de
// contraseña). Si el motivo del reset es que le robaron la cuenta, dejar la
// sesión abierta no arregla nada — la cookie robada seguiría entrando.
//
// Va por `qRaw` porque `sesiones` está exenta de la RLS fail-closed (es
// pre-sesión, como `tenants`); `usuarios` NO lo está, así que aquí no se puede
// filtrar por tenant leyendo esa tabla: con qRaw devolvería cero filas y el
// borrado sería un no-op silencioso. La pertenencia al tenant ya la comprobó
// quien llama, con el `update ... where tenant_id = $n` de `actualizarUsuario`:
// si aquel devolvió un usuario, es de esta organización.
export async function cerrarSesionesDeUsuario(usuarioId: string): Promise<number> {
  const filas = await qRaw('delete from sesiones where usuario_id = $1 returning token', [usuarioId])
  return filas.length
}

// Devuelve false si el usuario no existe o pertenece a otro tenant.
export async function borrarUsuario(id: string): Promise<boolean> {
  const filas = await q('delete from usuarios where id = $1 and tenant_id = $2 returning id', [
    id,
    await tenantOblig(),
  ])
  return filas.length > 0
}

// Actualiza el propio perfil: correo y/o hash de contraseña (ya validados/hasheados
// por el controller). Devuelve false si no hay nada que cambiar.
export async function actualizarPerfil(id: string, cambios: { email?: string; passwordHash?: string }) {
  const sets: string[] = []
  const vals: unknown[] = []
  if (cambios.email) {
    vals.push(cambios.email.toLowerCase())
    sets.push(`email = $${vals.length}`)
  }
  if (cambios.passwordHash) {
    vals.push(cambios.passwordHash)
    sets.push(`password_hash = $${vals.length}`)
    // Cambiar la contraseña propia es EXACTAMENTE lo que el forzado esperaba
    // (ADR 0009), así que aquí se levanta la bandera. Sin esto el usuario
    // cambiaría la temporal y seguiría encerrado: `exigir()` le cerraría todas
    // las rutas con módulo y el sistema quedaría inservible para él.
    sets.push('debe_cambiar_password = false')
  }
  if (!sets.length) return false
  const tenantId = await tenantOblig()
  vals.push(id, tenantId)
  const filas = await q(
    `update usuarios set ${sets.join(', ')}
      where id = $${vals.length - 1} and tenant_id = $${vals.length} returning id`,
    vals,
  )
  return filas.length > 0
}

// Hash de la contraseña del propio usuario en sesión, para re-autenticar antes
// de un cambio sensible (Hardening 1 · Bloque E). Va acotado al tenant de la
// sesión, así que nunca devuelve el hash de otra organización.
// ADR 0018. Se consulta por `usuario_id`, no por `sub`: la pregunta aquí no es
// «¿quién es este sub?» sino «¿esta cuenta tiene una vía de Google vinculada?».
//
// ⚠️ VA POR `q` Y NO POR `qRaw`, y la primera versión se equivocó justo aquí.
// `identidades_externas` tiene RLS + FORCE con política por `app.tenant_id`
// (`20260806_identidades_externas.sql:77-82`). `qRaw` NO fija ese GUC, así que
// la política comparaba contra NULL y la consulta devolvía CERO FILAS EN
// SILENCIO: la condición salía `false` y la excepción del ADR 0018 no se abría
// nunca. Es la zona R2 del proyecto, y esta fue su tercera aparición.
//
// El razonamiento equivocado era «se resuelve antes de que haya tenant», cierto
// para el callback de Google —que por eso usa una función SECURITY DEFINER— y
// FALSO aquí: esto corre con la sesión y el tenant ya resueltos.
//
// Se acota además por `tenant_id` explícito, como el resto del repo: segunda
// capa sobre la RLS, por convención de la casa.
export async function tieneIdentidadVinculada(
  usuarioId: string,
  proveedor: string,
): Promise<boolean> {
  const r = await q1<{ uno: number }>(
    `select 1 as uno from identidades_externas
      where usuario_id = $1 and proveedor = $2 and tenant_id = $3 limit 1`,
    [usuarioId, proveedor, await tenantOblig()],
  )
  return !!r
}

export async function passwordHashDe(id: string): Promise<string | null> {
  const r = await q1<{ password_hash: string | null }>(
    'select password_hash from usuarios where id = $1 and tenant_id = $2',
    [id, await tenantOblig()],
  )
  return r?.password_hash ?? null
}

// Unicidad de correo: es GLOBAL a propósito, porque el login es por email sin
// tenant y dos usuarios con el mismo correo en tenants distintos lo harían
// ambiguo. Con la RLS fail-closed de `usuarios`, una consulta normal solo vería
// el tenant propio (y pre-sesión, nada), así que dejaría pasar duplicados en
// silencio. Va por la función SECURITY DEFINER, que solo devuelve un booleano.
export async function emailExiste(email: string): Promise<boolean> {
  const r = await qRaw1<{ existe: boolean }>('select auth_email_existe($1) as existe', [email])
  return !!r?.existe
}

// Matriz de permisos: filas { rol, modulo, accion }.
export async function matrizPermisos() {
  return q<{ rol: string; modulo: string; accion: string }>(
    'select rol::text as rol, modulo, accion from rol_permisos order by modulo, rol',
  )
}

// ─── Matriz completa para la UI (Hardening 1 · Bloque F) ────────────────────
// La UI de administración pintaba la matriz de una copia HARDCODEADA que se
// desincronizó de `rol_permisos` (p. ej. el módulo `network` no aparecía). Este
// helper deriva TODO —módulos (filas), roles (columnas) y celdas— del MISMO
// origen que exigir(): la tabla rol_permisos. Así un cambio en BD se refleja en
// la UI sin tocar código ni desplegar.
//
// Las etiquetas son PRESENTACIÓN (no dato de RBAC): un módulo/rol sin etiqueta
// conocida cae a una capitalización del propio key, así que uno nuevo aparece
// igual, solo con un nombre menos bonito hasta que se le añada su label.

// Orden y etiquetas preferidos. Lo que no esté aquí se ordena alfabéticamente
// al final y se etiqueta capitalizando el key.
const MODULO_LABEL: Record<string, string> = {
  dashboard: 'Dashboard', comercial: 'Comercial', arrendadores: 'Arrendadores',
  operaciones: 'Operaciones', imprenta: 'Imprenta', finanzas: 'Finanzas',
  network: 'Network', administracion: 'Administración',
}
const ROL_LABEL: Record<string, string> = {
  DUENO: 'Dueño', COMERCIAL: 'Comercial', OPERACIONES: 'Operaciones',
  IMPRENTA: 'Imprenta', FINANZAS: 'Finanzas',
}
const MODULO_ORDEN = Object.keys(MODULO_LABEL)
const ROL_ORDEN = Object.keys(ROL_LABEL)

const capitaliza = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
function ordenar(keys: string[], preferido: string[]): string[] {
  const set = new Set(keys)
  const enOrden = preferido.filter((k) => set.has(k))
  const resto = keys.filter((k) => !preferido.includes(k)).sort()
  return [...enOrden, ...resto]
}

export async function matrizPermisosUI(): Promise<{
  modulos: { key: string; label: string }[]
  roles: { rol: string; label: string }[]
  filas: { rol: string; modulo: string; accion: string }[]
}> {
  const filas = await matrizPermisos()
  const modulos = ordenar([...new Set(filas.map((f) => f.modulo))], MODULO_ORDEN)
    .map((key) => ({ key, label: MODULO_LABEL[key] ?? capitaliza(key) }))
  const roles = ordenar([...new Set(filas.map((f) => f.rol))], ROL_ORDEN)
    .map((rol) => ({ rol, label: ROL_LABEL[rol] ?? capitaliza(rol) }))
  return { modulos, roles, filas }
}
