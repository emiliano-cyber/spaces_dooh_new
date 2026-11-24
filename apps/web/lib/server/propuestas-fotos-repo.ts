import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/propuestas-fotos-repo.ts — MODEL del cuadro «Fotos de las
//  pantallas» de la ficha INTERNA de la propuesta (dueño, 20/11).
// ----------------------------------------------------------------------------
//  UNA consulta por propuesta, no una por sitio: la ficha pinta todas las
//  miniaturas a la vez, y veinte sitios serían veinte viajes a la base.
//
//  ⚠️ R2 · `q` y no `qRaw`: `sitios` y `propuesta_items` son fail-closed por
//  RLS, y `qRaw` devolvería cero filas en silencio. Aun así cada tabla repite
//  su `tenant_id`, que es la segunda capa que no admite excepciones.
// ============================================================================

export interface FotosSitioLeidas {
  sitioId: string
  nombre: string
  fotos: unknown
}

/**
 * Las fotos de cada sitio de la propuesta, un renglón por SITIO (un sitio
 * contratado dos veces sale una), en el orden en que entró a la propuesta.
 * `null` si la propuesta no existe en esta organización.
 */
export async function leerFotosDeSitiosDePropuesta(propuestaId: string): Promise<FotosSitioLeidas[] | null> {
  const tenant = await tenantActual()
  const p = await q1('select 1 from propuestas where id = $1 and tenant_id = $2', [propuestaId, tenant])
  if (!p) return null
  const filas = await q<any>(
    `select s.id, s.nombre, s.fotos
       from (select sitio_id, min(creado_en) as primero
               from propuesta_items
              where propuesta_id = $1 and tenant_id = $2
              group by sitio_id) i
       join sitios s on s.id = i.sitio_id and s.tenant_id = $2
      order by i.primero asc, s.nombre asc`,
    [propuestaId, tenant],
  )
  return filas.map((r) => ({ sitioId: r.id, nombre: r.nombre, fotos: r.fotos }))
}
