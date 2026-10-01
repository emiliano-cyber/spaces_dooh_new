-- @tipo: esquema
-- ============================================================================
--  PRECIO-01 · la TARIFA de cada pantalla de una propuesta la calcula el
--  SERVIDOR, y solo un gerente o superior puede poner otra.
-- ----------------------------------------------------------------------------
--  Decision del dueno, 2026-10-01, textual: «en propuestas aparte de ser
--  calculado el gerente sera el unico que podra poner otro precio diferente al
--  de la tarifa e igual usuarios superiores». Las dos columnas de abajo son la
--  forma que el dueno aprobo ese mismo dia.
--
--  Cierra el hallazgo B40 PARA LA TARIFA BASE: hasta hoy
--  `propuestas-controller.ts` copiaba la `tarifa_unitaria` que mandaba el
--  navegador, y se podia cerrar una venta de prime a 1 peso con un `curl`.
--  Desde esta migracion el servidor calcula la tarifa con la MISMA funcion que
--  la pantalla (`apps/web/lib/tarifa-calculada.ts`) y:
--
--    · si el precio enviado ES la tarifa (al centavo) → se guarda, sin ajuste;
--    · si es OTRO y quien lo manda NO tiene `comercial.aprobar` → 403, no se
--      guarda nada;
--    · si es otro y SI lo tiene (GERENTE_VENTAS, DIRECTOR_COMERCIAL,
--      ADMINISTRADOR, DUENO) → se guarda, con la tarifa calculada al lado y
--      quien lo ajusto.
--
--  ─── QUIEN ESCRIBE CADA COLUMNA ──────────────────────────────────────────
--
--   · `tarifa_calculada` — la escribe SOLO `crearPropuesta()`
--     (`lib/server/propuestas-repo.ts`) con el numero que calculo el
--     controller. NUNCA entra por el cuerpo de la peticion: el `itemSchema` de
--     zod no la declara. NULL = linea anterior a esta migracion, o pantalla sin
--     tarifa calculable a la que un gerente le puso precio.
--   · `precio_ajustado_por` — la escribe SOLO `crearPropuesta()`, con el id de
--     la SESION (`usuarioActual()`), el mismo camino que `propuestas.usuario_id`
--     (VEND-01). NUNCA del cuerpo. NULL = el precio ES la tarifa calculada, o la
--     linea es anterior a esta migracion.
--
--  Las dos son INTERNAS: la liga publica (`obtenerPropuestaPublica`) arma su
--  objeto campo por campo y no las lleva. El cliente ve solo el precio final.
--
--  ─── LO HISTORICO SE QUEDA EN NULL, A PROPOSITO ──────────────────────────
--  No hay backfill. Calcular hoy la tarifa de una linea de agosto daria la
--  tarifa de HOY, no la de entonces: la rejilla, las temporadas y las
--  modalidades se han movido desde aquel dia. Escribirla convertiria un «no se
--  sabe» en una afirmacion falsa sobre dinero, que es exactamente el `?? 0`
--  que este repositorio persigue. Y marcar `precio_ajustado_por` en lo viejo
--  seria peor: no hay a quien atribuirlo.
--
--  ─── LA FK DE `precio_ajustado_por` ES DE UNA COLUMNA ─────────────────────
--  `references usuarios(id) on delete set null` SIMPLE. La forma con lista de
--  columnas (`set null (col)`) es de PostgreSQL 15 y g500 corre 14.24. No hace
--  falta compuesta con el tenant por el mismo motivo que
--  `propuestas.usuario_id` y `propuestas.codigo_aprobado_por`: el id NO entra
--  por el cuerpo, sale de la sesion, que ya es de esta organizacion.
--  `set null` y no `restrict`: `borrarUsuario()` existe, y con `restrict` el
--  primer gerente que ajustara un precio quedaria imborrable. Quien ajusto
--  queda ademas en `acciones.usuario_nombre`, que es texto congelado.
--
--  ─── RLS Y GRANTS ────────────────────────────────────────────────────────
--  No es tabla nueva: `propuesta_items` tiene `tenant_isolation` ENABLE+FORCE
--  desde 20260720_hard1_rls_todas_tablas.sql. Se COMPRUEBA y se aborta si
--  faltara. Los GRANT de `propuesta_items` son de TABLA (`select, insert,
--  update, delete`, 20260820_grants_rol_app.sql), asi que cubren las columnas
--  nuevas; se repiten por el motivo medido en 20260923_tickets.sql.
--
--  ─── POSTGRESQL 14 Y 16 ──────────────────────────────────────────────────
--  Nada de la 15: ni `nulls not distinct`, ni `set null (col)`, ni `merge`.
--  `add column if not exists` y el `do $$` contra `pg_constraint` son de la
--  9.6. Transaccional e idempotente: correrla dos veces no cambia nada. No toca
--  ninguna fila existente ni `db/schema.sql`, y no mueve ni un importe.
-- ============================================================================
begin;

do $$
declare ok boolean;
begin
  select relrowsecurity and relforcerowsecurity into ok
    from pg_class where oid = 'propuesta_items'::regclass;
  if not coalesce(ok, false) then
    raise exception 'PRECIO-01: propuesta_items no tiene RLS ENABLE+FORCE; no se anaden columnas sobre una tabla sin aislamiento';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'propuesta_items' and policyname = 'tenant_isolation'
  ) then
    raise exception 'PRECIO-01: propuesta_items no tiene la politica tenant_isolation';
  end if;
end $$;

alter table propuesta_items add column if not exists tarifa_calculada numeric(14,2);
alter table propuesta_items add column if not exists precio_ajustado_por uuid;

-- La FK aparte del `add column`, para que la migracion sea idempotente tambien
-- a medias: si una corrida anterior murio entre las dos, la segunda no falla
-- por restriccion duplicada.
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'propuesta_items_precio_ajustado_por_fkey'
       and conrelid = 'propuesta_items'::regclass
  ) then
    alter table propuesta_items
      add constraint propuesta_items_precio_ajustado_por_fkey
      foreign key (precio_ajustado_por) references usuarios (id) on delete set null;
  end if;
end $$;

comment on column propuesta_items.tarifa_calculada is
  'PRECIO-01. La tarifa por unidad que CALCULO el servidor al crear la linea (lib/tarifa-calculada.ts: modalidad, rejilla por franja y temporada). La escribe solo crearPropuesta(), nunca el cuerpo de la peticion. NULL = linea anterior al 2026-10-01, o pantalla sin tarifa calculable a la que un gerente le puso precio. Interna: no viaja a la liga publica.';
comment on column propuesta_items.precio_ajustado_por is
  'PRECIO-01. Quien puso un precio DISTINTO de la tarifa calculada (usuario de la SESION con comercial.aprobar, nunca del cuerpo). NULL = el precio es la tarifa, o linea anterior al 2026-10-01. on delete set null: el nombre congelado vive en acciones. Interna: no viaja a la liga publica.';

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update on propuesta_items to %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Verificacion ──────────────────────────────────────────────────────────
select 'columnas nuevas en propuesta_items' k, count(*)::text v
  from information_schema.columns
 where table_name = 'propuesta_items'
   and column_name in ('tarifa_calculada','precio_ajustado_por')
union all
select 'la FK es on delete set null',
       count(*)::text
  from pg_constraint
 where conname = 'propuesta_items_precio_ajustado_por_fkey'
   and confdeltype = 'n'
union all
select 'lineas historicas sin tarifa calculada (no se rellenan)',
       count(*)::text from propuesta_items where tarifa_calculada is null;
