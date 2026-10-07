-- @tipo: esquema
-- ============================================================================
--  CONTRATO-CAMBIOS · EL HISTORIAL SOLO SE AGREGA, TAMBIÉN EN LOS PERMISOS.
-- ----------------------------------------------------------------------------
--  `20261010_contrato_cambios.sql` dice que la aplicación «solo tiene select e
--  insert» sobre `contrato_cambios`, y lo intenta con un `grant select, insert`.
--  ERA FALSO: `20260824_grants_tablas_futuras.sql` fija privilegios POR OMISIÓN
--  para el propietario que corre las migraciones, y alcanzan a CUALQUIER tabla
--  nueva que cree —ésta incluida— con select, insert, update y delete. Un
--  `grant` explícito no quita lo que ya dio el privilegio por omisión; hay que
--  quitarlo con `revoke`. Es el mismo tropiezo que documenta
--  `20260921_actualizaciones_instancia.sql`, y lo cazó la misma clase de prueba
--  (`has_table_privilege`) antes de que la migración saliera en una versión.
--
--  Por qué importa: el historial es la memoria de una negociación de dinero.
--  Con `update` y `delete`, un fallo en el servidor web —no en la base— bastaba
--  para reescribir o borrar quién propuso qué. Sin ellos, Postgres lo rechaza
--  (42501) aunque la aplicación lo intentara.
--
--  Va como migración NUEVA y no editando la 20261010: ésa ya está aplicada en
--  bases de desarrollo, y editar una migración aplicada rompe su checksum.
--
--  Lo que NO hace: no toca datos, ni otra tabla, ni el `select`/`insert`. El
--  borrado en cascada desde el contrato no necesita `delete` del rol: lo hace
--  el disparador de la FK.
--
--  Si una migración futura vuelve a conceder en masa (`grant ... on all
--  tables`), tiene que repetir después este `revoke`.
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke update, delete, truncate on contrato_cambios from %I', r);
      execute format('grant select, insert on contrato_cambios to %I', r);
    end if;
  end loop;
end $$;

commit;
