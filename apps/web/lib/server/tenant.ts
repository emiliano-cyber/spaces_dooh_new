import 'server-only'
import { cache } from 'react'
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
export async function crearTenant(nombre: string, slug: string): Promise<TenantRow> {
  const base = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'crm'
  let s = base
  for (let i = 2; i < 50; i++) {
    if (!(await q1('select 1 from tenants where slug = $1', [s]))) break
    s = `${base}-${i}`
  }
  const row = await q1<any>(
    'insert into tenants (nombre, slug) values ($1,$2) returning id, nombre, slug, creado_en',
    [nombre.trim(), s],
  )
  return { id: row.id, nombre: row.nombre, slug: row.slug, creadoEn: row.creado_en }
}
