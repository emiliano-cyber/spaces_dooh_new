-- ============================================================================
--  ROLLBACK del backfill de INC-02   ·   2026-08-10
-- ----------------------------------------------------------------------------
--  Devuelve las 16 reservas a `[]`, que es como estaban antes.
--
--  Se puede escribir así de simple porque el estado previo era el MISMO en las
--  dieciséis: arreglo vacío. No hace falta capturar valores fila a fila; lo que
--  sí se captura es CUÁLES son, para no vaciar de rebote una asignación que
--  alguien pusiera a mano después del backfill.
--
--  Los ids se fijaron el 10/08 a partir de la consulta del backfill:
--    KFC (12) · mastercard (2) · card (1) · prueba final (1)
--
--  Se acota por nombre de campaña Y por «el creativo asignado es el único
--  aprobado de esa campaña», que es justo lo que el backfill escribió. Una
--  asignación posterior hecha a mano —dos piezas, o un reparto con `veces`
--  distinto de 1— NO cumple y se queda intacta.
-- ============================================================================

begin;

update reservas r
   set creativos = '[]'::jsonb
  from campanas c, sitios s
 where c.id = r.campana_id
   and s.id = r.sitio_id
   and c.nombre in ('KFC','mastercard','card','prueba final')
   and (s.tipo_medio = 'PANTALLA_DIGITAL' or s.es_rotativo
        or s.exhibicion in ('digital','rotativo'))
   -- Exactamente lo que escribió el backfill: UNA pieza, con `veces` = 1.
   and jsonb_array_length(
         case when jsonb_typeof(r.creativos) = 'array' then r.creativos
              else '[]'::jsonb end) = 1
   and (r.creativos -> 0 ->> 'veces') = '1'
   and (r.creativos -> 0 ->> 'creatividadId') = (
         select cr.id::text from creatividades cr
          where cr.campana_id = r.campana_id
            and cr.estatus_validacion = 'VALIDADA'
            and cr.retirado_en is null);

\echo '=== como quedan ==='
select c.nombre as campana, s.nombre as pantalla, r.creativos::text
  from reservas r
  join campanas c on c.id = r.campana_id
  join sitios s on s.id = r.sitio_id
 where c.nombre in ('KFC','mastercard','card','prueba final')
   and r.estatus <> 'CANCELADA'
 order by c.nombre, s.nombre;

commit;
