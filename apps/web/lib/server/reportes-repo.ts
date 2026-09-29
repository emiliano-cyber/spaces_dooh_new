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
//  devuelve 24 rebanadas de tablas completas (`app/api/estado/route.ts:98-130`)
//  y el front derivaba los márgenes con `useStoreMemo` (`lib/data/client.ts:329`).
//  Ese endpoint ya se descontroló una vez —6.12 MB y pantalla en blanco de 6–12
//  segundos, documentado en `app/api/estado/route.ts:146-156`— y los reportes
//  de rentabilidad verán historia de AÑOS. Por ese camino no aguantan.
//
//  Aquí la lectura ya va ACOTADA POR EL RANGO donde se puede (reservas y
//  órdenes de trabajo), que es lo que impide que el volumen crezca con la
//  antigüedad de la cuenta y no con el periodo consultado.
// ============================================================================

const num = (v: unknown): number => (v == null || v === '' ? 0 : Number(v))

// `jsonb` llega ya como objeto por el driver, pero la columna es de texto libre
// para Postgres y una fila vieja podría llegar como cadena. Un `JSON.parse` que
// reviente aquí tumbaría el reporte ENTERO por una campaña con el snapshot
// malformado, así que se devuelve `null` y esa campaña se queda sin tarifa
// publicada — que es exactamente lo que la dimensión sabe declarar.
function seguroJson(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

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
  const [
    sitios,
    contratos,
    arrendadores,
    reservas,
    ordenesTrabajo,
    consumosEnergia,
    entidades,
    facturas,
    tarifasPublicadas,
    vendedores,
    vendedorDeCampana,
    costosOt,
  ] =
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
              entidad_id,
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
      `select sitio_id, campana_id, precio, estatus,
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
              end as duracion_seg,
              -- OT-COSTO-01. Lo que de VERDAD costo la visita. Sustituye a la
              -- tarifa por tipo en el motor; nulo = sin capturar, y entonces
              -- vale la estimacion. Viaja como texto (numeric) y se convierte
              -- abajo con Number, igual que duracion_seg.
              costo_real
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
    // MIS razones sociales, con sus papeles ya ETIQUETADOS. Son dos LEFT JOIN y
    // no un `join` a secas: una razón social recién dada de alta y todavía sin
    // papeles tiene que salir igual —existe, y su fila del reporte en cero es
    // información— y con un `join` desaparecería sin dar ningún error.
    //
    // La etiqueta sale de `catalogo_roles_entidad` y NO se escribe en el
    // cliente: es la MISMA fuente que usa la pantalla de Razones sociales
    // (`GestionEntidadesFiscales.tsx:70`), así que el mismo papel no puede
    // llamarse de dos formas según dónde salga. Y el orden es el `orden` del
    // catálogo, no el alfabético del código: «Paga las rentas» antes que
    // «Compra los activos» es una decisión del catálogo.
    //
    // `catalogo_roles_entidad` NO lleva `tenant_id` —es un catálogo del
    // producto, los cinco papeles son iguales para toda la flota— así que su
    // join no necesita filtro de tenant. El de `entidad_roles` sí lo lleva.
    //
    // Se leen TAMBIÉN las dadas de baja (activo = false). No es un descuido: un
    // reporte de un periodo pasado puede tener renta y facturación a nombre de
    // una sociedad que hoy ya no se usa, y filtrarlas aquí movería ese dinero a
    // «Sin asignar» — o sea, reescribiría la historia según el estado de hoy. Es
    // el mismo error que este módulo ya pagó con los contratos vencidos.
    q<any>(
      `select e.id, e.razon_social, e.activo,
              coalesce(
                array_agg(c.etiqueta order by c.orden) filter (where r.rol is not null),
                '{}'
              ) as papeles
         from entidades_fiscales e
         left join entidad_roles r
                on r.entidad_id = e.id
               and r.tenant_id  = e.tenant_id
         left join catalogo_roles_entidad c
                on c.rol = r.rol
        where e.tenant_id = $1
        group by e.id, e.razon_social, e.activo
        order by e.razon_social`,
      [tenantId],
    ),
    // El puente campaña → razón social emisora. SOLO esas dos columnas: el
    // importe del comprobante NO se lee, y es deliberado. El ingreso del reporte
    // sale de las reservas prorrateadas por días, y tomarlo de aquí daría dos
    // facturaciones distintas del mismo periodo según la dimensión.
    //
    // NO se acota por rango: lo que hace falta es el mapa de las campañas que
    // tocan el periodo, y la fecha del comprobante no tiene por qué caer dentro
    // —se emite antes o después—. Son dos columnas por campaña facturada, que es
    // el orden de magnitud de las campañas, no de las reservas.
    q<any>(
      `select campana_id, entidad_emisora_id
         from facturas
        where tenant_id = $1`,
      [tenantId],
    ),
    // La TARIFA PUBLICADA, congelada. El puente es
    // `reservas → campanas.propuesta_id → propuestas.snapshot_economico`
    // (`db/schema.sql:392`, índice `idx_campanas_propuesta` en `:407`).
    //
    // Se lee del SNAPSHOT y no de `sitio_modalidades` ni de `propuesta_items`, y
    // es la decisión que hace honesta esta dimensión: el snapshot es INMUTABLE
    // (`20260708_snapshot_economico.sql`) y guarda lo que el cliente aceptó
    // aquel día. La tarifa de la modalidad de HOY puede ser otra, y compararla
    // con un ingreso de hace seis meses daría un descuento que nadie concedió.
    // La cabecera de esa migración ya afirmaba que «rentabilidad lee de este
    // snapshot»; hasta hoy no era verdad.
    //
    // NO se acota por rango, por lo mismo que `facturas`: lo que hace falta es
    // el mapa de las campañas que tocan el periodo, y son dos columnas por
    // campaña nacida de propuesta — el orden de magnitud de las campañas, no el
    // de las reservas. Del JSON solo se usa `porSitio`; el resto de la escalera
    // económica (bruto, IVA, total) no interviene en esta comparación.
    //
    // El `join` lleva su propio `and p.tenant_id = c.tenant_id` además del
    // `where`: la RLS ya corta, pero un join sin filtro es la forma en que una
    // consulta se salta la segunda capa sin que nada falle.
    q<any>(
      `select c.id as campana_id, p.snapshot_economico as snapshot
         from campanas c
         join propuestas p
           on p.id = c.propuesta_id
          and p.tenant_id = c.tenant_id
        where c.tenant_id = $1
          and p.snapshot_economico is not null`,
      [tenantId],
    ),
    // Los VENDEDORES: los usuarios de ESTA organización (VEND-01).
    //
    // `and tenant_id = $1` es aquí la mitad del aislamiento, y la otra mitad la
    // pone el motor: un `usuario_id` que apunte fuera NO llega a esta lista, así
    // que su venta cae en «Sin vendedor» y ni su identificador se pinta. Sin el
    // filtro, un nombre y un cargo de otra empresa saldrían en una tabla de
    // dinero — y un reporte con una persona de más se lee perfectamente bien.
    //
    // Se leen TAMBIÉN los dados de baja (`activo = false`), por lo mismo que las
    // razones sociales y los contratos vencidos: un reporte de un periodo pasado
    // puede tener ventas de alguien que ya no trabaja aquí, y filtrarlo movería
    // su dinero a «Sin vendedor» — o sea, reescribiría la historia según el
    // estado de HOY. Ese error ya se pagó dos veces en este módulo.
    //
    // NO se filtra por rol. Quién puede crear una propuesta lo decide
    // `exigir('comercial','crear')` en el route, y repetir esa regla aquí
    // dejaría fuera del reporte al Dueño que cerró una venta él mismo — dos
    // implementaciones de la misma regla divergiendo, que es el error de raíz
    // que este repo documenta en `lib/server/tenant.ts:87-89`.
    q<any>(
      `select id, nombre, cargo
         from usuarios
        where tenant_id = $1`,
      [tenantId],
    ),
    // El puente campaña → vendedor: `campanas.propuesta_id → propuestas.usuario_id`
    // (`db/schema.sql:392`, índice `idx_campanas_propuesta` en `:407`, y
    // `idx_propuestas_usuario` desde `20260928_vendedor_en_propuesta.sql`).
    //
    // Es un JOIN y NO una columna en `campanas`, y es la decisión que esta
    // consulta encarna: copiar el vendedor a la campaña daría DOS verdades sobre
    // el mismo hecho, y divergirían el día que alguien reasigne una propuesta.
    // Y para la campaña nacida en Comercial no habría a quién copiar: estampar
    // ahí a quien la tecleó le acreditaría una venta a un operador.
    //
    // La fila SALE aunque `usuario_id` sea nulo, y eso es deliberado: que una
    // campaña ESTÉ en esta lista con vendedor nulo significa «propuesta
    // histórica» y que NO esté significa «nació en Comercial». Son dos huecos
    // distintos —uno se arregla y el otro no— y la cobertura los cuenta aparte.
    //
    // El `join` lleva su propio `and p.tenant_id = c.tenant_id` además del
    // `where`: la RLS ya corta, pero un join sin filtro es la forma en que una
    // consulta se salta la segunda capa sin que nada falle.
    q<any>(
      `select c.id as campana_id, p.usuario_id
         from campanas c
         join propuestas p
           on p.id = c.propuesta_id
          and p.tenant_id = c.tenant_id
        where c.tenant_id = $1`,
      [tenantId],
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
      // Cuál de MIS razones sociales paga esta renta. null es «sin asignar», y
      // es un estado legítimo: las filas anteriores al 17/09 están todas así.
      entidadId: r.entidad_id ?? null,
    })) as any,
    arrendadores: arrendadores.map((r) => ({ id: r.id, nombre: r.nombre })),
    entidades: entidades.map((r) => ({
      id: r.id,
      razonSocial: r.razon_social,
      // array_agg llega como arreglo de JS por el driver, pero conviene no
      // fiarse del borde: se normaliza aquí para que el motor puro no tenga que
      // defenderse de un null.
      papeles: Array.isArray(r.papeles) ? r.papeles : [],
    })),
    facturas: facturas.map((r) => ({
      campanaId: r.campana_id,
      entidadEmisoraId: r.entidad_emisora_id ?? null,
    })),
    // El snapshot es `jsonb`: el driver ya lo entrega como objeto de JS, pero es
    // una columna sin esquema y las filas del 08/07 en adelante no tienen por qué
    // traer la misma forma. Se normaliza AQUÍ, en el borde, y una entrada sin
    // `sitioId` o con importes que no son números se DESCARTA en vez de llegar al
    // motor: un `NaN` en la tarifa publicada se propagaría a la brecha y al
    // porcentaje sin dar ningún error, que es el modo de fallo que este módulo
    // entero existe para no tener.
    tarifasPublicadas: tarifasPublicadas
      .map((r) => {
        const snap = typeof r.snapshot === 'string' ? seguroJson(r.snapshot) : r.snapshot
        const porSitio = Array.isArray(snap?.porSitio) ? snap.porSitio : []
        return {
          campanaId: r.campana_id,
          porSitio: porSitio
            .map((e: any) => ({
              sitioId: e?.sitioId,
              lista: Number(e?.lista),
              neto: Number(e?.neto),
              // PAQ-01 (ADR 0039, Fase 4) · esta pantalla se vendió dentro de un
              // PAQUETE CERRADO, así que su `neto` NO deriva de su `lista`: es
              // la parte de un precio de conjunto repartida a prorrata. El
              // motor lo deja FUERA de la comparación publicada vs neta, porque
              // compararlos afirmaría un descuento que nadie concedió — y en un
              // paquete premium, uno NEGATIVO.
              //
              // `=== true` y no `!!`: esto sale de una columna `jsonb` sin
              // esquema, y la cadena `'false'` es `true` para `!!`. Aquí un
              // falso positivo saca de la comparación una venta que sí era
              // comparable, y eso baja la cobertura sin que nadie sepa por qué.
              dePaquete: e?.paquete === true,
            }))
            .filter(
              (e: any) =>
                typeof e.sitioId === 'string' &&
                e.sitioId !== '' &&
                Number.isFinite(e.lista) &&
                Number.isFinite(e.neto),
            ),
        }
      })
      .filter((t) => t.porSitio.length > 0),
    vendedores: vendedores.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      cargo: r.cargo ?? null,
    })),
    vendedorDeCampana: vendedorDeCampana.map((r) => ({
      campanaId: r.campana_id,
      // `?? null` y no el valor crudo: el driver entrega `null` para una columna
      // vacía, pero un `undefined` haría que `usuarioId` desapareciera del
      // objeto y `vendedorDeCampana.has()` seguiría diciendo que sí — que es
      // justo la distinción que separa el histórico de lo nacido en Comercial.
      usuarioId: r.usuario_id ?? null,
    })),
    reservas: reservas.map((r) => ({
      sitioId: r.sitio_id,
      campanaId: r.campana_id ?? null,
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
      // OT-COSTO-01. `numeric` llega de `pg` como TEXTO: sin el `Number()` el
      // motor sumaría CONCATENANDO y el costo de operación saldría como una
      // cadena — que no da error, da una cifra absurda. Y el `== null` conserva
      // el nulo, que es lo que distingue «no se capturó» de «costó cero»: de eso
      // depende que entre la estimación por tipo o no.
      costoReal: r.costo_real == null ? null : Number(r.costo_real),
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
