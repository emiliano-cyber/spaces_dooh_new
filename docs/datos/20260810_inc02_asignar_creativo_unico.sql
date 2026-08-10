-- ============================================================================
--  INC-02 · dejar por escrito qué pieza salió en qué pantalla   2026-08-10
-- ----------------------------------------------------------------------------
--  Cuatro campañas ya publicadas tienen sus pantallas digitales en «Sin
--  asignar» y UN SOLO creativo aprobado:
--
--    KFC ................. 12 pantallas · creativo-kfc.jpg
--    mastercard ..........  2 pantallas · creativo-mastercard.jpg
--    card ................  1 pantalla  · WhatsApp Image 2026-07-16 …png
--    prueba final ........  1 pantalla  · WhatsApp Image 2026-07-13 …jpeg
--                          ── 16 reservas en total
--
--  ESTO NO INVENTA UN DATO, LO ANOTA. Con el código anterior la publicación
--  mandaba TODOS los creativos aprobados a TODAS las pantallas digitales de la
--  campaña. Como en estas cuatro solo hay uno aprobado, ese creativo es
--  exactamente el que salió en cada una de esas 16 pantallas. Se está
--  escribiendo lo que ocurrió, no una suposición.
--
--  Por eso el `where` exige `= 1` aprobado y no `>= 1`: con dos o más, cuál
--  salió en cuál no se puede saber desde aquí, y rellenarlo sería inventar. Las
--  que quedan así —«Campaña lista — publicar a DOOHmain» y «pruebas_produccion»,
--  con dos aprobados— se dejan a propósito y las tiene que asignar una persona.
--
--  `veces = 1` y no los spots de la pantalla: las 16 reservas tienen
--  `spots_por_dia` en NULL, o sea que no hay pauta diaria contratada. El 1 es la
--  marca de «esta pieza va aquí», y el código de publicación lo sabe: cuando no
--  hay `spots_por_dia`, NO manda `--cant-dia` — igual que hasta hoy. Si mandara
--  ese 1 como cuota, estas campañas pasarían de la pauta completa a un pase al
--  día.
--
--  NO republica nada. Escribir la asignación no llama a DOOHmain; lo que ya
--  está al aire sigue igual. Esto arregla el REGISTRO.
--
--  Cómo correrlo (como `postgres`):
--    sudo -u postgres psql -d spaces_prod -f 20260810_inc02_asignar_creativo_unico.sql
-- ============================================================================

begin;

-- ─── Antes: la foto de lo que se va a tocar ────────────────────────────────
\echo '=== ANTES ==='
select c.nombre as campana, s.nombre as pantalla, r.creativos::text
  from reservas r
  join campanas c on c.id = r.campana_id
  join sitios s on s.id = r.sitio_id
 where r.estatus <> 'CANCELADA'
   and (s.tipo_medio = 'PANTALLA_DIGITAL' or s.es_rotativo
        or s.exhibicion in ('digital','rotativo'))
   and jsonb_array_length(
         case when jsonb_typeof(r.creativos) = 'array' then r.creativos
              else '[]'::jsonb end) = 0
   and (select count(*) from creatividades cr
         where cr.campana_id = c.id and cr.estatus_validacion = 'VALIDADA') = 1
 order by c.nombre, s.nombre;

-- ─── El cambio ─────────────────────────────────────────────────────────────
update reservas r
   set creativos = jsonb_build_array(jsonb_build_object(
         'creatividadId', (
            select cr.id::text from creatividades cr
             where cr.campana_id = r.campana_id
               and cr.estatus_validacion = 'VALIDADA'
               and cr.retirado_en is null),
         'veces', greatest(coalesce(r.spots_por_dia, 1), 1)))
  from sitios s
 where s.id = r.sitio_id
   and r.estatus <> 'CANCELADA'
   and (s.tipo_medio = 'PANTALLA_DIGITAL' or s.es_rotativo
        or s.exhibicion in ('digital','rotativo'))
   and jsonb_array_length(
         case when jsonb_typeof(r.creativos) = 'array' then r.creativos
              else '[]'::jsonb end) = 0
   and (select count(*) from creatividades cr
         where cr.campana_id = r.campana_id
           and cr.estatus_validacion = 'VALIDADA'
           and cr.retirado_en is null) = 1;

-- ─── Guardarraíl: tienen que ser 16, ni una más ────────────────────────────
-- Si sale otro número, el estado de la base no es el que se midió el 10/08 y
-- lo correcto es parar y volver a mirar, no confiar en el `where`.
do $$
declare n int;
begin
  select count(*) into n
    from reservas r
    join sitios s on s.id = r.sitio_id
   where (s.tipo_medio = 'PANTALLA_DIGITAL' or s.es_rotativo
          or s.exhibicion in ('digital','rotativo'))
     and r.estatus <> 'CANCELADA'
     and jsonb_array_length(
           case when jsonb_typeof(r.creativos) = 'array' then r.creativos
                else '[]'::jsonb end) = 0
     and (select count(*) from creatividades cr
           where cr.campana_id = r.campana_id
             and cr.estatus_validacion = 'VALIDADA'
             and cr.retirado_en is null) = 1;
  if n <> 0 then
    raise exception 'Quedan % reservas sin asignar que cumplían la regla. Se aborta.', n;
  end if;
end $$;

\echo '=== DESPUES ==='
select c.nombre as campana, s.nombre as pantalla, r.creativos::text
  from reservas r
  join campanas c on c.id = r.campana_id
  join sitios s on s.id = r.sitio_id
 where c.nombre in ('KFC','mastercard','card','prueba final')
   and r.estatus <> 'CANCELADA'
 order by c.nombre, s.nombre;

commit;
