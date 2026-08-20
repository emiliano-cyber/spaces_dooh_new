-- ============================================================================
--  Los GRANT del rol de aplicación dejan de depender de una lista blanca.
-- ----------------------------------------------------------------------------
--  MEDIDO el 2026-08-20 (ROJO-3 del re-ensayo de la Fase 4):
--
--    · `20260715_arr_m6_rol_restringido.sql:21` concede a `spaces_app` y `:38`
--      a `spaces_user`, los dos guardados por EXISTENCIA del rol;
--    · otras once migraciones repiten el patrón con
--      `foreach r in array array['spaces_user','spaces_app']`;
--    · trece archivos de `db/migrations/` nombran el rol.
--
--  El modo de fallo no da error: si el rol NO existía cuando la migración
--  corrió, el bloque entero es un no-op, el runner registra la migración como
--  aplicada y NO vuelve a intentarlo nunca. El rol se crea después y queda sin
--  un solo permiso. La aplicación conecta y cada consulta muere con
--  `permission denied` — ruidoso para la instancia, silencioso para el alta que
--  lo causó. Con un nombre fuera de la lista, lo mismo desde el minuto cero.
--
--  Esta migración es la ÚNICA que repara una instancia ya nacida, porque viaja
--  con el código y se aplica al actualizarse. Es la vía B de la decisión del
--  2026-08-20; la vía A es el candado de `scripts/migrar.mjs`, que se niega a
--  aplicar nada si no hay rol. Las dos porque protegen momentos distintos: el
--  candado, el alta; ésta, todas las actualizaciones posteriores.
--
--  ─── El nombre lo elige cada instancia, y se DECLARA ───────────────────────
--
--  Decisión del 2026-08-20: **las instancias deben poder abrirse con otros
--  nombres**, y producción se queda como está (`spaces_user`). Así que el nombre
--  no se cablea: se **declara** en `space_os.rol_app`. Lo fija el runner desde
--  `ROL_APP` antes de aplicar nada (`scripts/migrar.mjs`), y un `psql -f` puede
--  fijarlo con `PGOPTIONS="-c space_os.rol_app=<nombre>"`.
--
--  Declararlo es **EXCLUYENTE**: si dices cómo se llama, es ése y no otro. Dejar
--  los históricos debajo como red sería volver al no-op silencioso por otra
--  puerta — una instancia mal declarada acabaría funcionando por casualidad y
--  nadie se enteraría de que el nombre estaba mal.
--
--  **Sin declaración**, los candidatos son los DOS nombres que ya nombran las
--  trece migraciones históricas. Eso es lo que permite que el droplet actual
--  —que corre como `spaces_user`— se actualice **sin cambiarle el rol y sin
--  preparar nada**.
--
--  Lo que cierra el agujero **no es el nombre**: es que esta migración **ABORTE**
--  cuando no encuentra rol, en vez de no conceder nada en silencio. Ese guard
--  vale para cualquier nombre.
--
--  ⚠️ LÍMITE MEDIDO EL 2026-08-20, y es el motivo de que `spaces_app` siga siendo
--  el nombre por omisión de una instancia nueva: **una base VIRGEN cuyo rol tenga
--  un nombre nuevo NO llega hasta aquí.** La cadena aborta antes, en
--  `20260729_licencias_permisos.sql:88-97`, que deriva el rol de «quién tiene
--  grants sobre `contratos_arrendamiento`» — y con un nombre fuera de la lista
--  blanca de `arr_m6` nadie se los concedió, así que encuentra cero y hace
--  `raise`. Reproducido de punta a punta contra un Postgres desechable con el rol
--  `pixeled_app`: **aborta en el archivo 52 de 70 y deja 33 tablas**.
--
--  O sea que `ROL_APP` sirve hoy para **renombrar una instancia ya migrada**, no
--  para **parir una con nombre propio**. Hacer lo segundo exige tocar
--  `licencias_permisos` (zona R3) o reordenar la cadena, y ninguna de las dos se
--  hace de refilón. El fallo, al menos, es **ruidoso**: aborta y nombra el
--  archivo, no se aplica a medias en silencio.
--
--  Las trece originales siguen sin tocarse —son zona R3, ya aplicadas— y no hace
--  falta: ésta concede lo mismo, sin lista blanca.
--
--  ─── Lo que esto NO hace, a propósito ─────────────────────────────────────
--
--  · NO crea el rol. Crear credenciales es provisión de entorno, no migración:
--    el .sql viaja en el repo y se aplica en todos lados. Mismo criterio, y por
--    el mismo motivo, que `20260715_arr_m6_rol_restringido.sql:7-11`.
--  · NO le da `BYPASSRLS` ni `SUPERUSER`. El rol de la app RESPETA la RLS: es
--    el invariante R2 y una migración de GRANT es exactamente donde se colaría.
--  · NO renombra nada. El droplet actual corre como `spaces_user` y se queda
--    así: sin declaración es uno de los dos candidatos y recibe los GRANT igual.
--    De hecho GANA los que no tenía — `arr_m6` solo le dio DML sobre seis tablas.
--
--  Idempotente: solo `grant`, ni un `revoke`. Aplicarla dos veces no cambia una
--  sola fila de `information_schema.role_table_grants`.
-- ============================================================================

begin;

do $$
declare
  declarado  text   := nullif(btrim(coalesce(current_setting('space_os.rol_app', true), '')), '');
  candidatos text[] := case when declarado is not null
                            then array[declarado]
                            else array['spaces_app', 'spaces_user'] end;
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
  -- bueno. Trece migraciones lo hacen así hoy, guardadas por existencia.
  if encontrados = 0 then
    raise exception using message =
      'No existe ninguno de los roles de aplicacion candidatos (' ||
      array_to_string(candidatos, ', ') ||
      '). Esta migracion concede sus permisos, y sin rol no concederia nada en silencio. ' ||
      'Crea el rol antes de repetir (la plantilla de la instruccion es db/dev-rol-app.sql; ' ||
      'en una instancia real la contrasena es propia de ella): ' ||
      'create role <nombre> login password ''<clave propia>'' nosuperuser nobypassrls; ' ||
      'Si tu instancia usa otro nombre, declaralo con ROL_APP en el runner o con ' ||
      'PGOPTIONS="-c space_os.rol_app=<nombre>".';
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
 where rolname in ('spaces_app', 'spaces_user',
                   nullif(btrim(coalesce(current_setting('space_os.rol_app', true), '')), ''))
 order by rolname;

select grantee, count(*) as tablas_con_select
  from information_schema.role_table_grants
 where privilege_type = 'SELECT'
   and grantee in ('spaces_app', 'spaces_user',
                   nullif(btrim(coalesce(current_setting('space_os.rol_app', true), '')), ''))
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
