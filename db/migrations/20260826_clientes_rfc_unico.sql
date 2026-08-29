-- ============================================================================
--  Un RFC, un cliente — por organización  (VAL-03, auditoría del 2026-08-26)
-- ----------------------------------------------------------------------------
--  ⚠️ ESCRITA PERO NO APLICADA. La escribió el agente que corrigió la auditoría;
--  aplicarla contra una base real es decisión de una persona (ver «Antes de
--  aplicarla», abajo). El arnés de integración sí la aplica en cada corrida,
--  porque construye el esquema desde cero.
--
--  La auditoría de caja negra dio de alta el mismo cliente dos veces —mismo
--  nombre y mismo RFC— y las dos veces recibió 201. Es el mismo defecto que
--  arrendadores cerró el 10/08 (A5 / INC-07, `20260810_arrendadores_rfc_unico`)
--  y esta migración es su espejo deliberado: dos módulos que resuelven el mismo
--  problema de dos formas distintas acaban divergiendo en la pantalla.
--
--  El RFC como clave, y no el nombre:
--
--    · El RFC identifica a un contribuyente. Dos clientes con el mismo RFC
--      dentro de una organización son el mismo, y facturarles por separado
--      parte el historial de cobranza en dos.
--    · El nombre NO. Dos anunciantes pueden llamarse igual, y un índice único
--      sobre el nombre frenaría un alta legítima sin forma de saltársela. Ese
--      caso se resuelve en el servidor con un aviso que se puede confirmar
--      (`clientes-repo.ts`, `ClienteDuplicado`), no aquí.
--
--  ── LA DIFERENCIA CON ARRENDADORES: los RFC genéricos ──────────────────────
--  El SAT define dos RFC compartidos por diseño:
--
--      XAXX010101000   ventas al público en general
--      XEXX010101000   residentes en el extranjero sin RFC mexicano
--
--  Una organización factura a «público en general» decenas de veces, y cada
--  una es un cliente distinto. Un índice que los incluyera haría imposible el
--  segundo — y sin salida, porque la regla del RFC no se puede confirmar. Se
--  excluyen del índice y quedan cubiertos por el aviso del nombre.
--
--  Arrendadores no necesitó esta excepción porque un propietario genérico no
--  existe: siempre hay una persona o una empresa concreta detrás del predio.
--
--  `upper(btrim(...))`: el RFC se teclea, y «  agi990422el7 » y «AGI990422EL7»
--  son el mismo. Sin normalizar, el índice dejaría pasar el duplicado con un
--  espacio de más — justo el que se cuela al copiar y pegar.
--
--  Parcial (`where ... <> ''`): el RFC es OPCIONAL. Un cliente puede entrar
--  antes de tener sus datos fiscales, y exigirlo de entrada frenaría altas
--  legítimas. Un índice sin el filtro trataría los NULL como distintos
--  igualmente, pero dejaría fuera las cadenas vacías, que es como llega un
--  campo de texto que nadie rellenó.
--
--  ── ANTES DE APLICARLA ─────────────────────────────────────────────────────
--  El bloque 1 aborta con la lista si ya hay duplicados. Eso NO es un fallo de
--  la migración: es la pregunta que hay que contestar antes. Para cada choque
--  hay que decidir cuál fila se conserva y reapuntar sus campañas, propuestas y
--  facturas — y eso es un cambio de datos en producción, que va documentado en
--  `docs/datos/` con su rollback capturado antes.
--
--  A diferencia de arrendadores en agosto, aquí NO se ha censado producción:
--  este agente no toca servidores. La consulta para hacerlo es la de
--  «Verificación», al final.
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
        from clientes
       where rfc is not null
         and btrim(rfc) <> ''
         and upper(btrim(rfc)) not in ('XAXX010101000', 'XEXX010101000')
       group by 1, 2
      having count(*) > 1
    ) d;
  if choques is not null then
    raise exception E'Hay clientes repetidos por RFC. Resuélvelos antes (conserva el más antiguo y reapunta campañas, propuestas y facturas):\n  %', choques;
  end if;
end $$;

-- ─── 2. El índice ──────────────────────────────────────────────────────────
create unique index if not exists clientes_tenant_rfc_uq
  on clientes (tenant_id, upper(btrim(rfc)))
  where rfc is not null
    and btrim(rfc) <> ''
    and upper(btrim(rfc)) not in ('XAXX010101000', 'XEXX010101000');

-- ─── 3. ASSERT: existe y es único ──────────────────────────────────────────
-- El arnés de integración aplica todas las migraciones desde cero en cada
-- corrida, así que esto se comprueba en CI y no solo el día del despliegue.
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'clientes_tenant_rfc_uq'
  ) then
    raise exception 'El índice clientes_tenant_rfc_uq no quedó creado';
  end if;
  if not exists (
    select 1 from pg_index i
      join pg_class c on c.oid = i.indexrelid
     where c.relname = 'clientes_tenant_rfc_uq' and i.indisunique
  ) then
    raise exception 'clientes_tenant_rfc_uq existe pero NO es único';
  end if;
end $$;

commit;

-- ─── Verificación (debe devolver 0 filas) ──────────────────────────────────
-- Es también el censo que hay que correr ANTES de aplicarla en producción: si
-- devuelve filas, la migración abortará con esa misma lista.
select tenant_id, upper(btrim(rfc)) as rfc_norm, count(*)
  from clientes
 where rfc is not null
   and btrim(rfc) <> ''
   and upper(btrim(rfc)) not in ('XAXX010101000', 'XEXX010101000')
 group by 1, 2
having count(*) > 1;

-- ─── ROLLBACK ──────────────────────────────────────────────────────────────
-- Limpio: el índice no cambia ni una fila.
--   drop index if exists clientes_tenant_rfc_uq;
