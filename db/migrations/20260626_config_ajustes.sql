-- Ajustes del negocio (multi-tenant): logo, IVA(s) con los que trabaja, y
-- parámetros de reproducción digital (loop y duración de spot). Aditivo.
alter table public.config_negocio
  add column if not exists logo_url   text,
  add column if not exists iva_tasas  numeric[] not null default array[16]::numeric[],
  add column if not exists loop_seg   integer   not null default 60,
  add column if not exists spot_seg   integer   not null default 10;
