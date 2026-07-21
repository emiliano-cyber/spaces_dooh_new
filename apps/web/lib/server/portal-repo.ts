import 'server-only'
import { qConTenant, qRaw1 } from './db'
import { rowToCampana, rowToReserva } from './campanas-repo'
import { rowToSitio } from './sitios-repo'
import { rowToOT } from './ot-repo'

// ============================================================================
//  lib/server/portal-repo.ts — Datos PÚBLICOS del portal de una campaña.
// ----------------------------------------------------------------------------
//  El token es la autorización (no requiere sesión ni tenant). Devuelve SOLO lo
//  de esa campaña: nada de otros clientes/campañas ni datos financieros.
// ============================================================================

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string))

export async function obtenerPortalPublico(token: string) {
  const tok = (token ?? '').trim()
  if (!tok) return null

  // Sin sesión no hay tenant que fijar, y todas estas tablas son fail-closed
  // (Hardening 1 · Bloque B). El token público ES la autorización: Postgres
  // resuelve a qué tenant pertenece y el resto de las consultas corren bajo él.
  // Antes usaban q() con el GUC vacío, así que `sitios` (fail-closed desde M5)
  // ya devolvía cero filas: el portal llevaba tiempo sin mostrar sitios.
  const t = await qRaw1<{ tenant: string | null }>(
    'select portal_tenant_por_token($1) as tenant',
    [tok],
  )
  const tenantId = t?.tenant
  if (!tenantId) return null

  const q = <T = any>(sql: string, params?: unknown[]) => qConTenant<T>(tenantId, sql, params)
  const q1 = async <T = any>(sql: string, params?: unknown[]): Promise<T | null> =>
    (await q<T>(sql, params))[0] ?? null

  const c = await q1<any>(
    'select * from campanas where portal_token = $1 and portal_activo = true limit 1',
    [tok],
  )
  if (!c) return null

  const reservasRows = await q<any>('select * from reservas where campana_id = $1 order by creado_en asc', [c.id])
  const sitioIds = [...new Set(reservasRows.map((r) => r.sitio_id).filter(Boolean))]
  const sitiosRows = sitioIds.length
    ? await q<any>('select * from sitios where id = any($1::uuid[])', [sitioIds])
    : []
  const otsRows = await q<any>('select * from ordenes_trabajo where campana_id = $1 order by creado_en asc', [c.id])
  const otIds = otsRows.map((o) => o.id)
  const evidRows = otIds.length
    ? await q<any>('select * from evidencias_ot where ot_id = any($1::uuid[]) order by timestamp asc', [otIds])
    : []
  const creasRows = await q<any>('select * from creatividades where campana_id = $1 order by creado_en asc', [c.id])
  const oisRows = await q<any>('select * from ordenes_impresion where campana_id = $1 order by creado_en asc', [c.id])

  return {
    campanas: [rowToCampana(c)],
    reservas: reservasRows.map(rowToReserva),
    sitios: sitiosRows.map((r) => rowToSitio(r, [])),
    ordenesTrabajo: otsRows.map(rowToOT),
    evidencias: evidRows.map((e) => ({
      id: e.id, otId: e.ot_id, fotoUrl: e.foto_url, fotoKey: e.foto_key ?? null,
      formato: e.formato, tomadaEn: iso(e.tomada_en), timestamp: iso(e.timestamp),
    })),
    creatividades: creasRows.map((r) => ({
      id: r.id, campanaId: r.campana_id, nombre: r.nombre, archivoUrl: r.archivo_url,
      codigo: r.codigo ?? null, formato: r.formato, resolucion: r.resolucion,
      estatusValidacion: r.estatus_validacion, rechazadoMotivo: r.rechazado_motivo, creadoEn: iso(r.creado_en),
    })),
    ordenesImpresion: oisRows.map((r) => ({
      id: r.id, folio: r.folio, campanaId: r.campana_id, sitioId: r.sitio_id,
      material: r.material, estatus: r.estatus, creadoEn: iso(r.creado_en),
    })),
  }
}
