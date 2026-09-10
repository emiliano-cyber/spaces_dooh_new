-- ===========================================================================
--  Reabrir la excepcion del ADR 0018 para emiliano@asnetwork.io en el PADRE
--  2026-09-09 · base `spaces_prod` de 137.184.107.53
--
--  ── El problema ───────────────────────────────────────────────────────────
--  El control de cambios (ADR 0009, y punto 4 del ADR 0028) pide teclear la
--  contrasena PROPIA para cualquier cambio sensible -- tres de las ocho rutas
--  que protege mueven dinero. Esta encendido en `rgb` desde el 28/08
--  (`exigir_reautenticacion = t`), y la contrasena se perdio.
--
--  No hay red de seguridad por correo: el correo saliente del PADRE no existe
--  (ADR 0028, seccion Contexto).
--
--  ── Por que ESTA fila y no otra cosa ──────────────────────────────────────
--  El ADR 0018 permite fijar la PRIMERA contrasena sin teclear la anterior,
--  bajo cuatro condiciones a la vez (`perfil-controller.ts:49-58`). Tres ya se
--  cumplen: la sesion se abre con Google, la identidad esta vinculada desde el
--  25/08, y no se cambia el correo. La que falta es `debe_cambiar_password`.
--
--  Poniendola en `true` se reabre esa puerta, y NADA MAS:
--    · no se fija ninguna contrasena -- la pone la persona, y no la ve nadie;
--    · no se apaga ningun control: `exigir_reautenticacion` se queda en `t`;
--    · no se toca a los otros dos usuarios;
--    · la bandera se apaga SOLA al guardar la contrasena nueva
--      (`usuarios-repo.ts:159-166`), asi que el estado es transitorio.
--
--  ── Y por que no encerraria a nadie ───────────────────────────────────────
--  Con la bandera puesta, `exigir()` corta TODAS las rutas con modulo
--  (`auth.ts:204-209`). La salida esta escrita en el propio codigo: `/api/auth/me`
--  y `/api/perfil` resuelven con `usuarioActual()` y no pasan por ese guard
--  (`auth.ts:198-203`), asi que la pantalla donde se cambia la contrasena sigue
--  alcanzable. Comprobado antes de escribir esto, no supuesto.
--
--  ── Alcance ───────────────────────────────────────────────────────────────
--  Acotado por correo Y por el valor previo, como el precedente del 25/08. El
--  correo es de unicidad GLOBAL en este esquema (`auth_email_existe`,
--  `20260720_hard1_usuarios_rls.sql`), asi que identifica una sola fila. El
--  guard aborta si no toca exactamente 1.
--
--  ── Pasada en seco ────────────────────────────────────────────────────────
--  Cambia `commit` por `rollback` al final y comprueba que diga UPDATE 1.
-- ===========================================================================
\set ON_ERROR_STOP on

begin;

-- Estado previo, a la vista antes de tocar nada.
select email, rol, debe_cambiar_password, (password_hash is not null) as tiene_hash
  from usuarios
 where lower(email) = 'emiliano@asnetwork.io';

update usuarios
   set debe_cambiar_password = true
 where lower(email) = 'emiliano@asnetwork.io'
   and debe_cambiar_password = false;

-- Guard: exactamente una fila, o no se guarda nada.
do $$
declare n int;
begin
  select count(*) into n
    from usuarios
   where lower(email) = 'emiliano@asnetwork.io'
     and debe_cambiar_password = true;
  if n <> 1 then
    raise exception 'Se esperaba 1 fila con la bandera puesta y hay %', n;
  end if;

  -- Y que los otros dos no se movieron.
  select count(*) into n
    from usuarios
   where lower(email) <> 'emiliano@asnetwork.io'
     and debe_cambiar_password = true;
  if n <> 0 then
    raise exception '% usuarios AJENOS quedaron con la bandera puesta', n;
  end if;

  raise notice 'OK · solo emiliano@asnetwork.io queda con la bandera. Ahora: entrar CON GOOGLE y fijar la contrasena en el perfil.';
end $$;

commit;
