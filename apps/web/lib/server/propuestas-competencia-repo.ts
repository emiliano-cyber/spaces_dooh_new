import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/propuestas-competencia-repo.ts — LO QUE LA COMPETENCIA DE MARCAS
//  DE UNA PROPUESTA LEE DE LA BASE (PROP-MARCA, 20/11).
// ----------------------------------------------------------------------------
//  Solo lecturas, todas con `q` (contexto de tenant, RLS) y `and tenant_id = $n`
//  como segunda capa: un id de otra organización no devuelve nada, no un error.
//  La regla y su contexto NO viven aquí: son los de Vallas
//  (`contextoParaVerificar` + `evaluarReglas`), vía `verificarCompetencia`.
// ============================================================================

/** El nombre del cliente: la marca de respaldo cuando la propuesta no trae una. */
export async function nombreDeCliente(clienteId: string): Promise<string | null> {
  const r = await q1<{ nombre: string }>('select nombre from clientes where id = $1 and tenant_id = $2', [
    clienteId,
    await tenantActual(),
  ])
  return r?.nombre ?? null
}

/** id → nombre de los sitios, para que el aviso diga DÓNDE choca. */
export async function nombresDeSitios(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const rows = await q<{ id: string; nombre: string }>(
    'select id, nombre from sitios where id = any($1::uuid[]) and tenant_id = $2',
    [ids, await tenantActual()],
  )
  return new Map(rows.map((r) => [r.id, r.nombre]))
}

/**
 * Lo que la regla necesita de una propuesta YA GUARDADA: su marca (con el
 * cliente de respaldo, la MISMA expresión que `contextoParaVerificar` usa para
 * las campañas), su periodo (el de sus líneas), sus sitios y la campaña que ya
 * generó, si la hay (para no chocar consigo misma). `null` si no existe o es de
 * otra organización.
 */
export async function datosCompetenciaDePropuesta(id: string): Promise<{
  marca: string | null
  fechaInicio: string | null
  fechaFin: string | null
  sitioIds: string[]
  campanaId: string | null
} | null> {
  const tenant = await tenantActual()
  const r = await q1<any>(
    `select coalesce(nullif(btrim(p.marca), ''), cl.nombre) as marca,
            to_char(min(i.fecha_inicio), 'YYYY-MM-DD') as fecha_inicio,
            to_char(max(i.fecha_fin), 'YYYY-MM-DD') as fecha_fin,
            coalesce(array_agg(distinct i.sitio_id) filter (where i.sitio_id is not null), '{}') as sitio_ids,
            (select c.id from campanas c where c.propuesta_id = p.id and c.tenant_id = p.tenant_id limit 1) as campana_id
       from propuestas p
       left join clientes cl on cl.id = p.cliente_id and cl.tenant_id = p.tenant_id
       left join propuesta_items i on i.propuesta_id = p.id and i.tenant_id = p.tenant_id
      where p.id = $1 and p.tenant_id = $2
      group by p.id, p.marca, p.tenant_id, cl.nombre`,
    [id, tenant],
  )
  if (!r) return null
  return {
    marca: r.marca ?? null,
    fechaInicio: r.fecha_inicio ?? null,
    fechaFin: r.fecha_fin ?? null,
    sitioIds: (r.sitio_ids ?? []).map(String),
    campanaId: r.campana_id ?? null,
  }
}
