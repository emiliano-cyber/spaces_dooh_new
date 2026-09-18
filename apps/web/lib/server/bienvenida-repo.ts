import 'server-only'
import { q, withTenantTx } from './db'
import { tenantActual } from './tenant'
import type { PoolClient } from 'pg'
import type { EntidadPlaneada, RolCatalogo, EntidadConRoles } from '@/lib/cuestionario-entidades'

// ============================================================================
//  lib/server/bienvenida-repo.ts — La capa de datos del cuestionario de
//  bienvenida: lo que hace falta para preguntarlo y para materializarlo.
// ----------------------------------------------------------------------------
//  No crea tablas ni columnas nuevas: escribe en `entidades_fiscales` y
//  `entidad_roles`, que ya existen (`20260917_entidades_fiscales.sql`). Y no
//  guarda en ninguna parte si el cuestionario está contestado — eso se DERIVA
//  del recuento, así que este módulo no necesita ninguna migración.
//
//  ─── `entidad_id` NO es una frontera de seguridad ────────────────────────
//  La frontera es UNA: `tenant_id` con RLS (`db.ts:60` en `fijarTenant` y
//  `db.ts:79` en `q`, que es donde se fija el GUC). El rango `:54-69` que
//  citaba antes ya derivó, y la deriva era de las que enseñan al revés: caía
//  dentro de `qRaw`, que es exactamente lo contrario de la frontera. Toda consulta de
//  aquí lleva `and tenant_id = $n` explícito como SEGUNDA capa sobre la
//  política, y usa `q` — nunca `qRaw`, que no fija el contexto de tenant. No es
//  ceremonia: el fallo R2 de este repositorio no da error, devuelve cero filas
//  en silencio o filas de otra empresa, y ya costó un despliegue entero.
//  `bienvenida-repo.test.ts` barre este archivo y se pone rojo si una consulta
//  nueva se olvida del tenant.
//
//  ─── Por qué el catálogo se relee aquí y no se reusa `entidades-repo` ─────
//  `entidades-repo.catalogoRolesEntidad()` devuelve solo `rol`. El cuestionario
//  necesita además la `etiqueta`, que es el texto con el que se PREGUNTA, y
//  traérsela en una segunda consulta sería ir dos veces por el mismo dato. Es
//  otra proyección de la misma tabla, no una copia de la decisión: la lista
//  sigue viniendo de la base y no del código.
// ============================================================================

export type AltaCuestionario =
  | { ok: true; entidades: EntidadConRoles[] }
  | { ok: false; yaHabia: number }

const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : ((v as string | null) ?? null)

// La subconsulta lleva su PROPIO `tenant_id`: no se apoya en que el padre ya
// esté acotado, porque si un día cambia el `from` se queda leyendo
// `entidad_roles` de toda la base sin que nada falle.
const ROLES_DE_LA_FILA = `
  coalesce((select array_agg(r.rol order by r.rol)
              from entidad_roles r
             where r.entidad_id = e.id and r.tenant_id = $1), array[]::text[]) as roles`

// ─── Lectura ────────────────────────────────────────────────────────────────

/** El vocabulario de roles CON su etiqueta, en el orden en que se pregunta. */
export async function catalogoRolesConEtiqueta(): Promise<RolCatalogo[]> {
  // Sin `tenant_id` a propósito: `catalogo_roles_entidad` no tiene esa columna
  // porque es vocabulario del producto, igual para toda la flota, y queda fuera
  // del invariante de RLS — mismo criterio que `folios_consecutivos`.
  const rows = await q('select rol, etiqueta from catalogo_roles_entidad order by orden asc, rol asc')
  return rows.map((r: any) => ({ rol: r.rol, etiqueta: r.etiqueta }))
}

/**
 * Cuántas razones sociales tiene la organización. Es la única fuente de «¿ya
 * contestó el cuestionario?».
 *
 * Cuenta TAMBIÉN las dadas de baja, y eso es deliberado: haber contestado es un
 * hecho histórico. Si se filtrara por `activo`, quien desactivara todas sus
 * razones sociales volvería a ver el cuestionario y crearía el duplicado que
 * este módulo existe para evitar.
 */
export async function contarEntidadesDelTenant(): Promise<number> {
  const rows = await q(
    'select count(*)::int as total from entidades_fiscales where tenant_id = $1',
    [await tenantActual()],
  )
  return Number(rows[0]?.total ?? 0)
}

/** Las razones sociales con sus roles, para poder VOLVER y ver lo contestado. */
export async function listarEntidadesConRoles(): Promise<EntidadConRoles[]> {
  const rows = await q(
    `select e.id, e.razon_social, e.activo, e.creado_en, ${ROLES_DE_LA_FILA}
       from entidades_fiscales e
      where e.tenant_id = $1
      order by e.razon_social asc`,
    [await tenantActual()],
  )
  return rows.map((r: any) => ({
    id: r.id,
    razonSocial: r.razon_social,
    activo: r.activo,
    creadoEn: iso(r.creado_en),
    roles: r.roles ?? [],
  }))
}

// ─── Escritura ──────────────────────────────────────────────────────────────

/**
 * Las dos mitades int4 del uuid del tenant, para el cerrojo de la transacción.
 *
 * Se calcula en JavaScript y se usa la forma de dos enteros de
 * `pg_advisory_xact_lock` en vez de `hashtext()`: `hashtext` es una función
 * interna de Postgres, sin documentar, y apoyar un cerrojo en algo así es
 * apostar a que no cambie nunca.
 */
export function cerrojoDeTenant(tenantId: string | null | undefined): [number, number] {
  const hex = String(tenantId ?? '').replace(/[^0-9a-fA-F]/g, '')
  // `| 0` lo convierte al int32 CON SIGNO que espera pg: sin él, un uuid que
  // empiece por `f` desborda el tipo y la consulta falla en vez de bloquear.
  const alto = Number.parseInt(hex.slice(0, 8) || '0', 16) | 0
  const bajo = Number.parseInt(hex.slice(8, 16) || '0', 16) | 0
  return [alto, bajo]
}

async function insertarEntidadEnTx(
  client: PoolClient,
  entidad: EntidadPlaneada,
  tenantId: string | null,
): Promise<EntidadConRoles> {
  const { rows } = await client.query(
    `insert into entidades_fiscales (razon_social, tenant_id)
     values ($1, $2) returning id, razon_social, activo, creado_en`,
    [entidad.razonSocial, tenantId],
  )
  const fila = rows[0]
  // Los roles en UNA sentencia, desplegando el arreglo: una por rol
  // multiplicaría los viajes sin ganar nada, y el `unnest` deja el `tenant_id`
  // escrito una sola vez, que es justo donde se olvida. Un rol con otro tenant
  // sería invisible para su propia entidad y visible para nadie.
  if (entidad.roles.length) {
    await client.query(
      `insert into entidad_roles (entidad_id, rol, tenant_id)
       select $1, rol, $3 from unnest($2::text[]) as rol`,
      [fila.id, entidad.roles, tenantId],
    )
  }
  return {
    id: fila.id,
    razonSocial: fila.razon_social,
    activo: fila.activo,
    roles: [...entidad.roles],
  }
}

/**
 * Materializa el cuestionario: TODAS las razones sociales con TODOS sus roles,
 * o ninguna.
 *
 * La atomicidad no es un detalle de estilo. A medias es peor que no haberlo
 * contestado: quedaría una organización con parte de su identidad fiscal
 * escrita, el cuestionario ya «contestado» —porque el estado se deriva de que
 * exista alguna entidad— y ninguna forma de volver a ofrecerlo.
 *
 * ─── Por qué hay un cerrojo y no solo un recuento ───────────────────────────
 * El recuento que hace el controller y estos `insert` no son la misma
 * transacción, así que dos pestañas (o dos dispositivos, o un reintento de red)
 * pueden contar las dos cero y escribir las dos. El `pg_advisory_xact_lock`
 * serializa por organización y se libera al terminar la transacción, así que la
 * segunda encuentra el recuento en 1 y no escribe nada. No hace falta ninguna
 * migración para tenerlo, que es lo que lo hace la opción correcta aquí: un
 * índice único sobre «tener alguna entidad» no se puede expresar.
 */
export async function crearEntidadesDelCuestionario(
  plan: EntidadPlaneada[],
): Promise<AltaCuestionario> {
  const tenantId = await tenantActual()
  const [alto, bajo] = cerrojoDeTenant(tenantId)
  return withTenantTx(async (client) => {
    // El cerrojo ANTES del recuento, o las dos transacciones contarían cero.
    await client.query('select pg_advisory_xact_lock($1, $2)', [alto, bajo])
    const { rows } = await client.query(
      'select count(*)::int as total from entidades_fiscales where tenant_id = $1',
      [tenantId],
    )
    const yaHabia = Number(rows[0]?.total ?? 0)
    if (yaHabia > 0) return { ok: false as const, yaHabia }

    const entidades: EntidadConRoles[] = []
    for (const entidad of plan) {
      entidades.push(await insertarEntidadEnTx(client, entidad, tenantId))
    }
    return { ok: true as const, entidades }
  })
}
