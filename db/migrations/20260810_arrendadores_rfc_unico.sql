-- ============================================================================
--  Un RFC, un arrendador — por organización  (A5 / INC-07)
-- ----------------------------------------------------------------------------
--  La bitácora de producción guarda un duplicado real: «Creó propietario ·
--  ADMINISTRADORA DE GASOLINERAS INTERLOMAS» dos veces, el 07/07 a las 19:55:06
--  y a las 19:56:17. **Setenta y un segundos de diferencia.** Eso no es un
--  doble clic: es una persona que dio de alta al propietario, no lo vio en la
--  lista y lo volvió a dar de alta un minuto después.
--
--  Importa para elegir la solución. Un botón que se bloquea al enviar —que ya
--  existía, y que ahora además cierra su última rendija— no habría evitado
--  NADA de esto. Lo que lo evita es que la base no acepte el segundo.
--
--  El RFC como clave, y no el nombre:
--
--    · El RFC identifica a un contribuyente. Dos arrendadores con el mismo RFC
--      dentro de una organización son siempre el mismo, sin excepción posible.
--    · El nombre NO. Dos propietarios distintos pueden llamarse igual —son
--      personas, no solo empresas—, y un índice único sobre el nombre frenaría
--      un alta legítima sin forma de saltárselo. Ese caso se resuelve en el
--      servidor con un aviso que se puede confirmar, no aquí.
--
--  `upper(btrim(...))`: el RFC se teclea, y «  agi990422el7 » y «AGI990422EL7»
--  son el mismo. Sin normalizar, el índice dejaría pasar el duplicado con un
--  espacio de más — o sea, justo el que se cuela cuando alguien copia y pega.
--
--  Parcial (`where ... <> ''`): el RFC es OPCIONAL. El ADR 0001 admite que el
--  contrato nazca con datos fiscales pendientes, y exigirlo de entrada frenaría
--  altas legítimas. Un índice sin el filtro trataría los NULL como distintos
--  igualmente, pero dejaría fuera las cadenas vacías, que es como llega un
--  campo de texto que nadie rellenó.
--
--  Estado comprobado en producción antes de escribir esto (10/08): 8
--  arrendadores, CERO repetidos por RFC y CERO por nombre normalizado. No hace
--  falta deduplicar nada — pero la migración lo comprueba igualmente y aborta
--  con la lista, porque «no había duplicados el lunes» no es una garantía para
--  el día que se aplique.
--
--  Idempotente: se puede correr dos veces.
-- ============================================================================

begin;

-- ─── 1. Antes de nada: ¿hay algo que impida crear el índice? ───────────────
-- `create unique index` fallaría solo, pero con un mensaje que no dice CUÁLES.
-- Perder ese dato obliga a investigar a mano en producción, con la migración a
-- medias. Mejor decirlo aquí.
do $$
declare choques text;
begin
  select string_agg(format('tenant %s · RFC %s (%s veces)', tenant_id, rfc_norm, n), E'\n  ')
    into choques
    from (
      select tenant_id, upper(btrim(rfc)) as rfc_norm, count(*) as n
        from arrendadores
       where rfc is not null and btrim(rfc) <> ''
       group by 1, 2
      having count(*) > 1
    ) d;
  if choques is not null then
    raise exception E'Hay arrendadores repetidos por RFC. Resuélvelos antes (conserva el más antiguo y reapunta predios y contratos):\n  %', choques;
  end if;
end $$;

-- ─── 2. El índice ──────────────────────────────────────────────────────────
create unique index if not exists arrendadores_tenant_rfc_uq
  on arrendadores (tenant_id, upper(btrim(rfc)))
  where rfc is not null and btrim(rfc) <> '';

-- ─── 3. ASSERT: existe y es único ──────────────────────────────────────────
-- El arnés de integración aplica todas las migraciones desde cero en cada
-- corrida, así que esto se comprueba en CI y no solo el día del despliegue.
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'arrendadores_tenant_rfc_uq'
  ) then
    raise exception 'El índice arrendadores_tenant_rfc_uq no quedó creado';
  end if;
  if not exists (
    select 1 from pg_index i
      join pg_class c on c.oid = i.indexrelid
     where c.relname = 'arrendadores_tenant_rfc_uq' and i.indisunique
  ) then
    raise exception 'arrendadores_tenant_rfc_uq existe pero NO es único';
  end if;
end $$;

commit;

-- ─── Verificación (debe devolver 0 filas) ──────────────────────────────────
select tenant_id, upper(btrim(rfc)) as rfc_norm, count(*)
  from arrendadores
 where rfc is not null and btrim(rfc) <> ''
 group by 1, 2
having count(*) > 1;

-- ─── ROLLBACK ──────────────────────────────────────────────────────────────
-- Limpio: el índice no cambia ni una fila.
--   drop index if exists arrendadores_tenant_rfc_uq;
