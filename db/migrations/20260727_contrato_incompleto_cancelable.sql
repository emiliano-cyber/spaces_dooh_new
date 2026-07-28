-- ============================================================================
-- Contrato incompleto · corrección del CHECK — un pendiente se puede CANCELAR.
-- Ver docs/adr/0001-contrato-incompleto-al-generar-campana.md
-- REQUIERE 20260727_contrato_incompleto.sql.
--
-- El CHECK original exigía los cuatro datos (arrendador, importe, periodicidad,
-- fecha de fin) en TODO estatus distinto de INCOMPLETO. Eso hacía imposible
-- cancelar un contrato incompleto: `cancelarContrato` pone estatus='CANCELADO'
-- sin rellenar nada, y la fila quedaba con nulos en un estatus que los prohíbe →
-- violación de CHECK y error opaco («Un valor no cumple las reglas de la tabla»).
--
-- El modelo correcto: la completitud se exige solo en los estatus que
-- representan un acuerdo real, vivo o histórico —VIGENTE, POR_VENCER, RENOVADO,
-- VENCIDO—. INCOMPLETO es un pendiente de captura y CANCELADO es un pendiente
-- descartado; ninguno de los dos afirma que exista un acuerdo, así que ninguno
-- necesita los datos.
--
-- Se relaja, no se endurece: toda fila que pasaba el CHECK anterior sigue
-- pasando este. Aditivo e idempotente.
-- ============================================================================
begin;

alter table contratos_arrendamiento drop constraint if exists contrato_completo_ck;
alter table contratos_arrendamiento add constraint contrato_completo_ck check (
  estatus in ('INCOMPLETO', 'CANCELADO') or (
    arrendador_id is not null and
    fecha_fin     is not null and
    monto_renta   is not null and
    periodicidad  is not null
  )
);

comment on constraint contrato_completo_ck on contratos_arrendamiento is
  'Los cuatro datos (arrendador, importe, periodicidad, fin) son obligatorios en los estatus que afirman un acuerdo real: VIGENTE, POR_VENCER, RENOVADO, VENCIDO. INCOMPLETO (pendiente de captura) y CANCELADO (pendiente descartado) pueden tenerlos en NULL.';

commit;

-- Verificación: el CHECK existe y sigue rechazando lo que debe.
select 'check' k, conname v from pg_constraint
 where conrelid = 'contratos_arrendamiento'::regclass and conname = 'contrato_completo_ck'
union all
select 'filas_invalidas', count(*)::text from contratos_arrendamiento
 where estatus not in ('INCOMPLETO', 'CANCELADO')
   and (arrendador_id is null or fecha_fin is null or monto_renta is null or periodicidad is null);
