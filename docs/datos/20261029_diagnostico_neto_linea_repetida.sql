-- ============================================================================
--  B56 · DIAGNÓSTICO, SOLO LECTURA — campañas cobradas con el neto de OTRA línea
-- ----------------------------------------------------------------------------
--  Hasta el arreglo del 2026-10-29 (`lib/neto-de-linea.ts`), al generar la
--  campaña de una propuesta `campanas-repo.ts` emparejaba el neto congelado
--  SOLO por pantalla. Si la propuesta traía la MISMA pantalla dos veces —dos
--  franjas (prime y madrugada) o dos periodos—, las dos reservas se guardaban
--  con el neto de la ÚLTIMA línea del snapshot. Lo facturado no era lo
--  cotizado, y nada dio error.
--
--  El arreglo vale para las campañas que se generen DESDE AHORA. Las ya
--  generadas NO se tocan (decisión del dueño). Esta consulta solo las
--  ENCUENTRA, para que el dueño decida qué hacer con cada una.
--
--  ─── Qué es «afectada» ────────────────────────────────────────────────────
--
--   · propuesta APROBADA con `snapshot_economico`;
--   · una pantalla que sale MÁS DE UNA VEZ en `snapshot_economico->'porSitio'`
--     con netos DISTINTOS entre sí;
--   · y la campaña generada de esa propuesta tiene más de una reserva de esa
--     pantalla y TODAS con el MISMO `precio`.
--
--  Esa combinación es la huella exacta del defecto: el snapshot dice dos netos
--  y las reservas copiaron uno solo. `diferencia` = lo cotizado (suma de netos
--  del snapshot) menos lo guardado en reservas; positivo es lo que se dejó de
--  cobrar. Si una campaña se extendió después (`extenderCampana`) puede traer
--  reservas de más de esa pantalla: revisarla a mano antes de concluir.
--
--  ─── Cómo correrla ────────────────────────────────────────────────────────
--
--  NO tiene `update`, `delete` ni `insert`, y por eso NO lleva rollback. Va
--  dentro de una transacción de solo lectura para que no pueda escribir aunque
--  alguien le añada algo por error.
--
--  Las tablas tienen RLS: con el rol de la aplicación sin `app.tenant_id`
--  devuelve CERO filas sin avisar (el modo de fallo de R2). Correrla con el
--  dueño de la base (`postgres`), o fijando antes el tenant:
--      select set_config('app.tenant_id', '<uuid del tenant>', true);
--  Cero filas con el rol correcto = ninguna campaña afectada en esa base.
--
--      psql -d <base> -f docs/datos/20261029_diagnostico_neto_linea_repetida.sql
-- ============================================================================

begin transaction read only;

with lineas as (
  select p.id        as propuesta_id,
         p.tenant_id,
         p.folio     as propuesta_folio,
         e->>'sitioId'         as sitio_id,
         (e->>'neto')::numeric as neto
    from propuestas p
   cross join lateral jsonb_array_elements(p.snapshot_economico->'porSitio') as e
   where p.estatus = 'APROBADA'
     and p.snapshot_economico is not null
     and jsonb_typeof(p.snapshot_economico->'porSitio') = 'array'
),
pantallas_repetidas as (
  select propuesta_id, tenant_id, propuesta_folio, sitio_id,
         count(*)                     as lineas_en_snapshot,
         array_agg(neto order by neto) as netos_snapshot,
         sum(neto)                    as total_cotizado
    from lineas
   group by propuesta_id, tenant_id, propuesta_folio, sitio_id
  having count(*) > 1
     and count(distinct neto) > 1
),
reservas_de_campana as (
  select c.propuesta_id,
         c.tenant_id,
         c.id                 as campana_id,
         c.folio              as campana_folio,
         r.sitio_id::text     as sitio_id,
         count(*)             as reservas,
         count(distinct r.precio) as precios_distintos,
         array_agg(r.precio order by r.fecha_inicio, r.creado_en) as precios_reservas,
         sum(r.precio)        as total_en_reservas
    from campanas c
    join reservas r
      on r.campana_id = c.id
     and r.tenant_id  = c.tenant_id
   where c.propuesta_id is not null
   group by c.propuesta_id, c.tenant_id, c.id, c.folio, r.sitio_id
)
select t.slug                     as organizacion,
       x.propuesta_folio,
       rc.campana_folio,
       rc.campana_id,
       x.sitio_id,
       s.nombre                   as pantalla,
       x.lineas_en_snapshot,
       x.netos_snapshot,
       rc.reservas,
       rc.precios_reservas,
       x.total_cotizado,
       rc.total_en_reservas,
       x.total_cotizado - rc.total_en_reservas as diferencia
  from pantallas_repetidas x
  join reservas_de_campana rc
    on rc.propuesta_id = x.propuesta_id
   and rc.tenant_id    = x.tenant_id
   and rc.sitio_id     = x.sitio_id
  left join tenants t on t.id = x.tenant_id
  left join sitios  s on s.id::text = x.sitio_id and s.tenant_id = x.tenant_id
 where rc.reservas > 1
   and rc.precios_distintos = 1
 order by t.slug, x.propuesta_folio, s.nombre;

rollback;
