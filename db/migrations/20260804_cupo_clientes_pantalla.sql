-- ============================================================================
-- ADR 0008 · Cupo de clientes por pantalla.
--
-- Hasta hoy una pantalla se valida por UN solo eje: slots (digitales) o
-- exclusividad de fechas (fijas). No había forma de decir "esta pantalla no
-- lleva más de N anunciantes distintos", que es una política comercial, no una
-- capacidad técnica.
--
-- Dos columnas, las dos NULL = SIN LÍMITE:
--   · sitios.max_clientes                  — cupo de ESTA pantalla.
--   · config_negocio.max_clientes_pantalla — default para las que no tengan uno.
--
-- La regla NACE APAGADA a propósito. Desplegar esta migración no bloquea
-- ninguna venta en curso: el cupo empieza a aplicar cuando alguien lo captura,
-- y se apaga volviendo a poner NULL. Sembrar un número aquí tumbaría reservas
-- que el equipo ya tiene comprometidas.
--
-- Aditiva e idempotente.
-- ============================================================================
begin;

alter table sitios          add column if not exists max_clientes           integer;
alter table config_negocio  add column if not exists max_clientes_pantalla  integer;

-- Un cupo de 0 no significa nada útil (nadie cabe = pantalla muerta); si se
-- quiere cerrar una pantalla existe estatus_comercial='BLOQUEADO'. Se acota en
-- la BD además de en zod: la validación de la app no protege a quien entra por
-- psql, y este número decide si una venta se puede cerrar o no.
alter table sitios          drop constraint if exists sitios_max_clientes_ck;
alter table sitios          add  constraint sitios_max_clientes_ck
  check (max_clientes is null or max_clientes >= 1);
alter table config_negocio  drop constraint if exists config_max_clientes_ck;
alter table config_negocio  add  constraint config_max_clientes_ck
  check (max_clientes_pantalla is null or max_clientes_pantalla >= 1);

comment on column sitios.max_clientes is
  'ADR 0008. Máximo de clientes distintos con reserva vigente en esta pantalla. NULL = sin límite (cae al default de config_negocio).';
comment on column config_negocio.max_clientes_pantalla is
  'ADR 0008. Cupo de clientes por defecto para las pantallas sin uno propio. NULL = sin límite.';

commit;

-- Verificación
select 'sitios.max_clientes' k, count(*)::text v from information_schema.columns
  where table_name='sitios' and column_name='max_clientes'
union all
select 'config_negocio.max_clientes_pantalla', count(*)::text from information_schema.columns
  where table_name='config_negocio' and column_name='max_clientes_pantalla'
union all
select 'pantallas_con_cupo_propio', count(*)::text from sitios where max_clientes is not null
union all
select 'cupo_default_global', coalesce(max(max_clientes_pantalla)::text, 'sin limite') from config_negocio;
