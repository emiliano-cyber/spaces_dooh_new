-- ============================================================================
-- Objetos que existían SOLO en produccion, creados a mano y nunca versionados.
--
-- Encontrado al montar las pruebas de integracion: se comparo columna a columna
-- una base construida desde el repo (schema.sql + las 59 migraciones) contra
-- `spaces_prod`, y faltaban 27 columnas. Todas de estos tres objetos.
--
-- No es cosmetico. `creativos-repo.ts:103` ejecuta
--     update creatividades set retirado_en = now() where id = $1
-- asi que en cualquier entorno levantado desde el repo, RETIRAR UN CREATIVO
-- FALLA. Lo mismo con las dos tablas de cache de DOOHmain, que `playlogs-repo`
-- consulta sin que nada las cree.
--
-- Dicho de otro modo: hasta ahora este repositorio no podia construir una base
-- de datos que funcionara. Un entorno nuevo —o una recuperacion desde cero—
-- arrancaba con esas rutas rotas y sin nada que lo avisara.
--
-- Las definiciones se copiaron de la estructura REAL de produccion, no se
-- reinventaron, para que aplicar esto en otro entorno de el mismo resultado.
--
-- Aditivo e idempotente.
-- ============================================================================
begin;

-- Retiro de creativos: no se borran, se marcan (su API remota no permite
-- quitarlos), y al marcarlos se desasignan de los slots.
alter table creatividades add column if not exists retirado_en timestamptz;
comment on column creatividades.retirado_en is
  'Cuando se retiro el creativo. No se borra la fila: la API remota no permite quitarlo.';

-- Cache de lo que hay del lado de DOOHmain. NO llevan tenant_id ni RLS a
-- proposito: son un espejo de un sistema externo, identificado por sus propios
-- ids remotos, no datos de negocio de una organizacion.
create table if not exists doohmain_remote_campaigns (
  id             bigint      primary key,
  version        text        not null,
  auth           text,
  name           text,
  anunciante     text,
  created_at     timestamptz not null default now(),
  last_synced_at timestamptz not null default now()
);

create table if not exists doohmain_remote_lists (
  id             bigint      primary key,
  screen_name    text        not null,
  list_name      text        not null,
  campaign_auth  text,
  media_id       bigint      not null,
  created_at     timestamptz not null default now(),
  last_synced_at timestamptz not null default now()
);

-- Registro de los archivos ya subidos a DOOHmain, para no resubir lo mismo.
-- A diferencia de las dos de arriba, NINGUN codigo del repo la consulta hoy:
-- la usa el proceso de subida que vive fuera de esta aplicacion. Se versiona
-- igual, porque una base construida desde el repo tiene que ser LA MISMA que
-- la desplegada — si no, la comparacion deja de servir para detectar deriva y
-- volvemos a donde estabamos.
create table if not exists media_uploads (
  id           bigint      primary key,
  version      text        not null,
  media_id     bigint      not null,
  file_hash    text,
  filename     text,
  local_path   text,
  ancho        integer,
  alto         integer,
  extension    text,
  source_mtime bigint,
  source_size  bigint,
  uploaded_at  timestamptz not null default now()
);

commit;

-- Verificación: los cuatro deben decir 1.
select 'creatividades.retirado_en' k, count(*)::text v from information_schema.columns
  where table_name='creatividades' and column_name='retirado_en'
union all
select 'doohmain_remote_campaigns', count(*)::text from information_schema.tables
  where table_name='doohmain_remote_campaigns'
union all
select 'doohmain_remote_lists', count(*)::text from information_schema.tables
  where table_name='doohmain_remote_lists'
union all
select 'media_uploads', count(*)::text from information_schema.tables
  where table_name='media_uploads';
