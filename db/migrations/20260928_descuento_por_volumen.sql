-- @tipo: esquema
-- ============================================================================
--  VOL-01 · descuento por VOLUMEN.  ADR 0039, Fase 2.
-- ----------------------------------------------------------------------------
--  «Compra 50 spots y pagas 40.» El escalon de la cadena de precio que va
--  DESPUES de la tarifa base (Fase 1) y ANTES del descuento comercial:
--
--      tarifa base = f(pantalla, unidad, franja, fecha)      <- Fase 1
--            x  DESCUENTO POR VOLUMEN                        <- esta migracion
--            x  descuento comercial (con su tope)
--            x  codigo promocional                           <- Fase 3, no existe
--            x  (1 - comision de agencia)
--            =  neto
--
--  Aditiva entera. No toca una sola fila existente, no cambia ninguna
--  restriccion existente, no edita ninguna migracion anterior y no toca
--  db/schema.sql. No mueve ni un importe: la escala nace VACIA y las dos
--  columnas nuevas nacen en 0, que es «sin volumen», que es como se vendio todo
--  hasta hoy.
--
--  ═══ LAS DOS DECISIONES DE DISENO, con el motivo escrito ══════════════════
--
--  1 · LA ESCALA CUELGA DE LA ORGANIZACION, CON LA UNIDAD DE VENTA COMO CLAVE.
--
--  Las cuatro opciones que habia sobre la mesa eran: la organizacion, la FILA
--  DE TARIFA (pantalla x unidad x franja x temporada), la unidad de venta, o
--  una mixta con anulacion por pantalla. Se elige **organizacion x unidad**.
--
--  Por que NO la fila de tarifa: obligaria al dueno a capturar tramos en cada
--  combinacion de la rejilla. Es exactamente la explosion que la Fase 1 evito
--  haciendo la rejilla DISPERSA, y aqui seria peor, porque un descuento por
--  volumen que falta no se nota --se cobra de mas y el cliente reclama-- pero
--  uno capturado en la combinacion equivocada tampoco: se aplica donde nadie
--  lo decidio.
--
--  Por que NO «a secas por organizacion»: porque **50 spots y 50 meses no son
--  la misma compra**. Una escala sin unidad regalaria el tramo pensado para los
--  spots a un contrato de cuatro anos. La unidad no es una dimension opcional:
--  es lo que hace que el numero 50 signifique algo.
--
--  El repositorio ya tiene el precedente de los dos lados, y la diferencia
--  decide: la TARIFA es un dato de la pantalla y vive con ella
--  (`sitio_modalidades`, y desde el 28/09 `sitio_tarifas`); el TECHO DE
--  DESCUENTO es una politica comercial del dueno y vive en `config_negocio`
--  (20260928_tope_descuento_propuestas.sql). Un descuento por volumen es lo
--  segundo: es lo que esta casa concede a quien compra mucho, no una propiedad
--  de un poste.
--
--  LO QUE SE DEJA FUERA A PROPOSITO, y esta preguntado al dueno: la anulacion
--  POR PANTALLA («esta pantalla premium no entra en la escala»). Se deja fuera
--  porque es aditiva mas tarde --una columna `sitio_id` nullable, el mismo
--  indice con COALESCE que uso la Fase 1, y un peldano mas en la resolucion--
--  y en cambio quitarla despues es imposible sin decidir que pasa con lo ya
--  capturado. La regla nace cerrada y se abre a proposito.
--
--  2 · LOS TRAMOS SON PLANOS, NO ESCALONADOS.
--
--  «A partir de 50 spots, 10 % sobre TODO» -- no «los primeros 10 a precio
--  lleno, del 11 al 50 al 5 %...». Tres motivos, y el tercero es el que se ve
--  en este archivo:
--
--   1. Es la frase que un dueno de medios ya tiene escrita en su tarifario. Es
--      el mismo argumento con el que el ADR 0039 descarto los multiplicadores:
--      se negocia con precios que se pueden senalar, no con cuentas.
--   2. Un tramo marginal produce una tarifa unitaria MEZCLADA que no es ningun
--      numero del tarifario. El snapshot congela `tarifaUnitaria` para que el
--      reporte compare publicada contra neta: congelaria un promedio que nadie
--      decidio y que no se puede explicar seis meses despues.
--   3. Y EL DECISIVO PARA EL ESQUEMA: en una escala plana, el «solape» es
--      exactamente **el umbral repetido**, asi que lo prohibe un
--      `unique (tenant_id, unidad, desde_cantidad)` -- una restriccion de la
--      BASE, que nadie puede olvidar en el siguiente camino de escritura.
--      Escalonado son RANGOS, y prohibir su solape volveria a necesitar logica
--      de aplicacion como la de las franjas (`lib/rejilla.ts`), que es
--      justamente lo que aquella migracion dejo escrito como su punto flojo.
--
--  LO QUE CUESTA, dicho con todas las letras: el ESCALON. Quien compra 49 paga
--  mas que quien compra 50. Es el comportamiento estandar de un tarifario por
--  volumen, y la pantalla de captura lo dice con esas palabras, pero es una
--  consecuencia real y no un detalle.
--
--  ═══ POR QUE LAS COLUMNAS DEL ITEM GUARDAN NUMEROS Y NO UNA FK ════════════
--
--  `propuesta_items.franja_id` es una FK compuesta con `on delete restrict`
--  porque una franja CONTRATADA es un hecho que el vendedor eligio y que hay
--  que poder renombrar sin perder la referencia. Un tramo de volumen es lo
--  contrario: **nadie lo elige**, se DEDUCE de la cantidad y de la politica
--  vigente el dia de la captura. Lo que importa de el no es su identidad, son
--  sus numeros.
--
--  Por eso el item copia `descuento_volumen_pct` y `volumen_desde` en vez de
--  apuntar a la fila, y eso compra tres cosas:
--   · Mover la escala manana NO cambia una propuesta ya capturada -- igual que
--     hoy no la cambia mover la tarifa, porque `tarifa_unitaria` tambien se
--     copia al item. El congelado del snapshot al aprobar es la SEGUNDA red.
--   · Borrar un tramo nunca puede quedar bloqueado por una venta. Con FK
--     `restrict`, el primer tramo vendido dejaria la pantalla de configuracion
--     devolviendo un 500 sin explicar nada.
--   · Y por tanto NO hace falta baja logica. Es una columna menos y un estado
--     menos: un `activo` sobre una tabla con unique en el umbral impediria
--     volver a crear el tramo de 50 mientras existiera el de 50 apagado.
--
--  ═══ LO QUE ESTA MIGRACION NO HACE, y hay que saberlo ═════════════════════
--
--  · NO prohibe en la base que la escala sea NO MONOTONA («desde 50 -> 10 %»
--    junto a «desde 100 -> 5 %»). Eso exige mirar las filas hermanas, o sea un
--    trigger o una restriccion diferida, y este repositorio no tiene ninguno.
--    El guardian es `apps/web/lib/volumen.ts` (`motivoTramoInvalido`),
--    declarado UNA vez e importado por el unico camino de escritura, igual que
--    `lib/rejilla.ts` con el solape de franjas. Queda como pregunta abierta
--    para el dueno si se quiere ademas en el esquema.
--  · NO valida `unidad` contra una lista. Mismo criterio que
--    `sitio_modalidades.unidad` y `sitio_tarifas.unidad`, que son `text` a
--    secas; la lista vive en el zod del controller. Y el modo de fallo cae del
--    lado prudente: una unidad mal escrita hace que el tramo NO aplique nunca
--    -- se cobra de mas, que se ve y se corrige.
--  · NO toca `sitio_modalidades`, ni `sitio_tarifas`, ni la rejilla de la
--    Fase 1, ni `config_negocio`.
--  · NO construye codigos promocionales ni paquetes cerrados: son las fases 3
--    y 4 del ADR 0039.
--
--  Transaccional e idempotente.
-- ============================================================================
begin;

-- ─── 1 · LA ESCALA: los tramos de volumen de la organizacion ───────────────
--
-- Una fila = un peldano: «a partir de `desde_cantidad` unidades de `unidad`,
-- baja `descuento_pct` %». El umbral es INCLUSIVO: «a partir de 50» incluye
-- el 50.
--
-- DISPERSA POR DISENO, como la rejilla. Una organizacion sin ninguna fila aqui
-- vende exactamente como ayer; una unidad sin tramos tampoco descuenta.
create table if not exists escalas_volumen (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  -- Sin FK ni enum: `unidad` es `text` en `sitio_modalidades` y en
  -- `sitio_tarifas`, y tres formas de decir lo mismo divergen.
  unidad         text not null,
  desde_cantidad integer not null,
  descuento_pct  numeric(5,2) not null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- «Desde 1» aplicaria a TODA venta de esa unidad: eso no es un descuento por
  -- volumen, es bajar el tarifario entero sin tocar una sola tarifa y sin que
  -- se note en la pantalla de precios. Se prohibe en la base y no solo en la
  -- aplicacion, porque es la clase de fila que alguien mete por psql «para
  -- probar» y se queda.
  constraint escalas_volumen_desde_ck  check (desde_cantidad >= 2),
  -- Estrictamente mayor que 0: un tramo al 0 % es una regla que no hace nada y
  -- que hace creer que si. El 100 se admite --regalar la compra entera es una
  -- decision valida-- y ahi el guard que queda es `PropuestaCeroError`.
  constraint escalas_volumen_pct_ck    check (descuento_pct > 0 and descuento_pct <= 100)
);

-- EL UNIQUE ES LA PROHIBICION DE SOLAPE, y solo lo es porque la escala es
-- PLANA. Dos tramos «desde 50» para la misma unidad son dos precios para la
-- misma compra, y el que ganara dependeria del `order by` que tocara --
-- congelar un precio inexplicable es peor que no congelarlo (mismo
-- razonamiento que las temporadas de la Fase 1).
--
-- No hace falta ningun COALESCE aqui: las tres columnas son NOT NULL, asi que
-- la trampa de PostgreSQL 14 con los NULL de la Fase 1 no aplica. Esta
-- migracion no necesita sintaxis posterior a la 14 en ningun sitio, y por eso
-- NO lleva `-- @pg-min`.
create unique index if not exists idx_escalas_volumen_uq
  on escalas_volumen (tenant_id, unidad, desde_cantidad);
-- La lectura real es «dame los tramos de esta organizacion, por unidad, de
-- menor a mayor umbral»: el unique ya la sirve entera, asi que no se anade un
-- segundo indice con las mismas columnas.

drop trigger if exists trg_escalas_volumen_upd on escalas_volumen;
create trigger trg_escalas_volumen_upd before update on escalas_volumen
  for each row execute function set_actualizado_en();

comment on table escalas_volumen is
  'VOL-01 (ADR 0039, Fase 2). La escala de descuento por volumen de la organizacion, por unidad de venta. PLANA: al alcanzar `desde_cantidad`, TODAS las unidades bajan `descuento_pct` %. El unique sobre (tenant_id, unidad, desde_cantidad) es la prohibicion de solape. La monotonia --comprar mas nunca descuenta menos-- la exige apps/web/lib/volumen.ts:motivoTramoInvalido, no la base.';

-- ─── 2 · QUE VOLUMEN SE APLICO ─────────────────────────────────────────────
--
-- DEFAULT 0 y NOT NULL, y no NULL = «no se calculo»: aqui el 0 YA significa
-- «sin volumen», y dos formas de decir lo mismo son dos formas de que la
-- lectura se equivoque (mismo criterio que el tope del 28/09 con su 100).
-- Todo lo ya vendido queda en 0, que es la verdad: se vendio sin volumen.
--
-- `precio` NO cambia de significado: sigue siendo el importe de LISTA
-- (`tarifa_unitaria x cantidad`). El volumen se aplica como una capa explicita
-- sobre `bruto`, que es lo que permite que el documento ensene «subtotal de
-- lista -- descuento por volumen -- descuento comercial» en vez de un numero
-- mas bajo sin explicacion. Un importe que no cuadra con su propia
-- multiplicacion se lee como un defecto del sistema.
alter table propuesta_items
  add column if not exists descuento_volumen_pct numeric(5,2) not null default 0;
-- El UMBRAL del tramo que gano. NULL = no gano ninguno. Se guarda ademas del
-- porcentaje porque «10 %» sin decir «por llegar a 50» no se puede auditar:
-- seis meses despues nadie sabra si ese 10 % vino de la escala o de un dedazo.
alter table propuesta_items
  add column if not exists volumen_desde integer;

alter table reservas
  add column if not exists descuento_volumen_pct numeric(5,2) not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'propuesta_items_desc_volumen_ck'
                   and conrelid = 'propuesta_items'::regclass) then
    alter table propuesta_items add constraint propuesta_items_desc_volumen_ck
      check (descuento_volumen_pct >= 0 and descuento_volumen_pct <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'propuesta_items_volumen_desde_ck'
                   and conrelid = 'propuesta_items'::regclass) then
    alter table propuesta_items add constraint propuesta_items_volumen_desde_ck
      check (volumen_desde is null or volumen_desde >= 2);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservas_desc_volumen_ck'
                   and conrelid = 'reservas'::regclass) then
    alter table reservas add constraint reservas_desc_volumen_ck
      check (descuento_volumen_pct >= 0 and descuento_volumen_pct <= 100);
  end if;
end $$;

comment on column propuesta_items.descuento_volumen_pct is
  'VOL-01. El descuento por volumen que le toco a esta linea, en por ciento, CONGELADO el dia de la captura. 0 = sin volumen (todo lo anterior al 2026-09-28 y toda venta que no lo use). Se copia el NUMERO y no una FK a proposito: mover la escala manana no puede cambiar una propuesta ya capturada, ni una venta puede impedir borrar un tramo. El importe `precio` sigue siendo el de LISTA: el volumen se aplica sobre el bruto.';

comment on column propuesta_items.volumen_desde is
  'VOL-01. El umbral del tramo que gano ("a partir de 50"). NULL = no gano ninguno. Va aparte del porcentaje porque un 10 % sin decir de donde salio no se puede auditar.';

comment on column reservas.descuento_volumen_pct is
  'VOL-01. Heredado del propuesta_item al convertir la propuesta en campana. La reserva guarda el precio NETO --que ya lo lleva dentro--, asi que esto es lo que explica por que ese neto no cuadra con tarifa_unitaria x cantidad x (1-descuento) x (1-comision).';

-- ─── 3 · RLS, igual que las tres tablas de la Fase 1 ───────────────────────
--
-- Fail-closed ESTRICTO --sin el `or ... is null` que llevan `tickets`--: sin
-- `app.tenant_id` fijado no se ve ni se escribe nada. Esta tabla decide cuanto
-- dinero se regala en una venta; es tan sensible como `sitio_tarifas`.
--
-- `propuesta_items` y `reservas` ya tienen su politica desde
-- 20260720_hard1_rls_todas_tablas.sql y no se tocan: una columna nueva queda
-- cubierta por la politica de su tabla.
do $$
declare t text;
begin
  foreach t in array array['escalas_volumen'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- ─── 4 · GRANTs al rol de la app ───────────────────────────────────────────
--
-- Explicitos, por el motivo que 20260923_tickets.sql dejo medido en rojo: en
-- produccion las tablas las posee OTRO rol, y el arnes de integracion no ve la
-- diferencia porque crea todo con el propietario. Sin esto la tabla se crea, la
-- migracion sale 0, y despues `spaces_app` no puede leerla -- y ningun error
-- apunta a permisos. Por rol EXISTENTE porque los entornos difieren.
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on escalas_volumen to %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Verificacion ──────────────────────────────────────────────────────────
-- Las dos ultimas filas son las que importan el dia del despliegue: dicen que
-- NADA cambio de precio. La escala nace vacia y ningun item lleva volumen, asi
-- que todo se sigue vendiendo exactamente como ayer.
select 'la tabla escalas_volumen existe' k, count(*)::text v
  from information_schema.tables where table_name = 'escalas_volumen'
union all
select 'escalas_volumen con RLS forzada',
       count(*)::text from pg_class
 where relname = 'escalas_volumen' and relrowsecurity and relforcerowsecurity
union all
select 'las tres columnas nuevas de volumen',
       count(*)::text from information_schema.columns
 where (table_name = 'propuesta_items' and column_name in ('descuento_volumen_pct','volumen_desde'))
    or (table_name = 'reservas' and column_name = 'descuento_volumen_pct')
union all
select 'tramos de volumen (nace vacia: nada cambia de precio)',
       count(*)::text from escalas_volumen
union all
select 'items de propuesta CON volumen aplicado (nace en cero)',
       count(*)::text from propuesta_items where descuento_volumen_pct <> 0;
