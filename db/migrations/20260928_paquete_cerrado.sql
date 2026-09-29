-- @tipo: esquema
-- ============================================================================
--  PAQ-01 · el PAQUETE CERRADO.  ADR 0039, Fase 4.
-- ----------------------------------------------------------------------------
--  «Estas cinco pantallas, prime, un mes: 180 000.» El ultimo escalon de la
--  cadena de precio, y EL UNICO QUE NO ES UN FACTOR:
--
--      tarifa base = f(pantalla, unidad, franja, fecha)      <- Fase 1
--            x  descuento por volumen                        <- Fase 2
--            |       ...O BIEN **PRECIO DE PAQUETE**,        <- esta migracion
--            |          que SUSTITUYE la suma entera
--            x  descuento comercial (con su tope)
--            x  codigo promocional                           <- Fase 3
--            x  (1 - comision de agencia)
--            =  neto
--
--  Las fases 2 y 3 MODIFICAN un precio ya resuelto. Un paquete LO SUSTITUYE, y
--  por eso rompe la aritmetica de todas las capas anteriores y por eso el ADR
--  lo puso el ultimo.
--
--  Aditiva entera. No toca una sola fila existente, no cambia ninguna
--  restriccion existente, no edita ninguna migracion anterior y no toca
--  db/schema.sql. No mueve ni un importe: las tres tablas nacen VACIAS, las
--  cinco columnas de `propuestas` nacen en NULL / false --que es «sin
--  paquete»-- y la de `reservas` nace en NULL. Todo lo vendido hasta hoy se
--  sigue calculando digito por digito como ayer.
--
--  ═══ LAS TRES DECISIONES DE DISENO, con el motivo escrito ═════════════════
--
--  1 · UN PAQUETE ES UNA PLANTILLA DEL CATALOGO, NO UNA COTIZACION SUELTA.
--
--  Las dos opciones eran: una entidad reutilizable («Paquete Periferico», se
--  aplica a muchas propuestas) o un precio cerrado tecleado en una propuesta
--  concreta. Se elige LA ENTIDAD, y es el mismo camino que la Fase 1 tomo con
--  la temporada y la Fase 2 con `escalas_volumen`.
--
--  Por que NO el precio suelto: porque ESO YA EXISTE. Un vendedor que quiere
--  cerrar una propuesta en 180 000 teclea el descuento comercial que haga
--  falta. Una fase entera para escribir el mismo numero de otra forma no
--  entrega nada, y ademas lo entregaria por el lado equivocado: el precio
--  saldria del navegador, que es el hallazgo B40 --hoy se cierra una venta de
--  prime a 1 peso con un `curl`-- ampliado a la venta entera.
--
--  Por que SI la entidad, con tres consecuencias que se ganan de golpe:
--   · El precio del paquete sale de la BASE, bajo RLS, y no del cuerpo de la
--     peticion. Es el mismo candado que la Fase 2 le puso al volumen.
--   · La bandera «admite codigo» es POR PAQUETE (regla 2 del ADR), y una
--     bandera solo puede colgar de algo que exista.
--   · «Paquete Periferico» es una frase del oficio de un dueno de medios, que
--     es exactamente el argumento con el que el ADR 0039 descarto los
--     multiplicadores: se negocia con cosas que se pueden nombrar.
--
--  LO QUE CUESTA: hay que capturar el paquete antes de poder venderlo. Un trato
--  cerrado a la carrera por telefono no se puede cotizar sin pasar por el
--  catalogo. Es deliberado: ese es el mismo camino por el que hoy se puede
--  regalar el 90 %, y el tope del 28/09 nacio para cerrarlo.
--
--  2 · EL PAQUETE APLICA A LA PROPUESTA ENTERA, O NO APLICA.
--
--  No hay lineas «dentro» y lineas «fuera» del paquete. El ADR dice que el
--  precio del paquete «SUSTITUYE la suma entera», y entera es entera.
--
--  Por que: una propuesta mixta obligaria a marcar linea por linea que entra en
--  el conjunto, a repartir el precio solo entre esas, y a que el tope, el
--  volumen y el cupon supieran distinguir las dos mitades. Son cuatro sitios
--  mas donde una linea puede quedar del lado que no era, y ese fallo no da
--  error: produce un importe plausible. Un trato mixto se cotiza hoy con dos
--  propuestas, que ademas es como se firma.
--
--  LO QUE CUESTA, con todas las letras: no se puede vender «el paquete mas una
--  pantalla suelta» en un solo documento. Esta PREGUNTADO al dueno.
--
--  3 · EL PRECIO SE REPARTE ENTRE LAS PANTALLAS, A PRORRATA DE SU LISTA.
--
--  Hay que repartirlo: el reporte de rentabilidad atribuye ingreso POR PANTALLA
--  (`reservas.precio`) y el contrato del arrendador cuelga de cada una. Un
--  paquete cuyo precio se quedara en la cabecera dejaria cinco pantallas con
--  ingreso cero y una renta que pagar -- cinco lineas en perdida en el reporte
--  que se ensena en el Summit.
--
--  A prorrata y no a partes iguales porque a partes iguales una pantalla de
--  prime de 500 000 y una de barrio de 5 000 recibirian lo mismo, y el reporte
--  diria que la de barrio es un negocio redondo con un numero que lo invento el
--  reparto, no la venta.
--
--  Y la suma de las partes da el precio del paquete EXACTAMENTE, por el metodo
--  del mayor resto. Ver `apps/web/lib/paquete.ts`, que es donde vive la
--  aritmetica y su demostracion.
--
--  ═══ REGLA 2 DEL ADR: EL PAQUETE ES PRECIO FINAL ══════════════════════════
--
--  Por omision no admite nada encima: ni volumen --su precio ya lo lleva
--  dentro-- ni codigo promocional. `admite_codigo` NACE EN `false` y se abre a
--  proposito, por paquete. Mismo criterio que el tope de descuento del 28/09:
--  la regla nace cerrada.
--
--  El descuento comercial SI se sigue aplicando encima, y esta PREGUNTADO al
--  dueno. El motivo de que se quede: es lo unico que el vendedor negocia, ya
--  esta acotado por el tope de la organizacion, y quitarlo dejaria una venta de
--  paquete sin ningun margen de cierre.
--
--  ═══ REGLA 3 DEL ADR: CADA EMPRESA PONE LAS SUYAS ═════════════════════════
--
--  Las tres tablas nacen con `tenant_id`, RLS `enable` + `force`, y la politica
--  cerrada por los DOS lados (`using` para leer, `with check` para escribir).
--  Y aqui la fuga tendria la forma mas cara de las cuatro fases: un paquete que
--  se ve desde otra organizacion no es una fuga de lectura, es que se le puede
--  poner precio a una venta con el tarifario de otra empresa.
--
--  ═══ REGLA 4 DEL ADR: SE CONGELA AL APROBAR ══════════════════════════════
--
--  Y aqui mas que en ninguna. `propuestas` se queda con el NOMBRE, el PRECIO,
--  la BANDERA, el MOMENTO y la COMPOSICION --que pantallas lo formaban-- en sus
--  propias columnas, copiados al aplicar. A partir de ese instante la venta no
--  depende del paquete: cambiarlo, desactivarlo o borrarlo manana no la mueve.
--  El snapshot lo vuelve a congelar al aprobar. Dos redes, igual que el cupon.
-- ============================================================================

begin;

-- ─── 1 · EL CATALOGO DE PAQUETES ───────────────────────────────────────────
create table if not exists paquetes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  nombre         text not null,
  -- EL PRECIO DEL CONJUNTO. Es lo que sustituye la suma de las listas.
  --
  -- `numeric(14,2)` para ser del mismo tipo que `propuesta_items.precio` y
  -- `reservas.precio` --mezclar escalas en la misma cuenta es como aparecen los
  -- centavos que nadie sabe de donde salen--, pero con un CHECK que lo obliga a
  -- ser un ENTERO de pesos: el reparto entre las pantallas es en pesos enteros
  -- y un centavo repartido entre cinco no se puede explicar.
  precio_cerrado numeric(14,2) not null,
  -- REGLA 2 DEL ADR 0039. Nace APAGADA. Encenderla es una decision por paquete.
  admite_codigo  boolean not null default false,
  activo         boolean not null default true,
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint paquetes_precio_ck
    check (precio_cerrado > 0 and precio_cerrado = trunc(precio_cerrado)),
  constraint paquetes_nombre_ck
    check (length(btrim(nombre)) between 1 and 120)
);

-- EL UNIQUE VA SOBRE `lower(nombre)`, indice de EXPRESION como el de la Fase 3
-- sobre `upper(codigo)` y como `usuarios_email_lower_uidx`. Dos paquetes que se
-- llaman «Periferico» y «PERIFERICO» son dos precios para lo que quien vende
-- lee como una sola cosa, y al elegirlo de una lista no se ve la diferencia.
-- PostgreSQL 14 sin nada especial.
create unique index if not exists idx_paquetes_nombre_uq
  on paquetes (tenant_id, lower(btrim(nombre)));

drop trigger if exists trg_paquetes_upd on paquetes;
create trigger trg_paquetes_upd before update on paquetes
  for each row execute function set_actualizado_en();

comment on table paquetes is
  'PAQ-01 (ADR 0039, Fase 4). Los paquetes cerrados de la organizacion: un conjunto de pantallas con un precio del conjunto que SUSTITUYE la suma de sus tarifas de lista. No es un factor como el volumen o el cupon.';
comment on column paquetes.precio_cerrado is
  'PAQ-01. El precio del CONJUNTO, en pesos enteros. Sustituye la suma de las listas; no la modifica. Entero a proposito: se reparte entre las pantallas y un centavo repartido no se puede explicar.';
comment on column paquetes.admite_codigo is
  'PAQ-01, regla 2 del ADR 0039. Si este paquete admite ADEMAS un codigo promocional encima. NACE EN false: un paquete es precio final salvo que alguien decida lo contrario para ese paquete. El descuento por volumen NUNCA se aplica sobre un paquete, ni con esta bandera encendida.';

-- ─── 2 · DE QUE PANTALLAS SE COMPONE ───────────────────────────────────────
--
-- Sin esta tabla un paquete seria «un nombre y un precio», y aplicarlo a dos
-- pantallas cualesquiera por 180 000 seria legal. La composicion es lo que hace
-- que «Paquete Periferico» signifique algo y lo que permite avisar cuando una
-- propuesta ya cotizada deja de cuadrar con el.
create table if not exists paquete_sitios (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  paquete_id uuid not null,
  sitio_id   uuid not null,
  creado_en  timestamptz not null default now()
);

-- La misma pantalla no puede estar dos veces en el mismo paquete: contaria dos
-- veces en el reparto y se llevaria doble ingreso en el reporte.
create unique index if not exists idx_paquete_sitios_uq
  on paquete_sitios (paquete_id, sitio_id);
create index if not exists idx_paquete_sitios_sitio
  on paquete_sitios (sitio_id, tenant_id);

-- ─── 3 · QUE PAQUETE SE APLICO A QUE PROPUESTA ─────────────────────────────
--
-- El ENLACE VIVO, y vive aparte de `propuestas` a proposito -- exactamente como
-- `canjes_codigo` de la Fase 3, y por la misma razon. Aqui estan las FK
-- COMPUESTAS con el tenant y el `on delete cascade`; en `propuestas` esta el
-- PRECIO CONGELADO, que no se va con nada.
--
-- Asi, borrar un paquete se lleva por delante su enlace y NO mueve un peso de
-- ninguna propuesta: el precio ya no esta en el paquete, esta en la propuesta.
-- Es el invariante 4 del ADR 0039 y lo que decide si esta fase esta bien hecha.
create table if not exists paquete_aplicaciones (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  paquete_id   uuid not null,
  propuesta_id uuid not null,
  -- QUIEN lo aplico. Sale de la SESION, nunca del cuerpo de la peticion, igual
  -- que el vendedor de VEND-01 y que el canje de COD-01.
  usuario_id   uuid references usuarios(id) on delete set null,
  aplicado_en  timestamptz not null default now()
);

-- UN SOLO PAQUETE POR PROPUESTA, y es una restriccion de la BASE porque contra
-- un doble clic no sirve ninguna validacion de aplicacion. Dos paquetes en la
-- misma venta serian dos precios finales para el mismo documento.
create unique index if not exists idx_paquete_aplicaciones_propuesta_uq
  on paquete_aplicaciones (propuesta_id);
create index if not exists idx_paquete_aplicaciones_paquete
  on paquete_aplicaciones (paquete_id, tenant_id);

-- Las FK COMPUESTAS. La RLS ya lo impediria; esto es lo que queda en pie el dia
-- que alguien conecte con un rol que la salte, y sin ello una propuesta podria
-- quedar cotizada con el paquete de otra organizacion (R2) -- que en esta fase
-- no es una fuga de lectura, es ponerle a una venta el tarifario de otra
-- empresa.
--
-- `sitios_id_tenant_uq` no existia y se anade aqui: sin el, la FK de
-- `paquete_sitios` solo podria apuntar al `id` y un paquete podria declararse
-- con la pantalla de otra organizacion. Mismo recurso que
-- `entidades_fiscales_id_tenant_uq` (20260918) y `franjas_horarias_id_tenant_uq`
-- (Fase 1). Es un unique ADICIONAL sobre una clave primaria que ya es unica:
-- no cambia ninguna fila ni rechaza nada que hoy se acepte.
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'sitios_id_tenant_uq'
                    and conrelid = 'sitios'::regclass) then
    alter table sitios add constraint sitios_id_tenant_uq unique (id, tenant_id);
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'paquetes_id_tenant_uq'
                    and conrelid = 'paquetes'::regclass) then
    alter table paquetes add constraint paquetes_id_tenant_uq unique (id, tenant_id);
  end if;
  -- Ya la anade 20260928_codigo_promocional.sql, que corre ANTES por orden
  -- lexicografico ('c' < 'p'). Se repite con guarda porque una migracion que
  -- depende de que otra se haya aplicado sin decirlo es como se rompe una base
  -- nueva, y repetirla no cuesta nada.
  if not exists (select 1 from pg_constraint
                  where conname = 'propuestas_id_tenant_uq'
                    and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_id_tenant_uq unique (id, tenant_id);
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'paquete_sitios_paquete_fkey'
                    and conrelid = 'paquete_sitios'::regclass) then
    alter table paquete_sitios add constraint paquete_sitios_paquete_fkey
      foreign key (paquete_id, tenant_id)
      references paquetes (id, tenant_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'paquete_sitios_sitio_fkey'
                    and conrelid = 'paquete_sitios'::regclass) then
    -- `restrict` y no `cascade`: borrar una pantalla no puede vaciar en
    -- silencio la definicion de un paquete que se esta vendiendo. Es la misma
    -- politica que `propuesta_items.sitio_id`.
    alter table paquete_sitios add constraint paquete_sitios_sitio_fkey
      foreign key (sitio_id, tenant_id)
      references sitios (id, tenant_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'paquete_aplicaciones_paquete_fkey'
                    and conrelid = 'paquete_aplicaciones'::regclass) then
    alter table paquete_aplicaciones add constraint paquete_aplicaciones_paquete_fkey
      foreign key (paquete_id, tenant_id)
      references paquetes (id, tenant_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'paquete_aplicaciones_propuesta_fkey'
                    and conrelid = 'paquete_aplicaciones'::regclass) then
    alter table paquete_aplicaciones add constraint paquete_aplicaciones_propuesta_fkey
      foreign key (propuesta_id, tenant_id)
      references propuestas (id, tenant_id) on delete cascade;
  end if;
end $$;

comment on table paquete_sitios is
  'PAQ-01 (ADR 0039, Fase 4). De que pantallas se compone cada paquete. Es lo que hace que un paquete signifique algo mas que un nombre y un precio, y lo que permite avisar cuando una propuesta ya cotizada deja de cuadrar con su paquete.';
comment on table paquete_aplicaciones is
  'PAQ-01 (ADR 0039, Fase 4). El enlace VIVO entre una propuesta y el paquete que se le aplico: quien, cuando, cual. Se va en cascada si el paquete se borra. Lo que NO se va es el precio, que vive en las columnas de `propuestas`: borrar un paquete no mueve un peso de ninguna venta.';

-- ─── 4 · EL PRECIO CONGELADO, EN LA PROPUESTA ──────────────────────────────
--
-- ESTAS CINCO COLUMNAS SON EL CONGELADO, y ningun otro sitio lo es. Las lee la
-- cadena economica entera (`armarPropuesta`, el snapshot, la liga publica, la
-- campana). Se copian al APLICAR el paquete y el snapshot las vuelve a congelar
-- al APROBAR sin releer `paquetes`. Dos redes.
alter table propuestas
  add column if not exists paquete_nombre text;
alter table propuestas
  add column if not exists paquete_precio numeric(14,2);
-- La bandera TAMBIEN se congela, y no es un detalle: decide si un cupon
-- descuenta o no. Si se leyera del catalogo, encenderla manana cambiaria el
-- total de una venta que ya se cotizo sin que nadie la tocara.
alter table propuestas
  add column if not exists paquete_admite_codigo boolean not null default false;
alter table propuestas
  add column if not exists paquete_aplicado_en timestamptz;
-- QUE PANTALLAS LO FORMABAN el dia en que se aplico. Lo exige el invariante 4
-- del ADR con todas las letras, y es lo que permite responder a la tercera
-- pregunta de la fase: si manana se quita una pantalla de la propuesta, esto
-- sigue diciendo con cuantas se cotizo y el sistema puede avisarlo.
--
-- `jsonb` con un arreglo de uuid en texto, y no una tabla mas: es un HECHO
-- congelado, no un dato vivo. Una tabla invitaria a editarlo, que es
-- exactamente lo que no puede pasar. Mismo criterio que `snapshot_economico`.
alter table propuestas
  add column if not exists paquete_composicion jsonb;

-- La reserva guarda el precio NETO, que ya sale del reparto del paquete. Sin
-- esta columna, la ficha de la campana ensenaria una cuenta que no da --
-- `tarifa x cantidad x (1-volumen) x (1-descuento) x (1-comision)` no llegaria
-- ni de lejos al importe-- y eso se lee como un defecto del sistema. Mismo
-- motivo por el que la Fase 2 anadio aqui `descuento_volumen_pct` y la 3
-- `codigo_descuento_pct`. NULL = esta reserva no vino de un paquete.
alter table reservas
  add column if not exists paquete_parte numeric(14,2);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'propuestas_paquete_precio_ck'
                   and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_paquete_precio_ck
      check (paquete_precio is null
          or (paquete_precio > 0 and paquete_precio = trunc(paquete_precio)));
  end if;
  -- EL BLOQUE VIAJA JUNTO O NO VIAJA, igual que la pareja del cupon. Un precio
  -- sin nombre es un importe que nadie puede auditar --seis meses despues nadie
  -- sabra de que paquete salio-- y un nombre sin precio es un paquete que se
  -- aplico y no hizo nada. Las dos son filas que se escriben cuando alguien
  -- toca UNA columna y se olvida de las otras.
  --
  -- `paquete_admite_codigo` queda FUERA del check a proposito: es `not null
  -- default false`, asi que sin paquete siempre vale `false`, y meterla haria
  -- que la condicion «sin paquete» dependiera de una columna que no dice nada
  -- cuando no hay paquete.
  if not exists (select 1 from pg_constraint where conname = 'propuestas_paquete_pareja_ck'
                   and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_paquete_pareja_ck
      check ((paquete_nombre is null     and paquete_precio is null
                                         and paquete_aplicado_en is null
                                         and paquete_composicion is null)
          or (paquete_nombre is not null and paquete_precio is not null
                                         and paquete_aplicado_en is not null
                                         and paquete_composicion is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservas_paquete_parte_ck'
                   and conrelid = 'reservas'::regclass) then
    alter table reservas add constraint reservas_paquete_parte_ck
      check (paquete_parte is null or paquete_parte >= 0);
  end if;
end $$;

comment on column propuestas.paquete_nombre is
  'PAQ-01. El paquete aplicado a esta propuesta, CONGELADO el dia en que se aplico. NULL = sin paquete (todo lo anterior al 2026-09-28). Se copia el NOMBRE y no solo la FK a proposito: borrar el paquete manana no puede cambiar lo que un cliente ya acepto.';
comment on column propuestas.paquete_precio is
  'PAQ-01. El precio cerrado del conjunto, CONGELADO. SUSTITUYE la suma de las tarifas de lista de los items; no la modifica. Sobre el se aplican el descuento comercial y la comision, y --solo si paquete_admite_codigo-- el codigo promocional. El volumen NUNCA.';
comment on column propuestas.paquete_admite_codigo is
  'PAQ-01, regla 2 del ADR 0039, CONGELADA. Si esta venta admite un codigo promocional ADEMAS del paquete. false = el paquete es precio final. Se congela porque decide dinero: leerla del catalogo haria que encenderla manana cambiara el total de una venta ya cotizada.';
comment on column propuestas.paquete_composicion is
  'PAQ-01. Arreglo jsonb con los sitio_id que formaban el paquete el dia en que se aplico. Es lo que permite avisar --sin mover el precio-- cuando la propuesta deja de tener esas pantallas. Invariante 4 del ADR 0039: el snapshot tiene que decir CON QUE PANTALLAS se cotizo.';
comment on column reservas.paquete_parte is
  'PAQ-01. La parte del precio cerrado del paquete que le toco a esta pantalla, antes del descuento comercial y de la comision. NULL = esta reserva no vino de un paquete. Es lo que explica por que `precio` no cuadra con la multiplicacion de la tarifa de lista.';

-- ─── 5 · RLS, igual que las tablas de las Fases 1, 2 y 3 ───────────────────
--
-- Fail-closed ESTRICTO --sin el `or ... is null` que llevan `tickets`--: sin
-- `app.tenant_id` fijado no se ve ni se escribe nada, por los DOS lados
-- (`using` para leer, `with check` para escribir). Lo exige la regla 3 del ADR
-- 0039, dictada por el dueno el 2026-09-28.
--
-- `propuestas` y `reservas` ya tienen su politica desde
-- 20260720_hard1_rls_todas_tablas.sql y no se tocan: una columna nueva queda
-- cubierta por la politica de su tabla.
do $$
declare t text;
begin
  foreach t in array array['paquetes','paquete_sitios','paquete_aplicaciones'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- ─── 6 · GRANTs al rol de la app ───────────────────────────────────────────
--
-- Explicitos, por el motivo que 20260923_tickets.sql dejo medido en rojo: en
-- produccion las tablas las posee OTRO rol, y el arnes de integracion no ve la
-- diferencia porque crea todo con el propietario. Sin esto la tabla se crea, la
-- migracion sale 0, y despues `spaces_app` no puede leerla -- y ningun error
-- apunta a permisos. Por rol EXISTENTE porque los entornos difieren.
do $$
declare r text; t text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      foreach t in array array['paquetes','paquete_sitios','paquete_aplicaciones'] loop
        execute format('grant select, insert, update, delete on %I to %I', t, r);
      end loop;
    end if;
  end loop;
end $$;

commit;

-- ─── Verificacion ──────────────────────────────────────────────────────────
-- Las dos ultimas filas son las que importan el dia del despliegue: dicen que
-- NADA cambio de precio. Las tres tablas nacen vacias y ninguna propuesta lleva
-- paquete, asi que todo se sigue vendiendo exactamente como ayer.
select 'las tres tablas nuevas existen' k, count(*)::text v
  from information_schema.tables
 where table_name in ('paquetes','paquete_sitios','paquete_aplicaciones')
union all
select 'las tres tablas nuevas con RLS forzada',
       count(*)::text from pg_class
 where relname in ('paquetes','paquete_sitios','paquete_aplicaciones')
   and relrowsecurity and relforcerowsecurity
union all
select 'las seis columnas nuevas de paquete',
       count(*)::text from information_schema.columns
 where (table_name = 'propuestas' and column_name in
          ('paquete_nombre','paquete_precio','paquete_admite_codigo',
           'paquete_aplicado_en','paquete_composicion'))
    or (table_name = 'reservas' and column_name = 'paquete_parte')
union all
select 'la bandera admite_codigo nace apagada',
       column_default from information_schema.columns
 where table_name = 'paquetes' and column_name = 'admite_codigo'
union all
select 'el unique del nombre va sobre lower()',
       count(*)::text from pg_indexes
 where indexname = 'idx_paquetes_nombre_uq' and indexdef ilike '%lower%'
union all
select 'un solo paquete por propuesta',
       count(*)::text from pg_indexes
 where indexname = 'idx_paquete_aplicaciones_propuesta_uq'
union all
select 'paquetes capturados (nace vacia: nada cambia de precio)',
       count(*)::text from paquetes
union all
select 'propuestas CON paquete aplicado (nace en cero)',
       count(*)::text from propuestas where paquete_precio is not null;
