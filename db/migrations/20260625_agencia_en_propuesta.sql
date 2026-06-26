-- ============================================================================
--  Agencia asociada a cliente y a propuesta (aditivo, no destructivo)
-- ----------------------------------------------------------------------------
--  Una agencia es un cliente con tipo='AGENCIA'. Se relaciona:
--   • clientes.agencia_id   → la agencia asociada al cliente (siempre se asocia).
--   • propuestas.agencia_id → la agencia con la que se arma la propuesta.
--  Ambas FK a clientes(id), nullable → no rompen filas existentes.
-- ============================================================================

alter table public.clientes
  add column if not exists agencia_id uuid references public.clientes(id);

alter table public.propuestas
  add column if not exists agencia_id uuid references public.clientes(id);
