-- ===========================================================================
--  VUELTA ATRAS de 20260909_desbloquear_cambios_padre.sql
--
--  Devuelve `debe_cambiar_password` a `false` para emiliano@asnetwork.io.
--  El valor previo se leyo ANTES de aplicar, no se escribe de memoria:
--
--      email                  | rol   | debe_cambiar_password | tiene_hash
--      emiliano@asnetwork.io  | DUENO | f                     | t
--
--  ── Cuando usarlo ─────────────────────────────────────────────────────────
--  Si tras aplicar el cambio la excepcion del ADR 0018 NO deja fijar la
--  contrasena (por ejemplo, si la sesion no se abrio con Google y no se puede
--  reabrir una que si). Con la bandera puesta, `exigir()` corta las rutas con
--  modulo, asi que dejarla puesta sin poder resolverla deja al usuario a medias.
--
--  ── Ojo ───────────────────────────────────────────────────────────────────
--  Esto NO hace falta si la contrasena ya se fijo: al guardarla, la bandera se
--  apaga sola (`usuarios-repo.ts:159-166`). Correr esto DESPUES de haberla
--  fijado no rompe nada -- ya esta en `false`-- pero no hace nada tampoco.
-- ===========================================================================
\set ON_ERROR_STOP on

begin;

select email, debe_cambiar_password
  from usuarios
 where lower(email) = 'emiliano@asnetwork.io';

update usuarios
   set debe_cambiar_password = false
 where lower(email) = 'emiliano@asnetwork.io';

do $$
declare n int;
begin
  select count(*) into n from usuarios
   where lower(email) = 'emiliano@asnetwork.io' and debe_cambiar_password = false;
  if n <> 1 then raise exception 'Se esperaba 1 fila y hay %', n; end if;
  raise notice 'Vuelta atras OK · la bandera vuelve a estar en false.';
end $$;

commit;
