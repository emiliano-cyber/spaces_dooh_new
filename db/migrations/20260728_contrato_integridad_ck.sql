-- ============================================================================
-- Integridad mínima del contrato en la BASE, no solo en la aplicación (B-9).
--
-- La auditoría del 2026-07-28 comprobó que la base aceptaba las dos cosas que
-- un contrato nunca puede ser:
--
--   insert ... monto_renta = 0            -> INSERT 0 1   (aceptado)
--   insert ... fecha_fin < fecha_inicio   -> INSERT 0 1   (aceptado)
--
-- El controller sí rechazaba las fechas invertidas, pero el importe se validaba
-- con `nonnegative`, que deja pasar el CERO. Ese es el caso caro: un contrato de
-- $0 satisface `contrato_completo_ck`, deja de aparecer en la alerta de
-- «contrato incompleto» y el P&L reporta margen = ingreso íntegro. El espacio
-- queda como GRATIS y nada lo denuncia. Es el «CONFORME falso que se convierte
-- en un P&L equivocado frente a un cliente real».
--
-- El controller ya usa `positive()`. Esto es la segunda capa: la aplicación se
-- salta (un job, una migración, otro endpoint, psql), la base no. Y el repo
-- expone funciones de escritura que no pasan por el controller.
--
-- Los dos CHECK admiten NULL a propósito: un contrato INCOMPLETO (ADR 0001)
-- nace sin importe ni fecha de fin, y `contrato_completo_ck` ya se encarga de
-- exigir los cuatro datos en cuanto el contrato afirma un acuerdo real.
--
-- Aditiva e idempotente. No reescribe ninguna fila.
-- ============================================================================
begin;

-- Prerrequisito: si algún contrato ya viola las reglas, la migración debe
-- decirlo con precisión en vez de fallar con un 23514 opaco.
do $$
declare n_monto int; n_fechas int;
begin
  select count(*) into n_monto from contratos_arrendamiento
   where monto_renta is not null and monto_renta <= 0;
  select count(*) into n_fechas from contratos_arrendamiento
   where fecha_fin is not null and fecha_fin <= fecha_inicio;
  if n_monto > 0 or n_fechas > 0 then
    raise exception
      'Datos incompatibles: % contrato(s) con renta <= 0 y % con fecha_fin <= fecha_inicio. Corrígelos antes de aplicar esta migración.',
      n_monto, n_fechas;
  end if;
end $$;

alter table contratos_arrendamiento drop constraint if exists contrato_monto_ck;
alter table contratos_arrendamiento add constraint contrato_monto_ck
  check (monto_renta is null or monto_renta > 0);

alter table contratos_arrendamiento drop constraint if exists contrato_fechas_ck;
alter table contratos_arrendamiento add constraint contrato_fechas_ck
  check (fecha_fin is null or fecha_fin > fecha_inicio);

comment on constraint contrato_monto_ck on contratos_arrendamiento is
  'La renta de un contrato no puede ser cero ni negativa. NULL solo mientras está INCOMPLETO.';
comment on constraint contrato_fechas_ck on contratos_arrendamiento is
  'La vigencia no puede terminar antes de empezar. NULL solo mientras está INCOMPLETO.';

commit;

-- Verificación
select 'check_monto' k,
       coalesce((select conname from pg_constraint
                  where conrelid='contratos_arrendamiento'::regclass
                    and conname='contrato_monto_ck'), '(FALTA)') v
union all
select 'check_fechas',
       coalesce((select conname from pg_constraint
                  where conrelid='contratos_arrendamiento'::regclass
                    and conname='contrato_fechas_ck'), '(FALTA)')
union all
select 'contratos_con_renta_invalida', count(*)::text from contratos_arrendamiento
 where monto_renta is not null and monto_renta <= 0
union all
select 'contratos_con_fechas_invalidas', count(*)::text from contratos_arrendamiento
 where fecha_fin is not null and fecha_fin <= fecha_inicio
union all
select 'incompletos_intactos', count(*)::text from contratos_arrendamiento
 where estatus = 'INCOMPLETO';
