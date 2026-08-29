-- ============================================================================
--  Los GRANT del rol de aplicación dejan de depender de una lista blanca.
-- ----------------------------------------------------------------------------
--  MEDIDO el 2026-08-20 (ROJO-3 del re-ensayo de la Fase 4), y **contado archivo
--  por archivo** en `db/migrations/`, que es lo que hay que hacer antes de
--  escribir una cifra:
--
--    · **13** nombran alguno de los dos roles (`spaces_app`, `spaces_user`);
--    · **11** les CONCEDEN por lista blanca: `20260715_arr_m6_rol_restringido.sql:21`
--      y `:38`, `20260716_doohmain_playlogs.sql:56-62`, y el
--      `foreach r in array array['spaces_user','spaces_app']` de otras **9**;
--    · `20260729_licencias_permisos.sql:88-97` concede por **derivación** —mira
--      quién ya tiene grants sobre `contratos_arrendamiento`— y **aborta** si no
--      encuentra a nadie;
--    · `20260805_config_negocio_por_tenant.sql` **no concede nada**: solo tiene
--      un ASSERT de `BYPASSRLS` en `:94`.
--
--  (Hasta el 20/08 esta cabecera decía «trece conceden» y «otras once» con el
--   foreach. Las dos cifras estaban infladas, y una viajaba en el mensaje que lee
--   el operador. Las corrigió una auditoría contándolas.)
--
--  El modo de fallo de las que conceden por lista no da error: si el rol NO
--  existía cuando la migración corrió, el bloque entero es un no-op, el runner
--  registra la migración como aplicada y NO vuelve a intentarlo nunca. El rol se
--  crea después y queda sin un solo permiso. La aplicación conecta y cada
--  consulta muere con `permission denied` — ruidoso para la instancia,
--  silencioso para el alta que lo causó.
--
--  Esta migración es la ÚNICA que repara una instancia ya nacida, porque viaja
--  con el código y se aplica al actualizarse. Es la vía B de la decisión del
--  2026-08-20; la vía A es el candado de `scripts/migrar.mjs`, que se niega a
--  aplicar nada si no hay rol. Las dos porque protegen momentos distintos: el
--  candado, el alta; ésta, todas las actualizaciones posteriores.
--
--  ─── Los dos nombres, y por qué siguen siendo dos ─────────────────────────
--
--  `spaces_app` (el de una instancia nueva) y `spaces_user` (el del droplet
--  actual, que **no se renombra**, decisión del 2026-08-20). Son los que ya
--  nombran las migraciones históricas, así que producción se actualiza **sin
--  tocarle nada** — y de hecho **gana** los GRANT que no tenía: `arr_m6:40-41`
--  solo le daba DML sobre seis tablas.
--
--  Lo que cierra el agujero **no es el nombre**: es que esta migración **ABORTE**
--  cuando no encuentra ninguno, en vez de no conceder nada en silencio.
--
--  ⚠️ HUBO UN AJUSTE `space_os.rol_app` PARA DECLARAR OTRO NOMBRE, Y SE RETIRÓ
--  EL MISMO DÍA. La intención —que una instancia pueda llamar a su rol como
--  quiera— sigue en pie, pero **la capacidad no existía por ninguna vía**, y una
--  auditoría lo midió: sobre una base **virgen** con nombre nuevo la cadena
--  aborta antes de llegar aquí, en `20260729_licencias_permisos.sql:88-97`
--  —**archivo 52 de 70, 33 tablas**— porque esa migración deriva el rol de quien
--  YA tiene grants; y sobre una base ya migrada el ajuste **no hacía nada y salía
--  con 0**, dejando el rol con cero permisos. Una perilla que no funciona por
--  ningún camino es peor que no tenerla. Para que vuelva hay que arreglar antes
--  `licencias_permisos` (zona R3) o reordenar la cadena.
--
--  ─── Lo que esto NO hace, a propósito ─────────────────────────────────────
--
--  · NO crea el rol. Crear credenciales es provisión de entorno, no migración:
--    el .sql viaja en el repo y se aplica en todos lados. Mismo criterio, y por
--    el mismo motivo, que `20260715_arr_m6_rol_restringido.sql:7-11`.
--  · NO le da `BYPASSRLS` ni `SUPERUSER`. El rol de la app RESPETA la RLS: es
--    el invariante R2 y una migración de GRANT es exactamente donde se colaría.
--  · NO renombra nada.
--
--  Idempotente: solo `grant`, ni un `revoke`. Aplicarla dos veces no cambia una
--  sola fila de `information_schema.role_table_grants`.
-- ============================================================================

begin;

do $$
declare
  candidatos text[] := array['spaces_app', 'spaces_user'];
  r           text;
  encontrados int := 0;
begin
  -- ─── 1. Conceder a los candidatos que existan ────────────────────────────
  foreach r in array candidatos loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant usage on schema public to %I', r);
      execute format('grant select, insert, update, delete on all tables in schema public to %I', r);
      execute format('grant usage, select on all sequences in schema public to %I', r);
      -- Y las que se creen DESPUÉS. Sin esto el arreglo dura una versión: la
      -- próxima migración que cree una tabla vuelve a dejar al rol fuera.
      execute format('alter default privileges in schema public grant select, insert, update, delete on tables to %I', r);
      execute format('alter default privileges in schema public grant usage, select on sequences to %I', r);
      encontrados := encontrados + 1;
    end if;
  end loop;

  -- ─── 2. Fail-closed: si no hay NINGUNO, se aborta ───────────────────────
  -- Esto es lo que cierra ROJO-3, y no el nombre: conceder a un rol ausente no
  -- es un error de Postgres, es una migración que no hizo nada y lo dio por
  -- bueno. Once migraciones lo hacen así hoy, guardadas por existencia.
  if encontrados = 0 then
    raise exception using message =
      'No existe ninguno de los roles de aplicacion (' ||
      array_to_string(candidatos, ', ') ||
      '). Esta migracion concede sus permisos, y sin rol no concederia nada en silencio. ' ||
      'Crea el rol antes de repetir (la plantilla de la instruccion es db/dev-rol-app.sql; ' ||
      'en una instancia real la contrasena es propia de ella): ' ||
      'create role spaces_app login password ''<clave propia>'' nosuperuser nobypassrls; ' ||
      'El nombre tiene que ser uno de los dos: son los que nombran las migraciones. ' ||
      'Lo que cambia de una instancia a otra es la CONTRASENA.';
  end if;

  -- ─── 3. ASSERT: el rol trabaja, y sigue sin poder saltarse la RLS ───────
  foreach r in array candidatos loop
    if not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;
    if not has_schema_privilege(r, 'public', 'usage') then
      raise exception '% se quedo sin USAGE sobre el esquema public', r;
    end if;
    if not has_table_privilege(r, 'tenants', 'select')
       or not has_table_privilege(r, 'tenants', 'insert') then
      raise exception '% se quedo sin DML sobre tenants', r;
    end if;
    -- El invariante R2. Si alguien «arreglara» un permission denied dándole
    -- BYPASSRLS, el aislamiento entre organizaciones desaparecería sin un error.
    if exists (select 1 from pg_roles where rolname = r and (rolbypassrls or rolsuper)) then
      raise exception '% tiene BYPASSRLS o SUPERUSER: la RLS dejaria de aislar', r;
    end if;
  end loop;
end $$;

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
select rolname, rolsuper, rolbypassrls, rolcanlogin
  from pg_roles
 where rolname in ('spaces_app', 'spaces_user')
 order by rolname;

select grantee, count(*) as tablas_con_select
  from information_schema.role_table_grants
 where privilege_type = 'SELECT'
   and grantee in ('spaces_app', 'spaces_user')
 group by grantee
 order by grantee;

-- ─── ROLLBACK ──────────────────────────────────────────────────────────────
-- ⚠️ Deshacer esto deja a la aplicación sin poder leer su propia base.
-- Sustituye <rol> por el rol de aplicación de esa instancia.
--
--   revoke select, insert, update, delete on all tables in schema public from <rol>;
--   revoke usage, select on all sequences in schema public from <rol>;
--   alter default privileges in schema public
--     revoke select, insert, update, delete on tables from <rol>;
--   alter default privileges in schema public
--     revoke usage, select on sequences from <rol>;
