import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/energia-repo.ts — El SQL de los consumos de luz. Solo el SQL.
// ----------------------------------------------------------------------------
//  Capas (convenciones.md): `route.ts` → `*-controller.ts` → `*-repo.ts` →
//  `db.ts`. Aquí vive la lectura y la escritura de `consumos_energia` y nada
//  más: qué es un hueco de captura lo decide `energia-controller.ts` con las
//  funciones puras del motor.
//
//  ─── Aislamiento (R2) ────────────────────────────────────────────────────
//  Las cuatro consultas usan `q()`/`q1()`, que fijan `app.tenant_id`
//  TRANSACTION-LOCAL antes de consultar, y además llevan `and tenant_id = $n`
//  explícito como SEGUNDA CAPA sobre la RLS. Nunca `qRaw()`: su modo de fallo no
//  da error —devuelve cero filas en silencio, o las de otra empresa— y en este
//  repo ya pasó dos veces.
//
//  El `delete` es el que más cuidado pide de los cuatro: un borrado por `id` sin
//  `and tenant_id` borraría el recibo de otra organización con un id adivinado o
//  filtrado, y la RLS sería la única defensa que quedaría.
//  `energia-repo.aislamiento.test.ts` lo comprueba leyendo este archivo.
//
//  `entidad_id` NO es frontera de seguridad en este repo: la única es
//  `tenant_id`.
// ============================================================================

const num = (v: unknown): number => (v == null || v === '' ? 0 : Number(v))

export interface ConsumoEnergia {
  id: string
  predioId: string | null
  sitioId: string | null
  /** `YYYY-MM-DD`, siempre el día 1 de su mes (lo garantiza un CHECK). */
  periodo: string
  medidor: string | null
  kwh: number
  importe: number
  notas: string | null
  creadoEn: string
}

/** Un punto de medición: dónde cuelga un medidor. Ver `energia-controller`. */
export interface PuntoDeMedicion {
  /** `P:<predioId>` o `S:<sitioId>`. La misma clave que usa el motor. */
  clave: string
  tipo: 'predio' | 'pantalla'
  id: string
  nombre: string
  /** Cuántas pantallas cuelgan de él. Una pantalla suelta es siempre 1. */
  pantallas: number
}

/**
 * Los recibos que TOCAN el rango de meses pedido.
 *
 * Acotada por el rango, que es lo que impide que el volumen crezca con la
 * antigüedad de la cuenta y no con el periodo consultado — la lección de los
 * 6.12 MB de `/api/estado`.
 *
 * `periodo` sale como TEXTO con `to_char`, igual que todas las fechas de
 * calendario de este repo: `pg` entrega un `date` como Date a medianoche local
 * y `toISOString()` la corre a UTC, que en México (UTC−6) devuelve el día
 * ANTERIOR — y aquí eso movería el recibo al mes anterior entero.
 */
export async function listarConsumos(desde: string, hasta: string): Promise<ConsumoEnergia[]> {
  const tenantId = await tenantActual()
  const filas = await q<any>(
    `select id, predio_id, sitio_id, medidor, kwh, importe, notas,
            to_char(periodo,   'YYYY-MM-DD') as periodo,
            to_char(creado_en, 'YYYY-MM-DD') as creado_en
       from consumos_energia
      where tenant_id = $1
        and periodo >= $2::date
        and periodo <= $3::date
      order by periodo desc, medidor nulls first`,
    [tenantId, desde, hasta],
  )
  return filas.map((r) => ({
    id: r.id,
    predioId: r.predio_id ?? null,
    sitioId: r.sitio_id ?? null,
    periodo: r.periodo,
    medidor: r.medidor ?? null,
    // `numeric` llega del driver como TEXTO. Sin el `Number()`, sumar dos
    // importes los concatenaría.
    kwh: num(r.kwh),
    importe: num(r.importe),
    notas: r.notas ?? null,
    creadoEn: r.creado_en,
  }))
}

/**
 * Dónde puede colgar un medidor: cada predio con pantallas, y cada pantalla
 * SIN predio.
 *
 * Los dos casos, y no solo el predio, porque `sitios.predio_id` es nullable: una
 * pantalla suelta tiene su propio recibo y sin ella en esta lista no habría
 * dónde capturarlo — la pantalla existiría en el inventario y su luz no tendría
 * fila en ningún sitio.
 *
 * Un predio SIN pantallas no sale: capturarle un recibo sería meter un importe
 * que no puede llegar a ninguna fila del reporte. Si aun así lo tiene —porque se
 * capturó antes de dar de alta las pantallas— el reporte lo DECLARA en vez de
 * tragárselo; ver `coberturaDeRecibos` en `lib/data/reportes.ts`.
 */
export async function puntosDeMedicion(): Promise<PuntoDeMedicion[]> {
  const tenantId = await tenantActual()
  const filas = await q<any>(
    `select 'predio' as tipo, p.id, p.nombre, count(s.id) as pantallas
       from predios p
       join sitios s on s.predio_id = p.id and s.tenant_id = $1
      where p.tenant_id = $1
      group by p.id, p.nombre
     union all
     select 'pantalla' as tipo, s.id, s.nombre, 1 as pantallas
       from sitios s
      where s.tenant_id = $1
        and s.predio_id is null
      order by tipo, nombre`,
    [tenantId],
  )
  return filas.map((r) => ({
    clave: r.tipo === 'predio' ? `P:${r.id}` : `S:${r.id}`,
    tipo: r.tipo,
    id: r.id,
    nombre: r.nombre,
    pantallas: Number(r.pantallas),
  }))
}

export interface NuevoConsumo {
  predioId: string | null
  sitioId: string | null
  periodo: string
  medidor: string | null
  kwh: number
  importe: number
  notas: string | null
  creadoPor: string | null
}

/**
 * Alta de un recibo.
 *
 * El `tenant_id` se escribe desde la sesión y NO desde el cuerpo de la
 * petición: que no haya por dónde mandarlo es parte del diseño del endpoint.
 * La política de la tabla lleva `with check`, así que un `tenant_id` que no
 * coincida con el contexto lo rechaza además la base.
 *
 * Los duplicados los corta el índice único `consumos_energia_predio_uq` —que
 * incluye el medidor y usa `coalesce(medidor,'')`—, y `errores.ts` traduce el
 * `23505` de Postgres a un 409 con mensaje. No se comprueba antes con un
 * `select`: entre el select y el insert cabe otra petición, y el único sitio
 * donde esa carrera no existe es el índice.
 */
export async function crearConsumo(d: NuevoConsumo): Promise<ConsumoEnergia> {
  const tenantId = await tenantActual()
  const r = await q1<any>(
    `insert into consumos_energia
       (tenant_id, predio_id, sitio_id, periodo, medidor, kwh, importe, notas, creado_por)
     values ($1, $2, $3, $4::date, $5, $6, $7, $8, $9)
     returning id, predio_id, sitio_id, medidor, kwh, importe, notas,
               to_char(periodo,   'YYYY-MM-DD') as periodo,
               to_char(creado_en, 'YYYY-MM-DD') as creado_en`,
    [
      tenantId,
      d.predioId,
      d.sitioId,
      d.periodo,
      d.medidor,
      d.kwh,
      d.importe,
      d.notas,
      d.creadoPor,
    ],
  )
  return {
    id: r.id,
    predioId: r.predio_id ?? null,
    sitioId: r.sitio_id ?? null,
    periodo: r.periodo,
    medidor: r.medidor ?? null,
    kwh: num(r.kwh),
    importe: num(r.importe),
    notas: r.notas ?? null,
    creadoEn: r.creado_en,
  }
}

/**
 * Borrado real de un recibo mal capturado.
 *
 * Existe porque sin él un importe tecleado con un cero de más es permanente: el
 * índice único impide volver a capturar ese mismo recibo, así que la fila mala
 * se quedaría para siempre inflando el costo de la luz de todo un mes. No es
 * historia que preservar, es un error — mismo criterio que el borrado de
 * licencias. Quién lo borró queda en la bitácora, que es de solo-agregar.
 *
 * El `and tenant_id = $2` es la segunda capa sobre la RLS y aquí es la que más
 * importa de las cuatro consultas: sin él, un id de otra organización borraría
 * su recibo.
 */
export async function eliminarConsumo(id: string): Promise<boolean> {
  const tenantId = await tenantActual()
  const r = await q1<any>(
    `delete from consumos_energia
      where id = $1
        and tenant_id = $2
      returning id`,
    [id, tenantId],
  )
  return !!r
}
