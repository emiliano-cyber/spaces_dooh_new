import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'
import { costosOtDelTenant } from './config-repo'
import type { DatosRentabilidad, RangoReporte } from '@/lib/data/reportes'

// ============================================================================
//  lib/server/reportes-repo.ts — El SQL de los reportes. Solo el SQL.
// ----------------------------------------------------------------------------
//  Capas del repo (convenciones.md): `route.ts` → `*-controller.ts` →
//  `*-repo.ts` → `db.ts`. Aquí vive la lectura de la base y nada más: la
//  aritmética del prorrateo está en `lib/data/reportes.ts`, que es pura y se
//  prueba sin Postgres.
//
//  ─── Aislamiento (R2) ────────────────────────────────────────────────────
//  Todas las consultas usan `q()`, que fija `app.tenant_id` TRANSACTION-LOCAL
//  antes de consultar, y además llevan `and tenant_id = $1` explícito como
//  SEGUNDA CAPA sobre la RLS. Nunca `qRaw()`: su modo de fallo no da error —
//  devuelve cero filas en silencio, o las de otra empresa—, y en este repo ya
//  pasó dos veces. `reportes-repo.aislamiento.test.ts` comprueba las dos cosas
//  leyendo este archivo, así que quitar un `and tenant_id` pone la suite roja.
//
//  ─── Por qué esto existe, y es lo importante del cambio ──────────────────
//  Hasta hoy la analítica se calculaba en el NAVEGADOR: `GET /api/estado`
//  devuelve 23 rebanadas de tablas completas (`app/api/estado/route.ts:97-124`)
//  y el front derivaba los márgenes con `useStoreMemo` (`lib/data/client.ts:329`).
//  Ese endpoint ya se descontroló una vez —6.12 MB y pantalla en blanco de 6–12
//  segundos, documentado en `app/api/estado/route.ts:132-141`— y los reportes
//  de rentabilidad verán historia de AÑOS. Por ese camino no aguantan.
//
//  Aquí la lectura ya va ACOTADA POR EL RANGO donde se puede (reservas y
//  órdenes de trabajo), que es lo que impide que el volumen crezca con la
//  antigüedad de la cuenta y no con el periodo consultado.
// ============================================================================

const num = (v: unknown): number => (v == null || v === '' ? 0 : Number(v))

/**
 * Lo que el motor de rentabilidad necesita de la base para un rango.
 *
 * Reparto de responsabilidades, y es deliberado: el SQL acota por lo que es
 * PARÁMETRO DEL REPORTE (el rango de fechas) y NO aplica ninguna regla de
 * negocio. Qué estatus de reserva cuenta, qué contrato está activo y cómo se
 * atribuye la renta lo decide `lib/data/reportes.ts` con las funciones de
 * `derive.ts`. Si el `where` repitiera esas reglas habría dos copias de cada
 * una, y el día que cambie una el reporte y el dashboard darían cifras
 * distintas sin que nada fallara — el error de raíz que este repo documenta en
 * `lib/server/tenant.ts:87-89`.
 */
export async function datosRentabilidad(rango: RangoReporte): Promise<DatosRentabilidad> {
  const tenantId = await tenantActual()

  // Las fechas de CALENDARIO salen como texto `YYYY-MM-DD`, no como Date del
  // driver. `pg` entrega un `date` como Date a medianoche local y el `iso()` de
  // los otros repos lo pasa por `toISOString()`, que la corre a UTC: en México
  // (UTC−6) eso devuelve el día ANTERIOR. Ese error ya se pagó en este repo
  // (ver `diasHasta` en `lib/data/derive.ts`), y en un reporte prorrateado por
  // días desplazaría dinero de un periodo a otro sin dar ningún síntoma.
  const [sitios, contratos, arrendadores, reservas, ordenesTrabajo, consumosEnergia, costosOt] =
    await Promise.all([
    // Solo las columnas que la atribución y las dimensiones necesitan.
    // `select *` sobre `sitios` arrastra las fotos en data URL —1.0 MB por doce
    // pantallas— y fue una de las causas de los 6.12 MB de `/api/estado`.
    //
    // `tipo_medio`, `es_rotativo` y `exhibicion` deciden si la pantalla se vende
    // por metros o por spots, y `ancho`/`alto` son la superficie. Los cinco son
    // escalares pequeños y entran desde el 18/09 con la dimensión `m2`.
    //
    // NO se lee `precio_m2`: existe, y significa OTRA COSA —el costo de
    // impresión por m², de donde sale `tarifa_impresion` (`sitios-repo.ts`)—.
    // Leerlo aquí invitaría a usarlo como si hablara de rentabilidad.
    q<any>(
      `select id, nombre, clave_interna, codigo_proveedor, caras, predio_id,
              tipo_medio, es_rotativo, exhibicion, ancho, alto
         from sitios
        where tenant_id = $1`,
      [tenantId],
    ),
    // Sin filtrar por estatus: quién cuenta como contrato activo lo decide
    // `contratoActivo()` en derive.ts. `documento_url` y `documento_congelado`
    // quedan fuera a propósito (ver `listarContratos`: ~300 kB por contrato).
    q<any>(
      `select id, sitio_id, arrendador_id, predio_id, monto_renta, periodicidad, estatus,
              to_char(fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
              to_char(fecha_fin,    'YYYY-MM-DD') as fecha_fin
         from contratos_arrendamiento
        where tenant_id = $1`,
      [tenantId],
    ),
    q<any>(`select id, nombre from arrendadores where tenant_id = $1`, [tenantId]),
    // ACOTADA POR EL RANGO. Una reserva entra si SOLAPA el periodo pedido, no
    // si empieza dentro: una campaña anual toca todos los trimestres del año y
    // aporta su parte a cada uno.
    //
    // El estatus NO se filtra aquí aunque se pudiera: la regla («CANCELADA no
    // suma, TENTATIVA sí porque el lugar ya está apartado») vive en
    // `lib/data/reportes.ts`, una sola vez.
    q<any>(
      `select sitio_id, precio, estatus,
              to_char(fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
              to_char(fecha_fin,    'YYYY-MM-DD') as fecha_fin
         from reservas
        where tenant_id = $1
          and fecha_inicio <= $3::date
          and fecha_fin    >= $2::date`,
      [tenantId, rango.desde, rango.hasta],
    ),
    // ACOTADA POR EL RANGO, con la MISMA prelación de fechas que `fechaDeOt()`
    // en `lib/data/reportes.ts`: completada → programada → creación. Las dos
    // tienen que decir lo mismo, porque este `where` decide qué filas LLEGAN y
    // el código decide en qué periodo CAEN: si difirieran, una OT quedaría
    // fuera del reporte sin aparecer en ningún periodo y sin dar error.
    // `reportes-repo.aislamiento.test.ts` compara las dos listas.
    //
    // `duracion_seg` es la duración REAL de la visita, y se calcula EN SQL como
    // la diferencia de dos `timestamptz` —o sea un intervalo— en vez de traer
    // las dos marcas y restarlas en Node. Un intervalo no tiene zona horaria:
    // así la cuenta no depende de en qué máquina corre el proceso. Nula cuando
    // la OT no tiene las dos marcas, que es «no se sabe» y no «cero».
    q<any>(
      `select sitio_id, tipo, estatus,
              to_char(fecha_completada, 'YYYY-MM-DD') as fecha_completada,
              to_char(fecha_programada, 'YYYY-MM-DD') as fecha_programada,
              to_char(creado_en,        'YYYY-MM-DD') as creado_en,
              case when fecha_inicio is not null and fecha_completada is not null
                   then extract(epoch from (fecha_completada - fecha_inicio))
              end as duracion_seg
         from ordenes_trabajo
        where tenant_id = $1
          and coalesce(fecha_completada, fecha_programada, creado_en)::date
              between $2::date and $3::date`,
      [tenantId, rango.desde, rango.hasta],
    ),
    // ACOTADA POR EL RANGO, y por el MES del recibo y no por su día 1: un
    // recibo cubre su mes entero, así que el de febrero cuenta en un rango que
    // empieza el 10 de febrero. Si el `where` filtrara por `periodo between`, ese
    // recibo se quedaría fuera y la pantalla saldría sin costo de luz en un mes
    // en el que sí lo tuvo — sin dar ningún error, que es el modo de fallo que
    // este módulo entero existe para no tener.
    //
    // `periodo` sale como TEXTO con `to_char`, igual que las demás fechas de
    // calendario de este repo: `pg` entrega un `date` como Date a medianoche
    // local y `toISOString()` lo corre a UTC, que en México (UTC−6) devuelve el
    // día ANTERIOR — y aquí eso movería el recibo al mes anterior entero.
    //
    // `medidor` NO se lee: no interviene en el reparto, solo en la unicidad de
    // la captura. Traerlo invitaría a agrupar por él en el motor, que es una
    // pregunta que este reporte no contesta.
    q<any>(
      `select predio_id, sitio_id, kwh, importe,
              to_char(periodo, 'YYYY-MM-DD') as periodo
         from consumos_energia
        where tenant_id = $1
          and periodo <= $3::date
          and (periodo + interval '1 month - 1 day')::date >= $2::date`,
      [tenantId, rango.desde, rango.hasta],
    ),
    // El costo por tipo de OT sale de `config_negocio` (una fila por tenant,
    // ADR 0011) por su función de siempre, no por una consulta propia: el
    // invariante dice que quien lee esa tabla usa la consulta CON tenant.
    costosOtDelTenant(),
    ])

  return {
    sitios: sitios.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      claveInterna: r.clave_interna ?? '',
      codigoProveedor: r.codigo_proveedor ?? '',
      caras: r.caras ?? 1,
      predioId: r.predio_id ?? null,
      tipoMedio: r.tipo_medio,
      esRotativo: r.es_rotativo === true,
      exhibicion: r.exhibicion ?? '',
      // `numeric` llega del driver como TEXTO, no como número: sin este
      // `Number()` la superficie sería `'6' * '3'` —que en JavaScript sí da 18—
      // pero `'6.5' * null` daría 0 y una comparación `> 0` sobre una cadena
      // haría cosas distintas según el valor. Se convierte una vez, aquí.
      ancho: r.ancho == null ? null : Number(r.ancho),
      alto: r.alto == null ? null : Number(r.alto),
    })) as any,
    contratos: contratos.map((r) => ({
      id: r.id,
      sitioId: r.sitio_id,
      arrendadorId: r.arrendador_id ?? null,
      predioId: r.predio_id ?? null,
      montoRenta: r.monto_renta == null ? null : Number(r.monto_renta),
      periodicidad: r.periodicidad ?? null,
      estatus: r.estatus,
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin ?? null,
    })) as any,
    arrendadores: arrendadores.map((r) => ({ id: r.id, nombre: r.nombre })),
    reservas: reservas.map((r) => ({
      sitioId: r.sitio_id,
      precio: num(r.precio),
      estatus: r.estatus,
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
    })),
    ordenesTrabajo: ordenesTrabajo.map((r) => ({
      sitioId: r.sitio_id ?? null,
      tipo: r.tipo,
      estatus: r.estatus,
      fechaCompletada: r.fecha_completada ?? null,
      fechaProgramada: r.fecha_programada ?? null,
      creadoEn: r.creado_en ?? null,
      duracionSeg: r.duracion_seg == null ? null : Number(r.duracion_seg),
    })),
    // `numeric` llega del driver como TEXTO. Sin el `Number()`, sumar kWh
    // concatenaría cadenas y el reparto multiplicaría texto por fracción: a
    // veces da el número y a veces `NaN`, según el valor. Se convierte una vez,
    // aquí en el borde, igual que `ancho` y `alto`.
    consumosEnergia: consumosEnergia.map((r) => ({
      predioId: r.predio_id ?? null,
      sitioId: r.sitio_id ?? null,
      periodo: r.periodo,
      kwh: num(r.kwh),
      importe: num(r.importe),
    })),
    costosOt,
  }
}
