-- ============================================================================
-- Contrato incompleto · la vigencia debe cubrir lo vendido.
-- Ver docs/adr/0001-contrato-incompleto-al-generar-campana.md
-- REQUIERE 20260727_contrato_incompleto.sql.
--
-- La carga inicial creó los pendientes con `fecha_fin` en NULL: decían desde
-- cuándo hay que cubrir la pantalla, pero no hasta cuándo. Un pendiente sin fin
-- no permite comprobar lo que importa —que exista contrato para TODO el periodo
-- que se le vendió al cliente—, así que se le pone como fin la reserva más
-- lejana del sitio.
--
-- Solo toca contratos INCOMPLETO, que son marcadores creados por el sistema.
-- Un contrato REAL nunca se extiende automáticamente: eso sería inventar los
-- términos pactados con el propietario. Cuando un contrato real se queda corto,
-- lo denuncia la alerta «El contrato no cubre la campaña» (derive.ts).
-- Aditivo e idempotente.
-- ============================================================================
begin;

update contratos_arrendamiento c
   set fecha_fin = sub.hasta
  from (
    select r.sitio_id, max(r.fecha_fin) as hasta
      from reservas r
     where r.estatus <> 'CANCELADA'
     group by r.sitio_id
  ) sub
 where c.sitio_id = sub.sitio_id
   and c.estatus = 'INCOMPLETO'
   and (c.fecha_fin is null or c.fecha_fin < sub.hasta);

commit;

-- Verificación
select 'incompletos_total' k, count(*)::text v
  from contratos_arrendamiento where estatus = 'INCOMPLETO'
union all
select 'incompletos_sin_fin', count(*)::text
  from contratos_arrendamiento where estatus = 'INCOMPLETO' and fecha_fin is null
union all
-- Los que siguen sin fin deben ser exactamente los de sitios nunca vendidos.
select 'de_esos_nunca_vendidos', count(*)::text
  from contratos_arrendamiento c
 where c.estatus = 'INCOMPLETO' and c.fecha_fin is null
   and not exists (select 1 from reservas r where r.sitio_id = c.sitio_id and r.estatus <> 'CANCELADA')
union all
select 'reservas_descubiertas', count(*)::text
  from reservas r
  join contratos_arrendamiento c on c.sitio_id = r.sitio_id and c.estatus = 'INCOMPLETO'
 where r.estatus <> 'CANCELADA' and (c.fecha_fin is null or c.fecha_fin < r.fecha_fin);
