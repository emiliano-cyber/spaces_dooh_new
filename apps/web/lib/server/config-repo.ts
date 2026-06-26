import 'server-only'
import { q, q1 } from './db'

// ============================================================================
//  lib/server/config-repo.ts — Configuración del negocio (tenant). Fila única
//  en config_negocio. Se lee desde /api/config (admin) y desde /api/estado
//  (todos los roles) para que el logo, nombre, IVA y parámetros de loop/spot
//  estén disponibles en toda la app.
// ============================================================================

export function rowToConfig(r: any) {
  return {
    nombreTenant: r.nombre_tenant,
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
  return rowToConfig(await obtenerConfigRow())
}
