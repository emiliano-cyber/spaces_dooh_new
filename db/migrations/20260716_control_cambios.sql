-- ============================================================================
-- Control de cambios con desbloqueo.
-- El Dueño trabaja sin fricción. Los demás roles, para los cambios sensibles
-- (dinero y catálogo), tienen que teclear una contraseña que fija el Dueño en
-- Administración; con ella quedan desbloqueados un rato.
--
-- Dos piezas:
--  1. `tenants.cambios_password_hash` — la contraseña del Dueño, en bcrypt (NUNCA
--     en claro). Null = control de cambios APAGADO: nadie nota nada y todo sigue
--     como hoy. Ese es el default: encender esto por sorpresa dejaría al equipo
--     sin poder trabajar.
--  2. `sesiones.desbloqueo_expira_en` — hasta cuándo está desbloqueada ESTA
--     sesión. Vive en el servidor, contra el token de sesión: el cliente solo
--     tiene una cookie opaca, así que no puede fabricarse el desbloqueo. Si
--     estuviera en el navegador (localStorage, cookie propia), cualquiera se lo
--     inventaría y el candado sería decorativo.
-- Aditivo e idempotente.
-- ============================================================================
begin;

alter table tenants   add column if not exists cambios_password_hash text;
alter table sesiones  add column if not exists desbloqueo_expira_en  timestamptz;

comment on column tenants.cambios_password_hash is
  'bcrypt de la contraseña de control de cambios que fija el Dueño. Null = control apagado.';
comment on column sesiones.desbloqueo_expira_en is
  'Hasta cuándo esta sesión puede hacer cambios sensibles sin volver a teclear la contraseña. Se fija en el servidor al desbloquear.';

commit;

-- Verificación
select 'tenants.cambios_password_hash' k, count(*)::text v from information_schema.columns
  where table_name='tenants' and column_name='cambios_password_hash'
union all
select 'sesiones.desbloqueo_expira_en', count(*)::text from information_schema.columns
  where table_name='sesiones' and column_name='desbloqueo_expira_en'
union all
select 'tenants_con_control_activo', count(*)::text from tenants where cambios_password_hash is not null;
