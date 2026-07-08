-- ============================================================================
--  S1-3: token aleatorio no enumerable para la liga pública de propuestas
-- ----------------------------------------------------------------------------
--  Antes la liga aceptaba el id (UUID) o el folio corto (PR-XXXXXX), enumerable:
--  un tercero podía tantear folios y abrir propuestas ajenas. Ahora la liga usa
--  un token aleatorio (≥32 chars); el folio queda solo como referencia interna.
--  Backfill de propuestas existentes (invalida las ligas viejas id/folio).
-- ============================================================================

alter table public.propuestas
  add column if not exists token_publico text;

update public.propuestas
   set token_publico = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
 where token_publico is null;

create unique index if not exists idx_propuestas_token
  on public.propuestas (token_publico);
