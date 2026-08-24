-- ============================================================================
--  Los GRANT de la app alcanzan a las tablas que crea CUALQUIER rol.
-- ----------------------------------------------------------------------------
--  Cierra el hallazgo **H1** de la auditoría del 2026-08-24
--  ([[auditoria-cuatro-rojo-20260820]]).
--
--  `20260820_grants_rol_app.sql:87-88` escribe `alter default privileges` **sin
--  `for role`**, y en PostgreSQL omitirlo significa *«para los objetos que cree
--  el rol actual»*: los privilegios por omisión se guardan por la pareja
--  (rol propietario, esquema), no globalmente. Su comentario, en cambio, promete
--  cubrir «las que se creen DESPUÉS».
--
--  La promesa era más ancha que la garantía. **Medido**, no supuesto: en
--  `apps/web/lib/test/grants-tablas-futuras.e2e.test.ts`, una tabla creada por un
--  segundo rol tras aplicar aquella migración queda **sin SELECT ni INSERT** para
--  `spaces_app`, y ni la migración ni el runner dan error — el modo de fallo
--  exacto que la migración del 20/08 existía para cerrar.
--
--  ─── Por qué una migración NUEVA y no un arreglo de aquélla ───────────────
--
--  `20260820_grants_rol_app.sql` **ya se aplicó** —el droplet PADRE corrió la
--  cadena entera el 21/08— así que editarla es zona **R3**, y además cambiaría su
--  checksum: `scripts/migrar.mjs` (F3.3) detendría la actualización con **salida
--  3** en toda instancia que ya la tenga. Una migración nueva, aditiva e
--  idempotente, repara igual y no rompe a nadie.
--
--  ─── Lo que esto SÍ garantiza, y lo que NO ────────────────────────────────
--
--  No se puede cubrir «cualquier rol futuro» con `alter default privileges`:
--  habría que enumerar roles que todavía no existen. Así que la garantía se
--  mueve a donde sí es verificable, y son tres cosas distintas:
--
--    1. **REPARA** — `grant on all tables` en cada pasada. Una tabla huérfana no
--       sobrevive a la siguiente actualización, la creara quien la creara.
--    2. **ASEGURA hacia adelante** para los roles que hoy crean tablas, y esos
--       se **DERIVAN de `pg_tables`**, no se cablean: el mismo criterio que usa
--       `migrar.mjs` para sus tablas testigo.
--    3. **ABORTA nombrando las tablas** si algo se queda fuera, en vez de
--       tragárselo. Esto es lo que convierte un fallo mudo en uno ruidoso.
--
--  **El límite que queda, dicho en voz alta:** una tabla creada por un rol nuevo
--  ENTRE dos pasadas está sin permisos hasta la siguiente. Eso ya no es
--  silencioso —la aplicación da `permission denied` y la pasada siguiente lo
--  repara— pero no es cero. Cerrarlo del todo pediría un `event trigger` sobre
--  `ddl_command_end`, que es maquinaria que corre en CADA DDL: no se mete a
--  cambio de este riesgo sin una decisión aparte.
--
--  ─── Lo que NO hace, igual que su hermana ─────────────────────────────────
--
--  · NO crea roles ni toca contraseñas: eso es provisión de entorno.
--  · NO da `BYPASSRLS` ni `SUPERUSER`. Invariante R2, y se comprueba abajo.
--  · NO renombra nada.
--
--  ⚠️ **Hallazgo H2, abierto a propósito:** el `grant on all tables` incluye
--  `schema_migrations`, que es ajena a la RLS a conciencia. Estrecharlo es una
--  decisión de menor privilegio que no se toma aquí; cuando se tome, hay que
--  cambiar esta migración y la del 20/08 a la vez, porque las dos conceden igual.
-- ============================================================================

begin;

do $$
declare
  candidatos text[] := array['spaces_app', 'spaces_user'];
  r            text;
  propietario  text;
  encontrados  int := 0;
  saltados     text[] := '{}';
  fuera        text;
begin
  -- ─── 1. Reparar: conceder sobre TODO lo que ya existe ───────────────────
  foreach r in array candidatos loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant usage on schema public to %I', r);
      execute format('grant select, insert, update, delete on all tables in schema public to %I', r);
      execute format('grant usage, select on all sequences in schema public to %I', r);
      encontrados := encontrados + 1;
    end if;
  end loop;

  -- ─── 2. Fail-closed, igual que la del 20/08 ─────────────────────────────
  if encontrados = 0 then
    raise exception using message =
      'No existe ninguno de los roles de aplicacion (' ||
      array_to_string(candidatos, ', ') ||
      '). Esta migracion concede sus permisos, y sin rol no concederia nada en silencio. ' ||
      'Crea el rol antes de repetir: ' ||
      'create role spaces_app login password ''<clave propia>'' nosuperuser nobypassrls;';
  end if;

  -- ─── 3. Asegurar hacia adelante, por PROPIETARIO REAL ───────────────────
  --
  -- Los propietarios se DERIVAN de las tablas que ya existen: son, por
  -- definicion, los roles que crean tablas en este esquema. Se incluye
  -- `current_user` aunque todavia no tenga ninguna, porque es quien esta
  -- aplicando esta cadena y creara las de las migraciones siguientes.
  for propietario in
    select tableowner from pg_tables where schemaname = 'public'
    union
    select current_user
  loop
    -- `alter default privileges for role X` exige ser X o miembro suyo. Si no
    -- se puede, se ANOTA y se sigue: negarse aqui dejaria sin aplicar la
    -- reparacion del paso 1, que es la que de verdad arregla instancias.
    if not pg_has_role(current_user, propietario, 'USAGE') then
      saltados := saltados || propietario;
      continue;
    end if;

    foreach r in array candidatos loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format(
          'alter default privileges for role %I in schema public grant select, insert, update, delete on tables to %I',
          propietario, r);
        execute format(
          'alter default privileges for role %I in schema public grant usage, select on sequences to %I',
          propietario, r);
      end if;
    end loop;
  end loop;

  if array_length(saltados, 1) is not null then
    raise notice
      'Sin privilegio para fijar los permisos por omision de: %. Las tablas que cree ese rol se repararan en la siguiente pasada, no antes.',
      array_to_string(saltados, ', ');
  end if;

  -- ─── 4. ASSERT: no queda NINGUNA tabla fuera del alcance de la app ──────
  --
  -- Esto es lo que convierte el fallo mudo en ruidoso. Si una tabla se escapa,
  -- la migracion aborta y la NOMBRA, en vez de registrarse como aplicada.
  foreach r in array candidatos loop
    if not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;

    select string_agg(t.tablename, ', ' order by t.tablename)
      into fuera
      from pg_tables t
     where t.schemaname = 'public'
       and not has_table_privilege(
             r, format('%I.%I', t.schemaname, t.tablename), 'select');

    if fuera is not null then
      raise exception '% se quedo sin SELECT sobre: %', r, fuera;
    end if;

    -- El invariante R2, repetido a proposito: una migracion de GRANT es
    -- exactamente donde alguien «arreglaria» un permission denied rompiendo el
    -- aislamiento entre organizaciones, y sin dar un error.
    if exists (select 1 from pg_roles where rolname = r and (rolbypassrls or rolsuper)) then
      raise exception '% tiene BYPASSRLS o SUPERUSER: la RLS dejaria de aislar', r;
    end if;
  end loop;
end $$;

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
select defaclrole::regrole as propietario,
       defaclnamespace::regnamespace as esquema,
       defaclacl
  from pg_default_acl
 order by 1;

select count(*) as tablas_fuera_del_alcance
  from pg_tables t
 where t.schemaname = 'public'
   and exists (select 1 from pg_roles where rolname = 'spaces_app')
   and not has_table_privilege('spaces_app', format('%I.%I', t.schemaname, t.tablename), 'select');

-- ─── ROLLBACK ──────────────────────────────────────────────────────────────
-- ⚠️ Deshacerlo deja a la aplicación sin poder leer su propia base.
-- Por cada propietario que aparezca en la primera consulta de verificación:
--
--   alter default privileges for role <propietario> in schema public
--     revoke select, insert, update, delete on tables from <rol de la app>;
--   alter default privileges for role <propietario> in schema public
--     revoke usage, select on sequences from <rol de la app>;
