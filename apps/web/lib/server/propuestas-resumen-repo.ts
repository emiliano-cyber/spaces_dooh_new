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

// Lo mínimo para atribuir la renta de cada pantalla (08/10). Antes se usaban
// `listarSitios()` y `listarContratos()`, que son las consultas del estado
// completo: la de pantallas hace `select s.*` —y con eso trae de Postgres las
// FOTOS de cada pantalla, guardadas como data URL base64 en un `text[]`, para
// tirarlas— más dos subconsultas por pantalla sobre reservas y otras dos
// consultas de tarifas que aquí nadie lee. El tablero se pide de nuevo en cada
// cambio de periodo, así que ese peso se pagaba en cada clic.
//
// `contratoVigentePorSitio` y `rentaAtribuidaPorSitio` leen solo esto: de la
// pantalla, id, predio y caras; del contrato, a qué está anclado, su estatus y
// su renta. `caras ?? 1` y el `null` de la renta se conservan igual que en
// `rowToSitio` y `rowToContrato`: un contrato sin importe no es renta 0.
export async function filasAtribucionRenta(): Promise<{
  sitios: { id: string; predioId: string | null; caras: number }[]
  contratos: {
    id: string
    sitioId: string | null
    predioId: string | null
    estatus: string
    montoRenta: number | null
    periodicidad: string | null
  }[]
}> {
  const tenant = await tenantActual()
  const [sitios, contratos] = await Promise.all([
    q<any>(`select s.id, s.predio_id, s.caras from sitios s where s.tenant_id = $1`, [tenant]),
    q<any>(
      `select c.id, c.sitio_id, c.predio_id, c.estatus, c.monto_renta, c.periodicidad
         from contratos_arrendamiento c
        where c.tenant_id = $1`,
      [tenant],
    ),
  ])
  return {
    sitios: sitios.map((r) => ({ id: r.id, predioId: r.predio_id ?? null, caras: r.caras ?? 1 })),
    contratos: contratos.map((r) => ({
      id: r.id,
      sitioId: r.sitio_id ?? null,
      predioId: r.predio_id ?? null,
      estatus: r.estatus,
      montoRenta: r.monto_renta != null ? Number(r.monto_renta) : null,
      periodicidad: r.periodicidad ?? null,
    })),
  }
}
