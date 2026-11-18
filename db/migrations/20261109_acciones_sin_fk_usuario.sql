-- @tipo: esquema
-- ============================================================================
--  LA BITÁCORA DEJA DE COLGAR DE `usuarios` — para poder eliminar usuarios.
-- ----------------------------------------------------------------------------
--  APROBADA POR EL DUEÑO EL 2026-11-09, como tarea ROJA (R3, migración; R5,
--  borrado). Contexto: el botón «Eliminar» de Administración, con borrado REAL
--  para cualquiera, tenga o no historial.
--
--  EL FALLO QUE LA MOTIVA. `acciones.usuario_id` nació (schema.sql) con
--  `references usuarios(id) on delete set null`. Y `acciones` es append-only:
--  `20260629_bitacora_append_only.sql` rechaza todo UPDATE y DELETE por trigger,
--  incluso del superusuario. Las dos reglas son incompatibles: al borrar un
--  usuario, el `set null` es un UPDATE sobre sus filas de bitácora, el trigger
--  lo rechaza con `restrict_violation` y el DELETE entero cae en 500. O sea:
--  **solo se podía borrar a quien nunca hizo nada** — casi nadie real. Pasaba
--  desde junio con `DELETE /api/usuarios/:id`; no se vio porque no había botón.
--  Lo encontró la e2e `borrar-usuario.e2e.test.ts` (prueba 3).
--
--  POR QUÉ QUITAR LA FK Y NO ABRIR EL TRIGGER. La alternativa —dejar pasar el
--  UPDATE que pone `usuario_id` a null— agujerea la única garantía que hace
--  valer a la bitácora. Quitando la FK la bitácora NO se toca: cada fila conserva
--  el id y el `usuario_nombre` congelado de quien lo hizo, y el trigger queda
--  intacto. El id puede quedar apuntando a un usuario que ya no existe: es lo
--  correcto en un registro histórico (dice quién FUE, no quién ES).
--
--  Lo que se pierde es que la base impida escribir en la bitácora un id
--  inventado. Quien escribe es `registrarAccion()` con el id de la sesión, así
--  que no cambia nada en la práctica.
--
--  Idempotente: busca la FK por lo que es (de `acciones.usuario_id` a
--  `usuarios`), no por su nombre, y no hace nada si ya no está.
-- ============================================================================

begin;

do $$
declare
  r record;
begin
  for r in
    select c.conname
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f'
       and c.conrelid = 'public.acciones'::regclass
       and c.confrelid = 'public.usuarios'::regclass
       and a.attname = 'usuario_id'
  loop
    execute format('alter table public.acciones drop constraint %I', r.conname);
  end loop;
end
$$;

commit;
