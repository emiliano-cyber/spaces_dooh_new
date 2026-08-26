import 'server-only'
import { cache } from 'react'
import type { PoolClient } from 'pg'
import { cookies } from 'next/headers'
// Bootstrap del tenant: usa consultas RAW (sin GUC) sobre tablas EXENTAS de RLS
// fail-closed (tenants/usuarios). Fijar el GUC aquí recursaría (q -> tenantActual).
import { qRaw as q, qRaw1 as q1 } from './db'
import { usuarioActual } from './auth'

// ============================================================================
//  lib/server/tenant.ts — Multi-tenant a nivel aplicación.
// ----------------------------------------------------------------------------
//  Cada organización (fila de `tenants`) es un CRM propio. El aislamiento se
//  hace por FILTRADO EXPLÍCITO de `tenant_id` en las lecturas y ESTAMPADO en
//  los inserts (la conexión sigue siendo superuser, así que RLS no aplica).
//
//  El "tenant activo" de la request es:
//   • el del usuario en sesión, o
//   • un override por cookie (cambiar de CRM), permitido SOLO al super-admin de
//     la plataforma (el Dueño del tenant más antiguo).
// ============================================================================

export const TENANT_COOKIE = 'spaces_tenant_activo'

// Tenant de la plataforma = el más antiguo (el original). Su Dueño puede cambiar
// de CRM para administrar/mostrar las demás organizaciones.
export const tenantPlataforma = cache(async (): Promise<string | null> => {
  const r = await q1<{ id: string }>('select id from tenants order by creado_en asc limit 1')
  return r?.id ?? null
})

// Tenant activo de la request (memoizado). Null solo si no hay sesión.
export const tenantActual = cache(async (): Promise<string | null> => {
  const u = await usuarioActual()
  if (!u) return null
  const override = cookies().get(TENANT_COOKIE)?.value
  if (override && u.rol === 'DUENO' && u.tenantId && u.tenantId === (await tenantPlataforma())) {
    const existe = await q1('select 1 from tenants where id = $1', [override])
    if (existe) return override
  }
  return u.tenantId
})

// ¿Esta instancia ya tiene alguna organización dentro? (F5.2)
//
// Es la condición que hace que el arranque sea DE UN SOLO USO: una instancia
// recién aprovisionada tiene la base vacía y puede crear su primera
// organización; en cuanto existe una, la puerta se cierra para siempre.
//
// Va aquí y no en el route porque el SQL vive en la capa de datos, y usa `q1`
// —que es `qRaw1`, ver la cabecera del archivo— porque en el arranque NO HAY
// sesión ni GUC de tenant que fijar: `tenants` está exenta de RLS fail-closed.
// Este es uno de los pocos sitios donde eso es lo correcto y no el fallo R2.
export async function hayAlgunTenant(): Promise<boolean> {
  return (await q1('select 1 from tenants limit 1')) !== null
}

// ¿El usuario en sesión puede cambiar de CRM? (super-admin de plataforma)
export async function puedeCambiarCrm(): Promise<boolean> {
  const u = await usuarioActual()
  if (!u || u.rol !== 'DUENO') return false
  return !!u.tenantId && u.tenantId === (await tenantPlataforma())
}

export interface TenantRow {
  id: string
  nombre: string
  slug: string
  creadoEn: string
}

export async function listarTenants(): Promise<TenantRow[]> {
  const rows = await q<any>('select id, nombre, slug, creado_en from tenants order by creado_en asc')
  return rows.map((r) => ({ id: r.id, nombre: r.nombre, slug: r.slug, creadoEn: r.creado_en }))
}

// Crea una organización (CRM) nueva. Si el slug choca, se le añade un sufijo.
// Nota: `config_negocio` es global (una sola fila), así que por ahora todos los
// CRMs comparten la configuración del negocio (moneda, IVA, loop/slot).
//
// F5.1: acepta un `client` opcional para participar en la transacción del alta.
// Sin él, todo sigue como antes. La tarea no listaba este archivo, pero sin esto
// el INSERT de `tenants` quedaría FUERA de la transacción y no habría atomicidad
// ninguna: es la mitad que hay que poder deshacer.
//
// No se duplica la función. Duplicarla habría separado en dos sitios la lógica
// que resuelve el choque de slug, y ese es el error que `cuentas-controller.ts:36-40`
// documenta como «la forma segura de que las tres divergieran».
export async function crearTenant(
  nombre: string,
  slug: string,
  client?: PoolClient,
): Promise<TenantRow> {
  const base = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'crm'
  const uno = async (texto: string, params: unknown[]) =>
    client ? (await client.query(texto, params as any[])).rows[0] ?? null : await q1<any>(texto, params)
  let s = base
  for (let i = 2; i < 50; i++) {
    if (!(await uno('select 1 from tenants where slug = $1', [s]))) break
    s = `${base}-${i}`
  }
  const row = await uno(
    'insert into tenants (nombre, slug) values ($1,$2) returning id, nombre, slug, creado_en',
    [nombre.trim(), s],
  )
  return { id: row.id, nombre: row.nombre, slug: row.slug, creadoEn: row.creado_en }
}
