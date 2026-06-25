-- ============================================================================
--  Negociación con la agencia (aditivo, no destructivo)
-- ----------------------------------------------------------------------------
--  La comisión es por AGENCIA (cliente tipo AGENCIA). Se agrega el dato de la
--  negociación que se tiene con la agencia:
--   • tiene_negociacion     → ¿hay negociación con la agencia? (sí/no)
--   • negociacion_validada  → si la hay, ¿está validada? (gate para propuestas)
--   • negociacion_nota      → términos negociados (texto libre)
--  Solo aplican a clientes tipo AGENCIA; en los directos quedan en su default.
-- ============================================================================

alter table public.clientes
  add column if not exists tiene_negociacion    boolean not null default false,
  add column if not exists negociacion_validada boolean not null default false,
  add column if not exists negociacion_nota     text;
