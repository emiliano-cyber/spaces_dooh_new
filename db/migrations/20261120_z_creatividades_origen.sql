-- @tipo: esquema
-- ============================================================================
--  CREA-ORIGEN · QUIÉN SUBIÓ CADA CREATIVO, GUARDADO COMO DATO.
--  Aprobada por el dueño el 2026-11-20 (zona ROJA R3), para ensayo local.
-- ----------------------------------------------------------------------------
--  Decisión del dueño (20/11): «Debemos poner quién subió cada creativo aunque
--  tengan el mismo nombre; lo que importa es el contenido».
--
--  Hasta hoy el origen se DEDUCÍA de la bitácora (FLUJO-CREA, 20/11): era
--  CLIENTE el creativo con la acción «Aprobó creativo enviado por el cliente»
--  con su mismo NOMBRE en los 10 minutos siguientes a su alta. Dos creativos con
--  el mismo nombre en esa ventana se confundían, que es justo lo que el dueño
--  dice que no puede pasar. Desde aquí se guarda al crear:
--
--   · origen             'CLIENTE' (aprobado desde el envío por la liga) o
--                        'INTERNO' (subido por alguien de la organización).
--                        NULL = origen desconocido: lo creado antes de esto.
--   · subido_por         el usuario interno de la SESIÓN (nunca del cuerpo).
--                        NULL en lo del cliente, que no es usuario.
--   · subido_por_nombre  el nombre CONGELADO al subirlo: si la persona cambia
--                        de nombre o se borra, el creativo sigue diciendo quién
--                        fue. En lo del cliente, el nombre que dio en la liga;
--                        la liga hoy no pide nombre, así que queda NULL.
--
--  ═══ POR QUÉ `subido_por` NO LLEVA FK COMPUESTA (id, tenant_id) ═══════════
--  Las tablas nuevas cuelgan de su padre con FK compuesta para no poder apuntar
--  a otra organización (vallas, imprentas, envíos). Aquí no es viable:
--   1. Los usuarios se BORRAN de verdad (`borrarUsuario`, usuarios-repo.ts), y
--      el creativo debe sobrevivir. Con una FK compuesta, `on delete set null`
--      pone a null LAS DOS columnas —también `tenant_id`, que no admite null—
--      y el borrado del usuario fallaría. La forma que lo evita,
--      `set null (subido_por)`, es de PostgreSQL 15 y aquí se exige la 14.
--   2. `on delete restrict` impediría borrar a cualquiera que haya subido un
--      creativo, que cambia una regla de usuarios que nadie pidió cambiar.
--  Queda la FK simple `references usuarios(id) on delete set null`, la misma
--  forma que `tickets.creado_por_usuario` o `almacen.usuario_id`. El riesgo de
--  apuntar a otra organización lo cierra la aplicación: el id sale SIEMPRE de
--  la sesión (`origenInterno(g.usuario)`), y la fila hereda la RLS de la tabla.
--  Y el nombre congelado no depende de la FK.
--
--  ═══ BACKFILL: NINGUNO, A PROPÓSITO ═══════════════════════════════════════
--  Solo se rellenaría lo que se supiera con CERTEZA. No hay nada así:
--   · el envío del cliente se BORRA al aprobarlo (`tomarEnvioPendiente`), así
--     que no existe ningún vínculo creativo ↔ envío en los datos;
--   · la bitácora guarda el NOMBRE del creativo, no su id: es la misma
--     deducción que esta migración viene a sustituir.
--  Todo lo existente queda en NULL y la aplicación lo enseña como «Origen
--  desconocido». Inventarlo sería peor que no saberlo.
--
--  ═══ EL NOMBRE DEL ARCHIVO ════════════════════════════════════════════════
--  `20261120_z_…` y no `20261120_creatividades_…`: el orden es lexicográfico
--  (`ordenar()`, scripts/migrar.mjs) y así va DESPUÉS de las otras tres del
--  20/11 (`impresion_fecha_especial`, `propuestas_marca`, `vallas_esquina`),
--  que ya pueden estar aplicadas en una base local.
--
--  Vuelta atrás:
--    alter table creatividades drop column if exists subido_por_nombre,
--      drop column if exists subido_por, drop column if exists origen;
--  La versión anterior de la app no lee estas columnas.
--
--  PostgreSQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

alter table creatividades add column if not exists origen text;
alter table creatividades add column if not exists subido_por uuid;
alter table creatividades add column if not exists subido_por_nombre text;

do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'creatividades_origen_ck'
                    and conrelid = 'creatividades'::regclass) then
    alter table creatividades add constraint creatividades_origen_ck
      check (origen is null or origen in ('CLIENTE', 'INTERNO'));
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'creatividades_subido_por_fk'
                    and conrelid = 'creatividades'::regclass) then
    alter table creatividades add constraint creatividades_subido_por_fk
      foreign key (subido_por) references usuarios (id) on delete set null;
  end if;
end $$;

comment on column creatividades.origen is
  'Quién subió el contenido: CLIENTE (envío por la liga, aprobado) o INTERNO (alguien de la organización). NULL = origen desconocido, anterior al 20/11 (CREA-ORIGEN).';
comment on column creatividades.subido_por is
  'Usuario interno que subió el contenido, tomado de la sesión. NULL si lo subió el cliente, si es anterior al 20/11 o si el usuario se borró (CREA-ORIGEN).';
comment on column creatividades.subido_por_nombre is
  'Nombre congelado de quien lo subió: el del usuario, o el que dio el cliente en la liga. Sobrevive al cambio de nombre y al borrado del usuario (CREA-ORIGEN).';

commit;

select 'creatividades.origen/subido_por/subido_por_nombre (3)' k, count(*)::text v
  from information_schema.columns
 where table_name = 'creatividades' and column_name in ('origen', 'subido_por', 'subido_por_nombre');
