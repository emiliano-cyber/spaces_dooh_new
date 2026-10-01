-- @tipo: esquema
-- ============================================================================
--  COD-03 · el CÓDIGO PROMOCIONAL aplicado a una propuesta necesita la
--  APROBACIÓN de un admin o gerente antes de que lo vea el cliente.
-- ----------------------------------------------------------------------------
--  Decisiones del dueño (2026-09-30), textuales:
--
--   1. «En propuesta se debe de poder poner un cupón si fue rechazada para
--      volverla a activar» → aplicar un cupón a una RECHAZADA la devuelve a
--      BORRADOR en la misma transacción del canje.
--   2. «Si está en borrador, asignar un cupón existente» → selector de cupones
--      vigentes en la pantalla (no toca la base).
--   3. «Si se asigna, no se muestra al cliente hasta que un admin o gerente lo
--      apruebe» → TODO cupón aplicado nace PENDIENTE. Aprueban quienes tienen
--      `comercial.aprobar` (DUENO, ADMINISTRADOR, DIRECTOR_COMERCIAL,
--      GERENTE_VENTAS — «los cuatro»). El VENDEDOR aplica, no aprueba.
--   4. Opción B: mientras está PENDIENTE el cliente ve la propuesta SIN el
--      descuento y PUEDE aceptarla así.
--   5. Columnas aprobadas: TRES, en `propuestas`. Son éstas.
--
--  ═══ POR QUÉ TRES COLUMNAS EN `propuestas` Y NO UNA TABLA ═══════════════════
--
--  Un cupón por propuesta (`unique (propuesta_id)` en `canjes_codigo`), así que
--  hay como mucho UNA aprobación viva por propuesta. Una tabla de decisiones
--  compraría historia —quién rechazó qué y cuándo— y esa historia ya vive en
--  `acciones`, con el motivo del rechazo dentro. Las tres columnas viajan con
--  las otras tres del cupón (`codigo_texto`, `codigo_descuento_pct`,
--  `codigo_canjeado_en`) y se limpian con ellas al quitarlo.
--
--  ═══ TEXT + CHECK, NO ENUM ═════════════════════════════════════════════════
--
--  Un `create type ... as enum` no se puede ampliar dentro de una transacción
--  en PostgreSQL 14 sin trucos (`alter type ... add value` no corre en un
--  bloque transaccional antes de la 12, y el valor nuevo no se puede usar en la
--  misma transacción en ninguna). Con `text` + CHECK, añadir un estado mañana es
--  `drop constraint` + `add constraint`, transaccional y en una sola migración.
--
--  ═══ LOS CHECKS, Y POR QUÉ SE LLAMAN COMO SE LLAMAN ════════════════════════
--
--   · `propuestas_codigo_estado_ck`   → el dominio: NULL, 'PENDIENTE' o
--                                       'APROBADO'.
--   · `propuestas_codigo_revision_ck` → `codigo_texto is null` ⇔
--                                       `codigo_estado is null`. Un cupón sin
--                                       estado es un descuento que nadie sabe
--                                       si el cliente puede ver; un estado sin
--                                       cupón no significa nada.
--   · `propuestas_codigo_aprobado_ck` → APROBADO ⇒ `codigo_aprobado_en` no
--                                       nulo. Una aprobación sin fecha no se
--                                       puede auditar.
--
--  `codigo_aprobado_por` NO se exige con APROBADO, a propósito: es
--  `on delete set null`, así que dar de baja al gerente que aprobó dejaría la
--  fila inválida y el `delete` de `usuarios` fallaría por un CHECK de otra
--  tabla. Quién aprobó queda además en `acciones.usuario_nombre`, que es texto
--  congelado y sobrevive a la baja.
--
--  Los nombres NO son cosméticos: Postgres evalúa los CHECK de una tabla en
--  orden de nombre, y `codigo-promocional.e2e.test.ts` espera leer
--  `propuestas_codigo_pareja_ck` cuando alguien escribe un `codigo_texto` sin
--  porcentaje. `revision` ordena DETRÁS de `pareja`, así que ese mensaje no
--  cambia. (Si cambiara, no se perdería nada de dinero —la fila se rechaza
--  igual—, pero la prueba existente leería otro nombre.)
--
--  ═══ LA FK DE `codigo_aprobado_por` ES DE UNA COLUMNA ═══════════════════════
--
--  `references usuarios(id) on delete set null` — `on delete set null` SIMPLE,
--  que existe desde siempre. La forma con lista de columnas
--  (`set null (col)`) es de PostgreSQL 15 y g500 corre 14.24; aquí no hace
--  falta porque la FK no es compuesta.
--
--  ¿Por qué no compuesta con el tenant, como la de la franja programada? Porque
--  `codigo_aprobado_por` NO entra por el cuerpo de ninguna petición: lo escribe
--  el servidor con el id de la SESIÓN (`usuarioActual()`), que ya es de esta
--  organización por construcción. Es el mismo razonamiento que
--  `canjes_codigo.usuario_id` (20260928_codigo_promocional.sql), que también es
--  de una columna.
--
--  ═══ EL BACKFILL — por qué los cupones de AYER nacen APROBADOS ═════════════
--
--  Hasta hoy un cupón aplicado se le enseñaba al cliente en el acto
--  (`/p/[id]` pintaba «Código X (n %)» y el total con él). Las propuestas que
--  YA tienen `codigo_texto` son promesas que el cliente ya leyó. Marcarlas
--  PENDIENTE haría que mañana abriera la misma liga y viera un total MÁS ALTO
--  sin que nadie tocara su propuesta: le quitaríamos un descuento que ya le
--  dimos. Así que pasan a APROBADO, con `codigo_aprobado_en =
--  codigo_canjeado_en` —el momento en que de hecho se le enseñó— y
--  `codigo_aprobado_por` en NULL, que es la verdad: nadie lo aprobó, se aprobó
--  solo por la regla de entonces.
--
--  Va DENTRO de esta migración y no en una `@tipo: datos` aparte porque el
--  CHECK `revision` lo exige: sin el backfill, añadir el CHECK fallaría sobre
--  cualquier base con un solo cupón aplicado. No es una corrección de datos, es
--  la otra mitad del esquema.
--
--  ═══ RLS Y GRANTS ═══════════════════════════════════════════════════════
--
--  No es una tabla nueva: `propuestas` tiene `tenant_isolation` ENABLE+FORCE
--  desde 20260720_hard1_rls_todas_tablas.sql. Se COMPRUEBA y se aborta si
--  faltara, igual que PROG-01 con `campanas`. Los GRANT de tabla cubren las
--  columnas nuevas; se repiten por el motivo medido en 20260923_tickets.sql.
--
--  ═══ POSTGRESQL 14 ═══════════════════════════════════════════════════════
--
--  Nada de la 15: ni `nulls not distinct`, ni `set null (col)`, ni `merge`.
--  `add column if not exists` y los `do $$` contra `pg_constraint` son de la
--  9.6. Probada en postgres:14-alpine y 16-alpine.
--
--  Transaccional e idempotente: correrla dos veces no cambia nada (el backfill
--  solo toca filas con `codigo_texto` y SIN estado).
-- ============================================================================
begin;

-- Aborta ANTES de tocar nada si `propuestas` no estuviera aislada.
do $$
declare ok boolean;
begin
  select relrowsecurity and relforcerowsecurity into ok
    from pg_class where oid = 'propuestas'::regclass;
  if not coalesce(ok, false) then
    raise exception 'COD-03: propuestas no tiene RLS ENABLE+FORCE; no se añaden columnas sobre una tabla sin aislamiento';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'propuestas' and policyname = 'tenant_isolation'
  ) then
    raise exception 'COD-03: propuestas no tiene la politica tenant_isolation';
  end if;
end $$;

alter table propuestas add column if not exists codigo_estado text;
alter table propuestas add column if not exists codigo_aprobado_por uuid;
alter table propuestas add column if not exists codigo_aprobado_en timestamptz;

-- ─── El backfill, ANTES de los CHECK que lo exigen ─────────────────────────
-- Solo filas con cupón y SIN estado: eso es lo que la hace idempotente. Una
-- segunda corrida no encuentra ninguna, y una fila que ya estaba PENDIENTE no
-- se aprueba sola por volver a correr esto.
update propuestas
   set codigo_estado = 'APROBADO',
       codigo_aprobado_en = coalesce(codigo_canjeado_en, now())
 where codigo_texto is not null
   and codigo_estado is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'propuestas_codigo_aprobado_por_fkey'
                   and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_codigo_aprobado_por_fkey
      foreign key (codigo_aprobado_por) references usuarios (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'propuestas_codigo_estado_ck'
                   and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_codigo_estado_ck
      check (codigo_estado is null or codigo_estado in ('PENDIENTE', 'APROBADO'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'propuestas_codigo_revision_ck'
                   and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_codigo_revision_ck
      check ((codigo_texto is null) = (codigo_estado is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'propuestas_codigo_aprobado_ck'
                   and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_codigo_aprobado_ck
      check (codigo_estado is distinct from 'APROBADO' or codigo_aprobado_en is not null);
  end if;
end $$;

-- Parcial: casi ninguna propuesta tendrá un cupón pendiente a la vez, y la
-- marca de la lista («cupón pendiente») pregunta exactamente eso.
create index if not exists idx_propuestas_codigo_pendiente
  on propuestas (tenant_id)
  where codigo_estado = 'PENDIENTE';

comment on column propuestas.codigo_estado is
  'COD-03. NULL = sin cupon. PENDIENTE = aplicado, el cliente NO lo ve (ni la linea ni el total con el) y no puede pasar a APROBADA por dentro. APROBADO = lo aprobo alguien con comercial.aprobar; el cliente ya lo ve. Los cupones aplicados antes del 2026-10-03 nacen APROBADOS: el cliente ya los habia visto.';
comment on column propuestas.codigo_aprobado_por is
  'COD-03. Quien aprobo el cupon (usuario de la SESION, nunca del cuerpo). NULL con APROBADO = backfill de la migracion (nadie lo aprobo: se veia solo) o usuario dado de baja. El nombre congelado vive en acciones.';
comment on column propuestas.codigo_aprobado_en is
  'COD-03. Cuando se aprobo el cupon, con now() de Postgres. En el backfill es codigo_canjeado_en: el momento en que el cliente lo vio por primera vez.';

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, update on propuestas to %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
select 'columnas nuevas en propuestas' k, count(*)::text v
  from information_schema.columns
 where table_name = 'propuestas'
   and column_name in ('codigo_estado','codigo_aprobado_por','codigo_aprobado_en')
union all
select 'checks del cupon con aprobacion',
       count(*)::text
  from pg_constraint
 where conrelid = 'propuestas'::regclass
   and conname in ('propuestas_codigo_estado_ck','propuestas_codigo_revision_ck','propuestas_codigo_aprobado_ck')
union all
select 'cupones sin estado (tiene que ser 0)',
       count(*)::text from propuestas where codigo_texto is not null and codigo_estado is null
union all
select 'cupones pendientes (nace en 0)',
       count(*)::text from propuestas where codigo_estado = 'PENDIENTE';
