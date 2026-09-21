-- ============================================================================
-- Restaura una contraseña de "control de cambios" asignable por el Dueño,
-- INDEPENDIENTE de la contraseña de acceso de cada quien.
--
-- ── Por qué esto existe otra vez ────────────────────────────────────────────
-- `20260804_reautenticacion_individual.sql` (ADR 0009) retiró
-- `tenants.cambios_password_hash` a propósito: una contraseña compartida no
-- prueba identidad, así que la bitácora afirmaba «Ana facturó» cuando lo único
-- verificado era «alguien que conoce el secreto del equipo facturó».
--
-- Decisión explícita del dueño del producto, 2026-09-21 (ver ADR 0036): para el
-- candado de cambios sensibles (dinero y catálogo) sí se quiere una contraseña
-- asignable, separada del login de cada persona. El propio ADR 0009 dejaba
-- escrito cómo revertir esto en su sección «Cómo revertir»: devolver la
-- columna y fijar una contraseña NUEVA — los hashes viejos no se recuperan,
-- se descartaron a propósito en su momento.
--
-- ── Qué NO cambia, y por qué importa ────────────────────────────────────────
-- `exigirReautenticacionSiempre()` — la que protege restablecer la contraseña
-- de UN TERCERO (`POST /api/usuarios/:id/restablecer`) — sigue exigiendo la
-- contraseña PROPIA de quien actúa. Si la contraseña compartida también abriera
-- esa puerta, cualquiera que la supiera podría resetear la contraseña de otra
-- persona sin probar que es quien dice ser: exactamente el hueco de
-- impersonación que el ADR 0009 cerró (su punto 3). Por eso el desbloqueo
-- guarda TAMBIÉN con qué contraseña se concedió (`sesiones.desbloqueo_es_propio`):
-- solo un desbloqueo con la contraseña PROPIA sirve para tocar el acceso de
-- otra persona.
--
-- ── Las dos columnas ─────────────────────────────────────────────────────────
--  1. `tenants.cambios_password_hash` — bcrypt de la contraseña que asigna el
--     Dueño para el candado de dinero/catálogo. Null = todavía no se ha
--     asignado ninguna (el candado, si está activo, solo acepta la contraseña
--     propia de cada quien, como hoy).
--  2. `sesiones.desbloqueo_es_propio` — true si ESTE desbloqueo se concedió
--     verificando la contraseña de login de quien lo pidió; false si se
--     concedió con la contraseña compartida del tenant. Todo desbloqueo sigue
--     viviendo en el SERVIDOR contra el token de sesión, no en el navegador.
--
-- Aditivo e idempotente.
-- ============================================================================
begin;

alter table tenants  add column if not exists cambios_password_hash  text;
alter table sesiones add column if not exists desbloqueo_es_propio   boolean not null default false;

comment on column tenants.cambios_password_hash is
  'bcrypt de la contraseña de control de cambios (dinero/catálogo) que asigna el Dueño. Null = sin asignar. Restaurada el 21/09 (ADR 0036) tras haberse retirado en el ADR 0009; independiente de usuarios.password_hash.';
comment on column sesiones.desbloqueo_es_propio is
  'True si el desbloqueo vigente se concedió con la contraseña PROPIA de quien la pidió, no con la compartida del tenant. Solo un desbloqueo propio autoriza tocar el acceso de otra persona (exigirReautenticacionSiempre).';

commit;

-- Verificación
select 'tenants.cambios_password_hash' k, count(*)::text v from information_schema.columns
  where table_name='tenants' and column_name='cambios_password_hash'
union all
select 'sesiones.desbloqueo_es_propio', count(*)::text from information_schema.columns
  where table_name='sesiones' and column_name='desbloqueo_es_propio'
union all
select 'tenants_con_contrasena_ya_asignada', count(*)::text from tenants where cambios_password_hash is not null;
