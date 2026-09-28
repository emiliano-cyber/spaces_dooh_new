import 'server-only'
import { q, q1, withTenantTx } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/rejilla-repo.ts — El catálogo de franjas y temporadas de la
//  organización, y la rejilla de tarifas de cada pantalla.  ADR 0039, Fase 1.
// ----------------------------------------------------------------------------
//  CAPAS: `route.ts` → `*-controller.ts` → `*-repo.ts` → `db.ts`. El SQL vive
//  aquí, siempre parametrizado, y toda operación por `id` lleva
//  `and tenant_id = $n` como segunda capa sobre la RLS.
//
//  POR QUÉ ESA SEGUNDA CAPA IMPORTA ESPECIALMENTE EN ESTE ARCHIVO. El modo de
//  fallo de R2 no da error: una lectura sin contexto de tenant devuelve cero
//  filas en silencio, y cero filas de rejilla no significa «error», significa
//  «esta pantalla no tiene tarifa por franja» — o sea, se cobra la tarifa base.
//  Nadie ve un fallo; se ve un precio más barato. Es exactamente el molde de
//  los dos peores fallos de aislamiento del proyecto.
//
//  LA BAJA ES LÓGICA, NUNCA UN `delete`. `propuesta_items_franja_fkey` es
//  `on delete restrict` a propósito: una franja contratada es un hecho y no se
//  puede borrar sin borrar la venta. Si este repositorio ofreciera un borrado
//  real, la primera franja vendida devolvería un 500 sin explicar nada — el
//  mismo razonamiento que llevó `propuestas.usuario_id` a `set null` en vez de
//  `restrict`, resuelto aquí por el otro lado porque aquí SÍ hay baja lógica.
// ============================================================================

export type FranjaFila = {
  id: string
  nombre: string
  horaInicio: string
  horaFin: string
  orden: number
  activo: boolean
}

export type TemporadaFila = {
  id: string
  nombre: string
  desde: string
  hasta: string
  activo: boolean
}

export type FilaRejillaFila = {
  unidad: string
  franjaId: string | null
  franjaNombre: string | null
  temporadaId: string | null
  temporadaNombre: string | null
  tarifaPublicada: number
}

const aFranja = (r: any): FranjaFila => ({
  id: r.id,
  nombre: r.nombre,
  horaInicio: r.hora_inicio,
  horaFin: r.hora_fin,
  orden: Number(r.orden ?? 0),
  activo: !!r.activo,
})

const aTemporada = (r: any): TemporadaFila => ({
  id: r.id,
  nombre: r.nombre,
  desde: r.desde,
  hasta: r.hasta,
  activo: !!r.activo,
})

// ─── El catálogo ────────────────────────────────────────────────────────────

/**
 * Las franjas de la organización.
 *
 * `order by orden` y no por nombre: las franjas de un día se leen en el orden
 * en que el dueño las piensa —madrugada, mañana, prime, noche— y el alfabético
 * pondría «Madrugada» antes que «Prime». El nombre desempata para que el orden
 * sea estable cuando dos comparten `orden`.
 *
 * Por omisión SOLO LAS ACTIVAS: una franja apagada no se puede vender, y si
 * saliera en el selector de la propuesta se vendería. La pantalla de
 * configuración es el único sitio que pide las inactivas, para poder
 * reactivarlas.
 */
export async function listarFranjas(op?: { incluirInactivas?: boolean }): Promise<FranjaFila[]> {
  const donde = op?.incluirInactivas ? '' : 'where activo = true '
  const filas = await q<any>(
    `select id, nombre, hora_inicio, hora_fin, orden, activo
       from franjas_horarias ${donde}order by orden asc, nombre asc`,
  )
  return filas.map(aFranja)
}

/**
 * Las temporadas de la organización.
 *
 * `to_char(... ,'YYYY-MM-DD')` y no el tipo `date` del driver: `pg` devuelve un
 * `Date`, que es un INSTANTE, y `new Date('2026-11-13')` es medianoche UTC —
 * que en México se imprime como el día 12. La comparación de temporadas se hace
 * sobre cadenas `AAAA-MM-DD` en `lib/rejilla.ts` justo por eso.
 */
export async function listarTemporadas(op?: {
  incluirInactivas?: boolean
}): Promise<TemporadaFila[]> {
  const donde = op?.incluirInactivas ? '' : 'where activo = true '
  const filas = await q<any>(
    `select id, nombre, to_char(desde,'YYYY-MM-DD') as desde,
            to_char(hasta,'YYYY-MM-DD') as hasta, activo
       from temporadas ${donde}order by desde asc, nombre asc`,
  )
  return filas.map(aTemporada)
}

/**
 * Alta o edición de una franja. El `tenant_id` sale SIEMPRE de la sesión
 * (`tenantActual()`), nunca del argumento: si viajara en el cuerpo, cualquiera
 * podría escribir el catálogo de otra organización con un `curl`, y la fila
 * escrita llevaría un tenant coherente consigo misma, así que el `with check`
 * de la RLS la aprobaría.
 *
 * La validación de formato y de SOLAPE vive en `lib/rejilla.ts` y la aplica el
 * controller antes de llegar aquí. No se duplica: dos copias de esa regla
 * divergen, y aquí divergir significa dos precios para las 09:30.
 */
export async function guardarFranja(f: {
  id?: string
  nombre: string
  horaInicio: string
  horaFin: string
  orden?: number
  activo?: boolean
}): Promise<FranjaFila | null> {
  const t = await tenantActual()
  if (f.id) {
    const fila = await q1<any>(
      `update franjas_horarias
          set nombre = $3, hora_inicio = $4, hora_fin = $5, orden = $6, activo = $7
        where id = $1 and tenant_id = $2
        returning id, nombre, hora_inicio, hora_fin, orden, activo`,
      [f.id, t, f.nombre, f.horaInicio, f.horaFin, f.orden ?? 0, f.activo ?? true],
    )
    return fila ? aFranja(fila) : null
  }
  const fila = await q1<any>(
    `insert into franjas_horarias (tenant_id, nombre, hora_inicio, hora_fin, orden)
     values ($1,$2,$3,$4,$5)
     returning id, nombre, hora_inicio, hora_fin, orden, activo`,
    [t, f.nombre, f.horaInicio, f.horaFin, f.orden ?? 0],
  )
  return fila ? aFranja(fila) : null
}

/** Alta o edición de una temporada. Mismo criterio que `guardarFranja`. */
export async function guardarTemporada(t0: {
  id?: string
  nombre: string
  desde: string
  hasta: string
  activo?: boolean
}): Promise<TemporadaFila | null> {
  const t = await tenantActual()
  const SEL = `id, nombre, to_char(desde,'YYYY-MM-DD') as desde, to_char(hasta,'YYYY-MM-DD') as hasta, activo`
  if (t0.id) {
    const fila = await q1<any>(
      `update temporadas set nombre = $3, desde = $4::date, hasta = $5::date, activo = $6
        where id = $1 and tenant_id = $2 returning ${SEL}`,
      [t0.id, t, t0.nombre, t0.desde, t0.hasta, t0.activo ?? true],
    )
    return fila ? aTemporada(fila) : null
  }
  const fila = await q1<any>(
    `insert into temporadas (tenant_id, nombre, desde, hasta)
     values ($1,$2,$3::date,$4::date) returning ${SEL}`,
    [t, t0.nombre, t0.desde, t0.hasta],
  )
  return fila ? aTemporada(fila) : null
}

/**
 * Baja LÓGICA de una franja. NO existe un borrado real, y no es un olvido: ver
 * la cabecera de este archivo y el `on delete restrict` de la migración.
 */
export async function desactivarFranja(id: string): Promise<boolean> {
  const t = await tenantActual()
  const fila = await q1<any>(
    'update franjas_horarias set activo = false where id = $1 and tenant_id = $2 returning id',
    [id, t],
  )
  return !!fila
}

/** Baja lógica de una temporada. Mismo criterio. */
export async function desactivarTemporada(id: string): Promise<boolean> {
  const t = await tenantActual()
  const fila = await q1<any>(
    'update temporadas set activo = false where id = $1 and tenant_id = $2 returning id',
    [id, t],
  )
  return !!fila
}

// ─── La rejilla de una pantalla ─────────────────────────────────────────────

/**
 * La rejilla de tarifas de una pantalla, con los nombres de franja y temporada
 * resueltos.
 *
 * Los dos `left join` llevan `and <cat>.tenant_id = t.tenant_id`. La FK
 * compuesta de la migración ya impide que una fila cuelgue de una franja ajena,
 * y la RLS lo impediría de nuevo — esto es la tercera capa, la que queda en pie
 * el día que alguien conecte con un rol que se salte la política. Es barata y
 * el fallo que evita es silencioso.
 *
 * `left` y no interno: una fila «sin franja» (la que aplica a todo el día) es
 * el caso más común, y un join interno la dejaría fuera. Ese fallo no daría
 * error: la tarifa simplemente no se aplicaría.
 */
export async function rejillaDeSitio(sitioId: string): Promise<FilaRejillaFila[]> {
  const filas = await q<any>(
    `select t.unidad,
            t.franja_id, f.nombre as franja_nombre,
            t.temporada_id, e.nombre as temporada_nombre,
            t.tarifa_publicada
       from sitio_tarifas t
       left join franjas_horarias f on f.id = t.franja_id    and f.tenant_id = t.tenant_id
       left join temporadas       e on e.id = t.temporada_id and e.tenant_id = t.tenant_id
      where t.sitio_id = $1
      order by t.unidad asc, f.orden asc nulls first, e.desde asc nulls first`,
    [sitioId],
  )
  return filas.map((r) => ({
    unidad: r.unidad,
    franjaId: r.franja_id ?? null,
    franjaNombre: r.franja_nombre ?? null,
    temporadaId: r.temporada_id ?? null,
    temporadaNombre: r.temporada_nombre ?? null,
    tarifaPublicada: Number(r.tarifa_publicada),
  }))
}

export type CambiosRejilla = {
  guardar: {
    unidad: string
    franjaId: string | null
    temporadaId: string | null
    tarifaPublicada: number
  }[]
  quitar: { unidad: string; franjaId: string | null; temporadaId: string | null }[]
}

const NULO = '00000000-0000-0000-0000-000000000000'

/**
 * Aplica un DIFF sobre la rejilla de una pantalla. Devuelve la rejilla nueva, o
 * `null` si la pantalla no existe para esta organización.
 *
 * ─── NO HAY BORRADO EN BLOQUE, y es la decisión que más importa ────────────
 * `actualizarSitioCompleto` hace `delete from sitio_modalidades where sitio_id
 * = $1` y reinserta lo del archivo. Para una re-importación es correcto: el
 * archivo ES la verdad completa. Aquí llega una EDICIÓN, y lo que no viene no
 * es «bórralo», es «no se tocó». Con la otra semántica, guardar la tarifa del
 * prime se llevaría por delante la de la madrugada sin que nada fallara — y
 * perder un precio no da error, solo se deja de cobrar. Las bajas viajan
 * EXPLÍCITAS en `quitar`.
 *
 * ─── EL `on conflict` REPITE LAS EXPRESIONES DEL ÍNDICE ────────────────────
 * El único de `sitio_tarifas` es un índice de EXPRESIÓN con `coalesce` al uuid
 * nulo (`20260928_rejilla_franja_temporada.sql`), porque en PostgreSQL 14 dos
 * NULL no son iguales y un unique corriente admitiría dos filas «sin franja».
 * `on conflict` tiene que reproducir esas mismas expresiones, letra por letra, o
 * Postgres no encuentra el índice y falla — o peor, inserta duplicado.
 *
 * El tenant sale de la FILA DE LA PANTALLA y no de la sesión: una tarifa no
 * puede acabar en otro tenant que su pantalla. Mismo invariante que
 * `insertarSitio` y `actualizarModalidades`.
 */
export async function actualizarRejilla(
  sitioId: string,
  cambios: CambiosRejilla,
): Promise<FilaRejillaFila[] | null> {
  // La lectura pasa por `q`, o sea bajo RLS: una pantalla de otra organización
  // simplemente no aparece, y entonces no se escribe nada.
  const sitio = await q1<{ id: string; tenant_id: string }>(
    'select id, tenant_id from sitios where id = $1',
    [sitioId],
  )
  if (!sitio) return null

  // Todo o nada. Un alta aplicada con su baja hermana sin aplicar dejaría la
  // pantalla con una rejilla que nadie decidió, y con dos precios para la misma
  // venta. `withTenantTx` abre la transacción Y fija el GUC dentro de ella:
  // `set_config(..., true)` es transaction-local, así que fijarlo fuera no
  // serviría de nada.
  await withTenantTx(async (cliente) => {
    for (const g of cambios.guardar) {
      await cliente.query(
        `insert into sitio_tarifas (sitio_id, unidad, franja_id, temporada_id, tarifa_publicada, tenant_id)
         values ($1,$2,$3,$4,$5,$6)
         on conflict ( sitio_id, unidad, coalesce(franja_id, '${NULO}'::uuid), coalesce(temporada_id, '${NULO}'::uuid) )
           do update set tarifa_publicada = excluded.tarifa_publicada`,
        [sitioId, g.unidad, g.franjaId, g.temporadaId, g.tarifaPublicada, sitio.tenant_id],
      )
    }
    for (const qr of cambios.quitar) {
      // `is not distinct from` y no `=`: con `=` un NULL nunca casa, así que la
      // baja de la fila «sin franja» no borraría nada y no daría ningún error.
      // Y `and tenant_id = $4` es la segunda capa sobre la RLS que exigen las
      // convenciones para toda operación por id.
      await cliente.query(
        `delete from sitio_tarifas
          where sitio_id = $1 and unidad = $2
            and franja_id    is not distinct from $3::uuid
            and temporada_id is not distinct from $5::uuid
            and tenant_id = $4`,
        [sitioId, qr.unidad, qr.franjaId, sitio.tenant_id, qr.temporadaId],
      )
    }
  })
  return rejillaDeSitio(sitioId)
}
