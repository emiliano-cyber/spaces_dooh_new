import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/config-repo.ts — Configuración del negocio (tenant). Fila única
//  en config_negocio. Se lee desde /api/config (admin) y desde /api/estado
//  (todos los roles) para que el logo, nombre, IVA y parámetros de loop/spot
//  estén disponibles en toda la app.
//  El `nombreTenant` que se muestra (sidebar) es el nombre de la ORGANIZACIÓN
//  (tenant) actual, no el global de config_negocio.
// ============================================================================

export function rowToConfig(r: any) {
  return {
    nombreTenant: r.nombre_tenant,
    // razón social / nombre comercial son POR TENANT (viven en `tenants`); aquí
    // van como placeholder null y se resuelven en obtenerConfig()/…Admin().
    razonSocial: null as string | null,
    nombreComercial: null as string | null,
    moneda: r.moneda,
    plazosCobranza: r.plazos_cobranza ?? [],
    tiposTarea: r.tipos_tarea ?? [],
    logoUrl: r.logo_url ?? null,
    ivaTasas: (r.iva_tasas ?? [16]).map((x: any) => Number(x)),
    loopSeg: r.loop_seg != null ? Number(r.loop_seg) : 60,
    spotSeg: r.spot_seg != null ? Number(r.spot_seg) : 10,
  }
}

export async function obtenerConfigRow() {
  let r = await q1<any>('select * from config_negocio limit 1')
  if (!r) {
    r = (await q<any>('insert into config_negocio (nombre_tenant) values ($1) returning *', ['RGB Catorce']))[0]
  }
  return r
}

export async function obtenerConfig() {
  const cfg = rowToConfig(await obtenerConfigRow())
  // Nombre, razón social y nombre comercial son POR TENANT: cada CRM muestra su
  // propia empresa (el resto de la config —moneda, IVA, loop…— es global).
  const t = await q1<any>(
    'select nombre, razon_social, nombre_comercial from tenants where id = $1',
    [await tenantActual()],
  )
  if (t?.nombre) cfg.nombreTenant = t.nombre
  cfg.razonSocial = t?.razon_social ?? null
  cfg.nombreComercial = t?.nombre_comercial ?? null
  return cfg
}

// Config para el panel de Administración: base global + los campos POR TENANT
// (razón social, nombre comercial) del tenant actual. A diferencia de
// obtenerConfig(), NO sobre-escribe nombreTenant (ese campo se edita como el
// nombre de la organización, contra config_negocio).
export async function obtenerConfigAdmin() {
  const cfg = rowToConfig(await obtenerConfigRow())
  const t = await q1<any>(
    'select razon_social, nombre_comercial from tenants where id = $1',
    [await tenantActual()],
  )
  cfg.razonSocial = t?.razon_social ?? null
  cfg.nombreComercial = t?.nombre_comercial ?? null
  return cfg
}
