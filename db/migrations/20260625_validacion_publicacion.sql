-- ============================================================================
--  Validación de publicación de campaña (aditivo, no destructivo)
-- ----------------------------------------------------------------------------
--  Dos pasos antes de que una campaña salga "al aire":
--   1) enviada_dominio: la campaña se envía al dominio/CMS (DOOHMAIN/Broadsign).
--   2) validacion_estatus: un revisor verifica la información de los anuncios y
--      APRUEBA o RECHAZA la publicación. Al aprobar, la campaña pasa a ACTIVA.
--  Todas las columnas son nullable / con default → no rompen filas existentes.
-- ============================================================================

alter table public.campanas
  add column if not exists enviada_dominio       boolean     not null default false,
  add column if not exists enviada_dominio_en    timestamptz,
  add column if not exists validacion_estatus    text        not null default 'PENDIENTE',
  add column if not exists validacion_motivo     text,
  add column if not exists validacion_por        text,
  add column if not exists validacion_en         timestamptz;
