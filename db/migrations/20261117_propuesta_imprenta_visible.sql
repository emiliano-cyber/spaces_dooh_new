-- @tipo: esquema
-- ============================================================================
--  SEG-CLIENTE · ¿VE EL CLIENTE QUIÉN IMPRIME SU LONA?
--  Pedido por el dueño el 2026-11-17 (zona ROJA R3: migración nueva).
-- ----------------------------------------------------------------------------
--  La liga pública de la propuesta enseña ahora el seguimiento de la campaña
--  (estilo rastreo de pedido), con el avance de la imprenta. Decisión del dueño:
--  «lo de la imprenta por default está siempre oculto»; lo puede hacer visible
--  el vendedor que creó la propuesta o cualquier rol superior.
--
--  Nombrar a la imprenta le dice al cliente que la impresión la hace un
--  tercero, y con quién: es información comercial del medio, no del cliente.
--
--  · `false` por omisión y para TODAS las filas existentes: al aplicar, nadie
--    ve un nombre que antes no veía.
--  · Vive en la PROPUESTA y no en la campaña: la liga es de la propuesta, y el
--    dueño del permiso (el vendedor que la creó, `usuario_id`) también.
--  · Idempotente (`if not exists`). No toca `db/schema.sql`.
-- ============================================================================
begin;

alter table propuestas
  add column if not exists imprenta_visible boolean not null default false;

comment on column propuestas.imprenta_visible is
  'SEG-CLIENTE (17/11). Si la liga publica muestra el nombre de la imprenta en el seguimiento. Oculto por omision; lo enciende el vendedor que creo la propuesta o un rol superior.';

commit;
