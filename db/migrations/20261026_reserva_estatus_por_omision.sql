-- @tipo: esquema
-- ============================================================================
--  `reservas.estatus` deja de nacer TENTATIVA por omisión: nace CONFIRMADA.
-- ----------------------------------------------------------------------------
--  TENT-PROP, decisión del dueño el 2026-10-26: «lo tentativo debe ser un spot o
--  una pantalla fija que está en veremos en una propuesta: aún no está aprobada
--  ni creada la campaña». Lo tentativo se calcula de las propuestas abiertas
--  (`apps/web/lib/data/en-propuesta.ts`) y la reserva TENTATIVA se retira.
--
--  Ningún flujo de la aplicación crea ya reservas TENTATIVA: reservar desde
--  Comercial y generar la campaña desde una propuesta aprobada insertan
--  CONFIRMADA de forma explícita (`campanas-repo.ts`). La ÚNICA puerta que
--  quedaba era este `default 'TENTATIVA'` (`db/schema.sql:461`): cualquier
--  INSERT que no dijera el estatus —una semilla, un SQL a mano— nacía tentativo
--  sin que nadie lo decidiera. Así se coló una en la base de demostración.
--
--  SOLO cambia el valor por omisión. NO toca filas existentes ni el enum
--  `est_reserva` (que conserva TENTATIVA para las heredadas): convertirlas o
--  cancelarlas es una decisión por fila, y el motor de reportes ya no las cuenta
--  como venta. Para encontrarlas:
--
--    select r.id, c.nombre, r.fecha_inicio, r.fecha_fin, r.precio
--      from reservas r join campanas c on c.id = r.campana_id
--     where r.estatus = 'TENTATIVA';
--
--  Vuelta atrás: `alter table reservas alter column estatus set default
--  'TENTATIVA';`. La versión anterior de la app siempre manda el estatus, así
--  que no depende del valor por omisión.
--
--  Idempotente: fijar el mismo default dos veces no cambia nada.
-- ============================================================================

begin;

alter table reservas alter column estatus set default 'CONFIRMADA';

commit;
