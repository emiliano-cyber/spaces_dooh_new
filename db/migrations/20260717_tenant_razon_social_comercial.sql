-- Razón social y nombre comercial POR TENANT (cada CRM/organización su empresa).
-- Se movieron de config_negocio (fila única GLOBAL, compartida por todas las
-- organizaciones) a la tabla tenants, junto a `nombre`. Aditivo en tenants +
-- limpieza de las columnas globales que quedaron sin uso.
alter table public.tenants
  add column if not exists razon_social     text,
  add column if not exists nombre_comercial text;

alter table public.config_negocio
  drop column if exists razon_social,
  drop column if exists nombre_comercial;
