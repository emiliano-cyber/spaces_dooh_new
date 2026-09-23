-- @pg-min: 15
-- ============================================================================
-- Las tres claves ajenas hacia `entidades_fiscales`, repuntadas a la pareja
-- `(id, tenant_id)`.
--
-- ── El agujero, MEDIDO y no deducido ──────────────────────────────────────
-- El 2026-09-18, con el rol `spaces_app` y dentro de una transacción que se
-- deshizo, con `app.tenant_id = B`:
--
--   select razon_social from entidades_fiscales;   -> solo las de B
--   insert into entidad_roles (entidad_id, rol, tenant_id)
--     values (<entidad de A>, 'VENTAS', <B>);      -> INSERT 0 1   <- PASABA
--
-- La RLS lee bien. Lo que no ve es esto: la fila que se escribe LLEVA el
-- `tenant_id` correcto (B), así que el `with check` de `tenant_isolation` la
-- aprueba. Lo que apunta a otra organización es `entidad_id`, y de eso responde
-- la clave ajena — que en PostgreSQL se comprueba CON LOS PRIVILEGIOS DEL DUEÑO
-- de la tabla referenciada y por tanto ELUDE la política. Siendo plana contra
-- `(id)`, solo exigía que la fila existiera EN ALGÚN SITIO.
--
-- Resultado: roles fiscales, contratos y comprobantes de una organización
-- colgados de la razón social de otra. Es el molde exacto de un fallo R2 de
-- este repositorio: NO DA ERROR.
--
-- ── Por qué se cierra en el esquema y no en el código ─────────────────────
-- Hoy no se alcanza desde la aplicación porque `entidades-repo.ts` valida el
-- tenant antes de escribir. Eso es una validación, y una validación es algo que
-- alguien puede olvidar en la siguiente ruta — y se vuelve alcanzable justo
-- cuando una pantalla cablea un selector de entidad, que es lo que se está
-- construyendo. Con la FK compuesta, olvidarla deja de ser posible: la base
-- rechaza la escritura.
--
-- El `unique (id, tenant_id)` es la pieza que faltaba y por la que las tres FK
-- nacieron planas: PostgreSQL exige que las columnas referenciadas sean clave
-- única. No sustituye a la PK sobre `(id)`, que sigue en pie — es una
-- restricción ADICIONAL, y el índice que la respalda es redundante por diseño.
--
-- ── Dos detalles de comportamiento que hay que no romper ──────────────────
-- 1. `MATCH SIMPLE` (el de omisión, y aquí el correcto): una FK compuesta NO se
--    comprueba cuando ALGUNA de sus columnas es NULL. Como `entidad_id` es
--    nullable y `tenant_id` es NOT NULL, «sin asignar» sigue entrando sin
--    tocar. Con `MATCH FULL` toda fila quedaría obligada a tener entidad y el
--    módulo sería inservible hacia atrás, que es justo lo que la migración del
--    17/09 evitó declarándolas nullable.
-- 2. `on delete set null (entidad_id)` — la LISTA DE COLUMNAS es obligatoria
--    aquí, y es PostgreSQL 15+ (medido: el 5433 corre 16.14). Sin ella el
--    `set null` intentaría anular también `tenant_id`, que es NOT NULL, y el
--    borrado de una entidad fallaría con un error de restricción en vez de
--    dejar el documento «sin asignar». La intención del 17/09 se conserva:
--    retirar una razón social no se lleva por delante un contrato ni un
--    comprobante ya emitido. (En la práctica la baja es LÓGICA y nadie borra
--    filas, pero la regla escrita en el esquema es la que aplica el día que
--    alguien lo haga.)
--
-- `entidad_roles` mantiene `on delete cascade`: ahí la fila de rol no tiene
-- sentido sin su entidad, y una cascada compuesta borra la fila entera.
--
-- `entidad_id` NO ES UNA FRONTERA DE SEGURIDAD. La única sigue siendo
-- `tenant_id` con RLS; esto no la sustituye, la respalda por donde la RLS no
-- llega.
--
-- No edita ninguna migración anterior y no toca `db/schema.sql`.
-- Transaccional. Idempotente.
-- ============================================================================
begin;

-- ─── 1. La pareja sobre la que se pueden componer las FK ───────────────────
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'entidades_fiscales_id_tenant_uq'
       and conrelid = 'entidades_fiscales'::regclass
  ) then
    alter table entidades_fiscales
      add constraint entidades_fiscales_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

-- ─── 2. entidad_roles ──────────────────────────────────────────────────────
-- Antes de repuntar hay que limpiar lo que la FK plana pudo haber dejado
-- entrar. En una base sana esto no borra nada; si borra, es una fila que YA
-- estaba cruzada y que la restricción nueva rechazaría — y entonces la
-- migración fallaría al crearla, sin decir cuál era el problema.
delete from entidad_roles r
 where not exists (
   select 1 from entidades_fiscales e
    where e.id = r.entidad_id and e.tenant_id = r.tenant_id
 );

do $$ begin
  if exists (
    select 1 from pg_constraint
     where conname = 'entidad_roles_entidad_id_fkey'
       and conrelid = 'entidad_roles'::regclass
  ) then
    alter table entidad_roles drop constraint entidad_roles_entidad_id_fkey;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'entidad_roles_entidad_tenant_fkey'
       and conrelid = 'entidad_roles'::regclass
  ) then
    alter table entidad_roles
      add constraint entidad_roles_entidad_tenant_fkey
      foreign key (entidad_id, tenant_id)
      references entidades_fiscales (id, tenant_id) on delete cascade;
  end if;
end $$;

-- ─── 3. contratos_arrendamiento.entidad_id ─────────────────────────────────
-- Se pone a NULL —«sin asignar»— en vez de borrar el contrato: la referencia
-- estaba mal, el contrato no.
update contratos_arrendamiento c
   set entidad_id = null
 where c.entidad_id is not null
   and not exists (
     select 1 from entidades_fiscales e
      where e.id = c.entidad_id and e.tenant_id = c.tenant_id
   );

do $$ begin
  if exists (
    select 1 from pg_constraint
     where conname = 'contratos_arrendamiento_entidad_id_fkey'
       and conrelid = 'contratos_arrendamiento'::regclass
  ) then
    alter table contratos_arrendamiento
      drop constraint contratos_arrendamiento_entidad_id_fkey;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'contratos_arrendamiento_entidad_tenant_fkey'
       and conrelid = 'contratos_arrendamiento'::regclass
  ) then
    alter table contratos_arrendamiento
      add constraint contratos_arrendamiento_entidad_tenant_fkey
      foreign key (entidad_id, tenant_id)
      references entidades_fiscales (id, tenant_id)
      on delete set null (entidad_id);
  end if;
end $$;

-- ─── 4. facturas.entidad_emisora_id ────────────────────────────────────────
-- NI UN IMPORTE se toca aquí: `subtotal`, `igv` y `monto` no aparecen en esta
-- migración. Lo único que se corrige es a nombre de quién dice estar emitido.
update facturas f
   set entidad_emisora_id = null
 where f.entidad_emisora_id is not null
   and not exists (
     select 1 from entidades_fiscales e
      where e.id = f.entidad_emisora_id and e.tenant_id = f.tenant_id
   );

do $$ begin
  if exists (
    select 1 from pg_constraint
     where conname = 'facturas_entidad_emisora_id_fkey'
       and conrelid = 'facturas'::regclass
  ) then
    alter table facturas drop constraint facturas_entidad_emisora_id_fkey;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'facturas_entidad_emisora_tenant_fkey'
       and conrelid = 'facturas'::regclass
  ) then
    alter table facturas
      add constraint facturas_entidad_emisora_tenant_fkey
      foreign key (entidad_emisora_id, tenant_id)
      references entidades_fiscales (id, tenant_id)
      on delete set null (entidad_emisora_id);
  end if;
end $$;

-- ─── 5. Índices de apoyo ───────────────────────────────────────────────────
-- La FK compuesta se verifica por la pareja; el índice de una sola columna que
-- dejó el 17/09 no la sirve. Sin estos, borrar o reasignar una entidad obliga a
-- un recorrido completo de cada tabla hija.
create index if not exists idx_entidad_roles_entidad_tenant
  on entidad_roles (entidad_id, tenant_id);
create index if not exists idx_contratos_entidad_tenant
  on contratos_arrendamiento (entidad_id, tenant_id);
create index if not exists idx_facturas_entidad_emisora_tenant
  on facturas (entidad_emisora_id, tenant_id);

-- ─── 6. ASSERT: ninguna de las tres FK queda plana ─────────────────────────
-- Se comprueba DENTRO de la transacción: si algo salió a medias, revierte en
-- vez de dejar la base afirmando que el agujero está cerrado.
do $$
declare planas text;
begin
  select string_agg(conrelid::regclass::text || '.' || conname, ', ') into planas
    from pg_constraint
   where confrelid = 'entidades_fiscales'::regclass
     and contype = 'f'
     and array_length(conkey, 1) < 2;
  if planas is not null then
    raise exception 'Siguen habiendo FK planas hacia entidades_fiscales: %', planas;
  end if;
end $$;

commit;

-- ─── Verificación (debe devolver las TRES, todas con la pareja) ────────────
select conrelid::regclass::text as tabla, conname, pg_get_constraintdef(oid) as definicion
  from pg_constraint
 where confrelid = 'entidades_fiscales'::regclass and contype = 'f'
 order by 1;
