-- @tipo: esquema
-- ============================================================================
--  PANTALLA EN DOOHmain · cada pantalla dice a qué pantalla de DOOHmain va.
-- ----------------------------------------------------------------------------
--  Pedido por el dueño el 13/10. Hasta hoy la única forma de decirlo era
--  `DOOHMAIN_SCREEN_MAP`, un JSON en el `.env` del servidor de cada instancia:
--  cada pantalla nueva era editar el servidor y reiniciar el contenedor, algo
--  que Comercial no puede hacer. Y lo que no estaba en el mapa se iba en
--  silencio a `DOOHMAIN_DEFAULT_SCREEN`, una sola pantalla física para todas.
--
--  `sitios.doohmain_pantalla` es el nombre de la pantalla TAL COMO LO CONOCE
--  DOOHmain (`create_spot` lo recibe como `name`). Al publicar manda sobre el
--  mapa del servidor; el mapa y la pantalla por omisión quedan de respaldo, así
--  que nada cambia para una instancia que ya los usa (`lib/server/doohmain.ts`).
--
--  ─── Por qué texto y no una tabla de pantallas de DOOHmain ───────────────
--  La lista de pantallas vive en DOOHmain y cambia allí; copiarla aquí sería
--  otra copia que diverge. La ficha la consulta en vivo para ofrecerla
--  (`GET /api/integraciones/doohmain/pantallas`), y lo que se guarda es el
--  nombre elegido.
--
--  ─── Lo que la base impide ───────────────────────────────────────────────
--  Espacios en los extremos y valores vacíos: DOOHmain compara el nombre
--  exacto, y « adv_004» no es «adv_004» — fallaría al publicar, días después
--  de capturarlo. El vacío es NULL («usa lo del servidor»), nunca ''. Y un
--  tope de 120 caracteres, que ningún nombre de pantalla real se acerca a pasar.
--  No es única a propósito: dos caras de una misma estructura pueden salir por
--  el mismo reproductor.
--
--  Sin `tenant_id` nuevo: la columna vive en `sitios`, que ya tiene RLS.
--  No entra al alta ni a la importación por archivo (`COLS` de
--  `sitios-repo.ts`): una re-importación la pisaría con NULL.
--
--  Aditiva e idempotente. Prueba: `apps/web/lib/test/doohmain-pantalla-por-sitio.e2e.test.ts`.
-- ============================================================================
begin;

alter table sitios add column if not exists doohmain_pantalla text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'sitios_doohmain_pantalla_ck' and conrelid = 'sitios'::regclass
  ) then
    alter table sitios
      add constraint sitios_doohmain_pantalla_ck
      check (doohmain_pantalla is null
             or (doohmain_pantalla = btrim(doohmain_pantalla)
                 and length(doohmain_pantalla) between 1 and 120));
  end if;
end $$;

comment on column sitios.doohmain_pantalla is
  'Nombre de la pantalla en DOOHmain a la que se publica esta pantalla. NULL = usa DOOHMAIN_SCREEN_MAP / DOOHMAIN_DEFAULT_SCREEN del servidor.';

commit;
