-- ============================================================================
--  Cada instancia elige si toma la version nueva. ADR 0037.
-- ----------------------------------------------------------------------------
--  UNA SOLA FILA, y sin `tenant_id`: esto describe el DROPLET, no una
--  organizacion de dentro. Es hermana de `schema_migrations`, no de
--  `config_negocio` --que es una fila por tenant desde el ADR 0011--.
--
--  DOS ESCRITORES CON PAPELES DISTINTOS, y la separacion la impone la base y
--  no la buena voluntad del codigo:
--    · el ACTUALIZADOR (rol privilegiado, el de las migraciones) escribe lo
--      que hay disponible;
--    · la APLICACION (`spaces_app`) escribe solo lo que decide el dueno.
--  Si la app pudiera escribir `digest_disponible`, podria aprobarse a si misma
--  una imagen que nadie publico. De ahi el `grant update (...)` por columna.
--
--  `obligatoria` nace y se queda SIN ESCRITOR a proposito: es el hueco para un
--  parche de seguridad que se salte la espera. Si esa politica existira, y
--  quien la decide, es cuestion de negocio y el ADR 0037 la deja abierta.
--  Anadir la columna ahora cuesta nada; retrofitearla despues, no.
--
--  EL `revoke all` ANTES del `grant` por columna NO es paranoia: es necesario.
--  `20260824_grants_tablas_futuras.sql` fija privilegios POR OMISION para el
--  propietario que corre las migraciones, y esos alcanzan a CUALQUIER tabla
--  nueva que ese propietario cree -esta incluida-, con select+insert+update
--  +delete de TABLA COMPLETA. Un privilegio de tabla completo gana siempre a
--  uno por columna (asi lo define Postgres: el GRANT por columna solo importa
--  cuando no hay uno de tabla que ya lo cubra), asi que sin el `revoke`
--  `spaces_app` seguiria pudiendo escribir `digest_disponible` pese al `grant
--  update (...)` de abajo. Se detecto con la propia prueba de este ADR: pasaba
--  en verde por el motivo equivocado hasta que se anadio.
-- ============================================================================
begin;

create table if not exists actualizaciones_instancia (
  -- Clave primaria booleana con `check (id)`: la unica fila posible es `true`.
  id boolean primary key default true constraint actualizaciones_instancia_una_fila check (id),

  -- ── Lo que decide el dueno (lo escribe la app) ──────────────────────────
  modo text not null default 'aprobacion'
    constraint actualizaciones_instancia_modo_ck check (modo in ('automatica', 'aprobacion')),
  aprobado_digest text,
  aprobado_por uuid references usuarios(id),
  aprobado_en timestamptz,

  -- ── Lo que ve el actualizador (lo escribe update.sh) ────────────────────
  version_instalada text,
  digest_instalado text,
  version_disponible text,
  digest_disponible text,
  migraciones_pendientes integer,
  comprobado_en timestamptz,

  -- Sin escritor todavia. Ver la cabecera.
  obligatoria boolean not null default false,

  actualizado_en timestamptz not null default now()
);

-- `aprobacion` por omision: una instancia nueva no se actualiza sin que alguien
-- diga que si. Decision del dueno del producto (ADR 0037).
insert into actualizaciones_instancia (id) values (true) on conflict (id) do nothing;

-- Los GRANT, sobre los roles que EXISTAN. Se enumeran candidatos porque una
-- instancia nueva trae `spaces_app` y el droplet viejo traia `spaces_user`;
-- es el mismo idioma que `20260820_grants_rol_app.sql`.
do $$
declare
  candidatos text[] := array['spaces_app', 'spaces_user'];
  r text;
begin
  foreach r in array candidatos loop
    if exists (select 1 from pg_roles where rolname = r) then
      -- Limpia lo que dejo el privilegio por omision (ver cabecera) para que
      -- el grant de abajo sea el que de verdad manda.
      execute format('revoke all on actualizaciones_instancia from %I', r);
      execute format('grant select on actualizaciones_instancia to %I', r);
      -- Por COLUMNA. Lo que no esta aqui, la app no lo puede escribir.
      execute format(
        'grant update (modo, aprobado_digest, aprobado_por, aprobado_en, actualizado_en) '
        'on actualizaciones_instancia to %I', r);
    end if;
  end loop;
end $$;

commit;
