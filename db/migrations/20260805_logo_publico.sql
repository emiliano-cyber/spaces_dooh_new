-- ============================================================================
-- El logo de la organización, servible por una URL pública.
--
-- POR QUÉ HACE FALTA, que no es obvio: el logo se guarda como DATA URL en
-- `config_negocio.logo_url` (base64 embebido, hasta 2 MB). Para el menú lateral
-- y para el contrato imprimible eso funciona — el navegador decodifica un
-- `data:` sin problema. Para el CORREO no: Gmail y la mayoría de clientes NO
-- renderizan imágenes embebidas en base64, las descartan. Un `<img>` con data
-- URL en un correo se ve como un hueco.
--
-- Así que para que el logo salga en los avisos hace falta una URL http de
-- verdad. Esta columna es la llave de esa URL: `/api/logo/<token>` resuelve el
-- tenant por token, lee su `logo_url` y devuelve los BYTES ya decodificados.
-- El almacenamiento no cambia (sigue siendo el data URL en la base): lo que se
-- añade es una forma de servirlo.
--
-- POR QUÉ UN TOKEN Y NO EL `tenant_id` EN LA URL: `/api/logo/<uuid>` sería
-- enumerable, y responder 200 o 404 según el uuid convierte la ruta en un
-- oráculo para averiguar qué tenants existen. El repo ya evita exactamente eso
-- en la liga pública de propuestas («SOLO por token aleatorio, no por id/folio
-- enumerable», S1-3). Mismo criterio aquí.
--
-- La función es SECURITY DEFINER por el mismo motivo que
-- `propuesta_tenant_por_token`: la ruta es PÚBLICA, no hay sesión, y desde el
-- ADR 0011 `config_negocio` es fail-closed + FORCE. Sin sesión, una lectura
-- normal devuelve CERO filas — que es literalmente el defecto que costó dos
-- despliegues en el desbloqueo de contraseña (43f9284). Devuelve el tenant y
-- nada más: los datos se leen después con `qConTenant`, bajo la RLS.
--
-- Transaccional. Idempotente.
-- ============================================================================
begin;

-- El DEFAULT importa: `obtenerConfigRow()` crea la fila de una organización
-- nueva con los defaults de la tabla, así que con esto nace ya con su token y
-- no hay un segundo camino que mantener en la app.
alter table config_negocio
  add column if not exists logo_token text
  default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- Las filas que ya existían nacieron antes del DEFAULT y lo tienen en null.
update config_negocio
   set logo_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
 where logo_token is null;

alter table config_negocio alter column logo_token set not null;

-- Único: el token ES la identificación en la ruta pública. Dos filas con el
-- mismo token harían que el `limit 1` de la función eligiera una al azar.
create unique index if not exists config_negocio_logo_token_uidx
  on config_negocio (logo_token);

-- El token viaja DENTRO de una URL y esa URL se interpola en el HTML de un
-- correo. Acotarlo a alfanuméricos evita de raíz que una comilla o un `<`
-- puedan cerrar el atributo `src` — el escapado de la plantilla es la otra
-- capa, y ninguna de las dos debería ser la única. El mínimo de 32 es contra
-- un token corto puesto a mano, que sería adivinable por fuerza bruta.
alter table config_negocio drop constraint if exists config_negocio_logo_token_ck;
alter table config_negocio add constraint config_negocio_logo_token_ck
  check (logo_token ~ '^[A-Za-z0-9_-]{32,128}$');

comment on column config_negocio.logo_token is
  'Llave no enumerable de /api/logo/<token>, que sirve el logo como imagen para '
  'los correos (los clientes de correo no renderizan data URLs).';

-- ─── Resolver el tenant por token, sin sesión ───────────────────────────────
create or replace function config_tenant_por_logo_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id from config_negocio
   where logo_token = p_token
   limit 1;
$$;

do $$
declare
  r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function config_tenant_por_logo_token(text) to %I', r);
    end if;
  end loop;
end $$;

revoke execute on function config_tenant_por_logo_token(text) from public;

commit;

-- ─── Verificación ───────────────────────────────────────────────────────────
select 'filas sin token (debe ser 0)', count(*)::text
  from config_negocio where logo_token is null
union all
select 'tokens distintos = filas', (count(distinct logo_token) = count(*))::text
  from config_negocio
union all
select 'función existe', count(*)::text
  from pg_proc where proname = 'config_tenant_por_logo_token';

-- ─── ROLLBACK ───────────────────────────────────────────────────────────────
-- begin;
--   drop function if exists config_tenant_por_logo_token(text);
--   drop index if exists config_negocio_logo_token_uidx;
--   alter table config_negocio drop column if exists logo_token;
-- commit;
