import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'
import { PREFIJO_BAJA } from '@/lib/vendedor-de-baja'
import type { FilaConteo } from '@/lib/propuestas-por-dia'

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

// `soloUsuario` (CONTEO-DIA, tarea 5, 17/11): el vendedor ve solo SUS
// propuestas, también aquí. Lo decide el controller con la sesión.
export async function filasPropuestasResumen(soloUsuario: string | null = null): Promise<{
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
              p.vendedor_nombre,
              -- P19 (29/10) · si el usuario se borró, el nombre congelado.
              coalesce(u.nombre, p.vendedor_nombre) as vendedor,
              (p.snapshot_economico->>'neto')::numeric as venta
         from propuestas p
         -- El nombre de quien vende, con el tenant como segunda capa: un id de
         -- usuario de otra organización no le pone nombre a una de ésta.
         left join usuarios u on u.id = p.usuario_id and u.tenant_id = p.tenant_id
        where p.tenant_id = $1
          and ($2::uuid is null or p.usuario_id = $2::uuid)`,
      [tenant, soloUsuario],
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
      // P19 (29/10) · un vendedor BORRADO se agrupa por su nombre congelado y
      // no se revuelve con las históricas («Sin vendedor»), igual que en el
      // reporte (`lib/vendedor-de-baja.ts`).
      vendedorId: r.usuario_id ?? (r.vendedor_nombre ? PREFIJO_BAJA + r.vendedor_nombre : null),
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
  sitios: { id: string; predioId: string | null; caras: number; propio?: boolean }[]
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
    q<any>(`select s.id, s.predio_id, s.caras, s.propio from sitios s where s.tenant_id = $1`, [tenant]),
    q<any>(
      `select c.id, c.sitio_id, c.predio_id, c.estatus, c.monto_renta, c.periodicidad
         from contratos_arrendamiento c
        where c.tenant_id = $1`,
      [tenant],
    ),
  ])
  return {
    sitios: sitios.map((r) => ({ id: r.id, predioId: r.predio_id ?? null, caras: r.caras ?? 1, propio: r.propio === true })),
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

// ─── CONTEO-DIA (17/11) · creadas y aprobadas por día ──────────────────────
//
// EL DÍA SE CORTA EN LA ZONA DEL NEGOCIO, con `at time zone $zona`, y no con el
// `to_char(p.creado_en, …)` de arriba, que usa la zona de la CONEXIÓN. Para un
// tablero por mes o trimestre la diferencia es una frontera de mes; para uno
// por DÍA son seis horas de cada día: lo creado a las 19:00 de Ciudad de México
// se contaría mañana con la base en UTC, sin dar un solo error.
// (`conteo-diario.e2e.test.ts` lo mide con la base de pruebas en UTC.)
//
// `soloUsuario` lo decide el controller con la SESIÓN, nunca la URL.
export async function filasConteoDiario(f: {
  zona: string
  desde: string
  hasta: string
  soloUsuario: string | null
}): Promise<FilaConteo[]> {
  const rows = await q<any>(
    `with p as (
       select p.estatus::text as estatus, p.usuario_id, p.vendedor_nombre,
              coalesce(u.nombre, p.vendedor_nombre) as vendedor,
              (p.creado_en  at time zone $2)::date as creada,
              (p.aprobada_en at time zone $2)::date as aprobada
         from propuestas p
         left join usuarios u on u.id = p.usuario_id and u.tenant_id = p.tenant_id
        where p.tenant_id = $1
          and ($5::uuid is null or p.usuario_id = $5::uuid)
     )
     select estatus, usuario_id, vendedor_nombre, vendedor,
            to_char(creada, 'YYYY-MM-DD') as creada,
            to_char(aprobada, 'YYYY-MM-DD') as aprobada
       from p
      where creada between $3::date and $4::date
         or aprobada between $3::date and $4::date`,
    [await tenantActual(), f.zona, f.desde, f.hasta, f.soloUsuario],
  )
  return rows.map((r) => ({
    creada: r.creada,
    aprobada: r.aprobada ?? null,
    estatus: r.estatus,
    // P19 · el vendedor borrado, por su nombre congelado (igual que arriba).
    vendedorId: r.usuario_id ?? (r.vendedor_nombre ? PREFIJO_BAJA + r.vendedor_nombre : null),
    vendedor: r.vendedor ?? null,
  }))
}
