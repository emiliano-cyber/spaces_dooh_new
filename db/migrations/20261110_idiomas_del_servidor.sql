-- ============================================================================
--  Los idiomas que ofrece CADA SERVIDOR, elegidos con un boton desde
--  Administracion. IDIOMAS-SERVIDOR, 2026-11-10.
-- ----------------------------------------------------------------------------
--  Pedido del dueno: «ayudame a cambiar con el boton» y «el boton de idioma
--  directamente a main para subirlo ya». Hasta hoy los idiomas solo se
--  encendian con `IDIOMA_INGLES=1` (y hermanas) en `app.env`, o sea entrando
--  por ssh y recreando el contenedor; la DEMO v0.12.8 salio sin ninguno y el
--  selector de idioma no aparecia en ningun sitio.
--
--  UNA SOLA FILA y sin `tenant_id`, hermana de `actualizaciones_instancia`:
--  describe el SERVIDOR, no una organizacion. La pantalla de entrar ya tiene
--  que ofrecer sus idiomas, y ahi todavia no se sabe de que organizacion es
--  nadie. Sin RLS por lo mismo; se lee con `qRaw`.
--
--  Se llama `apariencia_instancia` y no `idiomas_instancia` a proposito: la
--  paleta de colores por servidor (rama `feat/apariencia-e-idiomas`, aparcada
--  el 10/11) anadira sus columnas AQUI con una migracion propia, en vez de
--  abrir otra tabla de una fila.
--
--  `idiomas` NULL significa «lo que digan las variables del servidor»: una
--  instancia que no toque esta pantalla se queda EXACTAMENTE como hoy. El
--  espanol va siempre (es el idioma al que cae todo lo que falta).
--
--  GRANT por columna con el `revoke all` antes, por la razon que explica
--  `20260921_actualizaciones_instancia.sql`: los privilegios por omision de
--  `20260824_grants_tablas_futuras.sql` darian a la app la tabla entera, y la
--  app no debe poder borrar la fila (la instancia se quedaria sin donde
--  guardar su eleccion) ni escribir `id`.
-- ============================================================================
begin;

create table if not exists apariencia_instancia (
  id boolean primary key default true constraint apariencia_instancia_una_fila check (id),

  idiomas text[]
    constraint apariencia_instancia_idiomas_ck check (
      idiomas is null
      or (idiomas <@ array['es', 'en', 'it', 'pt']::text[] and 'es' = any (idiomas))
    ),

  -- `set null` y no `no action`: sin clausula, quien eligio los idiomas ya no
  -- podria darse de baja (el defecto que cazo `actualizaciones_instancia`).
  actualizado_por uuid references usuarios(id) on delete set null,
  actualizado_en timestamptz not null default now()
);

insert into apariencia_instancia (id) values (true) on conflict (id) do nothing;

do $$
declare
  candidatos text[] := array['spaces_app', 'spaces_user'];
  r text;
begin
  foreach r in array candidatos loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on apariencia_instancia from %I', r);
      execute format('grant select on apariencia_instancia to %I', r);
      execute format(
        'grant update (idiomas, actualizado_por, actualizado_en) on apariencia_instancia to %I', r);
    end if;
  end loop;
end $$;

commit;
