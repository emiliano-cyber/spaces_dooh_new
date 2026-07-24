-- ============================================================================
-- N-7 (cierre): sitios EXCLUSIVOS (estáticos, no digitales/rotativos) que
-- quedaron en 'DISPONIBLE' pese a tener una reserva NO cancelada que solapa la
-- fecha de hoy — es decir, están ocupados AHORA pero el contador de estado
-- driftó. Un sitio exclusivo con una reserva vigente debe estar OCUPADO.
--
-- Corrección ACOTADA y segura: SOLO endereza el drift en una dirección
-- (DISPONIBLE → OCUPADO) para sitios exclusivos con reserva vigente hoy. NO toca
-- ningún otro estado (no hace OCUPADO → DISPONIBLE), para no alterar sitios
-- bloqueados/en mantenimiento/reservas futuras. Idempotente (re-ejecutar a otra
-- fecha recomputa contra ese día).
--
-- NOTA: esto endereza el ESTADO. Un sitio con DOS reservas CONFIRMADA solapadas
-- (doble-booking heredado) queda OCUPADO pero sigue doble-reservado: esa
-- resolución (cuál campaña conserva el sitio) es una decisión humana y se reporta
-- aparte, NO se resuelve aquí.
-- ============================================================================
begin;

do $$
declare n int;
begin
  update sitios s
     set estatus_comercial = 'OCUPADO'
   where s.estatus_comercial = 'DISPONIBLE'
     and not (
       coalesce(s.es_rotativo, false)
       or s.exhibicion in ('digital', 'rotativo')
       or s.tipo_medio = 'PANTALLA_DIGITAL'
     )
     and exists (
       select 1 from reservas r
        where r.sitio_id = s.id
          and r.estatus <> 'CANCELADA'
          and current_date between r.fecha_inicio and r.fecha_fin
     );
  get diagnostics n = row_count;
  raise notice 'N-7 sitios estáticos DISPONIBLE→OCUPADO (reserva vigente hoy) corregidos=%', n;
end $$;

commit;
