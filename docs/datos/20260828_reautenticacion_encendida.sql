-- ========================================================================
--  Encender `exigir_reautenticacion` en las organizaciones que YA existen.
--  2026-08-28 · decisión de Emiliano
-- ------------------------------------------------------------------------
--  Va aquí y no en `db/migrations/` porque toca FILAS, no el esquema. El
--  cambio de esquema —que el DEFAULT pase a `true`, para que toda instancia
--  nueva nazca con el candado cerrado— es
--  `db/migrations/20260828_reautenticacion_por_defecto.sql`, y esa migración
--  **no escribe en ninguna fila a propósito**: encender el candado a gente que
--  está trabajando ahora mismo es otra decisión, y es ésta.
--
--  ── QUÉ CAMBIA PARA QUIEN USA LA APLICACIÓN ────────────────────────────
--  Ocho rutas sensibles empiezan a pedir la contraseña. Tres mueven dinero:
--  facturar una campaña, marcar pagada una cobranza y pagar una renta. Las
--  otras cinco son de contratos y arrendadores.
--
--  **El desbloqueo dura 15 minutos** (`cambios.ts:49`), así que facturar diez
--  campañas seguidas la pide UNA vez. No es una contraseña por acción.
--
--  ── POR QUÉ SIN LISTA DE ids, contra la convención de este directorio ──
--  El README pide «todo por id explícito, nunca por patrón», y con razón: un
--  patrón alcanza mañana un registro nuevo. Aquí es al revés y conviene
--  decirlo en vez de saltárselo en silencio: lo que se quiere es que **todas**
--  las organizaciones de esta base queden con el candado cerrado, incluidas
--  las que se hayan creado entre que se escribió esto y se aplicó. Una lista
--  de ids dejaría fuera precisamente a esas.
--
--  El riesgo que la convención evita —tocar de más— no aplica: el peor caso
--  es cerrar un candado en una organización de sobra, y se abre con un
--  `update` de una línea.
--
--  ── ANTES DE APLICAR ───────────────────────────────────────────────────
--  1. Capturar el estado real (el rollback de al lado se genera de ahí):
--       select slug, exigir_reautenticacion from tenants order by slug;
--  2. Pasada en seco: este mismo archivo con `commit` → `rollback`,
--     comprobando que el número de filas es el previsto.
-- ========================================================================
begin;

update tenants
   set exigir_reautenticacion = true
 where exigir_reautenticacion is distinct from true;

-- Cuántas se tocaron. Se lee en la salida y se compara con la captura previa.
select count(*) as organizaciones_con_candado
  from tenants
 where exigir_reautenticacion;

commit;

-- Verificación (todas deben salir en `t`):
--   select slug, exigir_reautenticacion from tenants order by slug;
