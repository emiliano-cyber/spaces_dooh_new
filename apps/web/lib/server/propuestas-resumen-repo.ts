import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/propuestas-resumen-repo.ts — Las filas del tablero de propuestas
//  por periodo (PROP-PER, 06/10). Solo lectura. Las cuentas están en
//  `lib/propuestas-periodo.ts`; aquí solo se lee, con el tenant en el WHERE
//  además de la RLS.
// ============================================================================

export interface FilaPropuestaResumen {
  id: string
  folio: string | null
  nombre: string
  estatus: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA'
  creada: string
  aprobada: string | null
  rechazada: string | null
  vendedorId: string | null
  vendedor: string | null
  /** Neto congelado al aprobar (`snapshot_economico.neto`), sin IVA. */
  venta: number | null
}

export interface ItemAprobadoResumen {
  propuestaId: string
  sitioId: string
  fechaInicio: string
  fechaFin: string
}

export async function filasPropuestasResumen(): Promise<{
  propuestas: FilaPropuestaResumen[]
  items: ItemAprobadoResumen[]
}> {
  const tenant = await tenantActual()
  const [props, items] = await Promise.all([
    q<any>(
      `select p.id, p.folio, p.nombre, p.estatus::text as estatus,
              to_char(p.creado_en, 'YYYY-MM-DD')    as creada,
              to_char(p.aprobada_en, 'YYYY-MM-DD')  as aprobada,
              to_char(p.rechazada_en, 'YYYY-MM-DD') as rechazada,
              p.usuario_id,
              u.nombre as vendedor,
              (p.snapshot_economico->>'neto')::numeric as venta
         from propuestas p
         -- El nombre de quien vende, con el tenant como segunda capa: un id de
         -- usuario de otra organización no le pone nombre a una de ésta.
         left join usuarios u on u.id = p.usuario_id and u.tenant_id = p.tenant_id
        where p.tenant_id = $1`,
      [tenant],
    ),
    // Solo las pantallas APROBADAS de cada propuesta: son las que se vendieron
    // y las que cuestan renta. Es el mismo criterio que el precio congelado.
    q<any>(
      `select i.propuesta_id, i.sitio_id,
              to_char(i.fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
              to_char(i.fecha_fin, 'YYYY-MM-DD')    as fecha_fin
         from propuesta_items i
        where i.tenant_id = $1 and i.aprobado`,
      [tenant],
    ),
  ])
  return {
    propuestas: props.map((r) => ({
      id: r.id,
      folio: r.folio ?? null,
      nombre: r.nombre,
      estatus: r.estatus,
      creada: r.creada,
      aprobada: r.aprobada,
      rechazada: r.rechazada,
      vendedorId: r.usuario_id ?? null,
      vendedor: r.vendedor ?? null,
      venta: r.venta != null ? Number(r.venta) : null,
    })),
    items: items.map((r) => ({
      propuestaId: r.propuesta_id,
      sitioId: r.sitio_id,
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
    })),
  }
}
