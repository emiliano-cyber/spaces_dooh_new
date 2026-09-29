-- @tipo: esquema
-- ============================================================================
--  COD-01 · CÓDIGO PROMOCIONAL con vencimiento y tope de usos.
--  ADR 0039, Fase 3.
-- ----------------------------------------------------------------------------
--  «Usa este codigo y ten un 20 % adicional.» El escalon de la cadena de precio
--  que va DESPUES del descuento comercial y ANTES de la comision de agencia:
--
--      tarifa base = f(pantalla, unidad, franja, fecha)      <- Fase 1
--            x  descuento por volumen                        <- Fase 2
--            x  descuento comercial (con su tope)
--            x  CODIGO PROMOCIONAL                           <- esta migracion
--            x  (1 - comision de agencia)
--            =  neto
--
--  Aditiva entera. No toca una sola fila existente, no cambia ninguna
--  restriccion existente, no edita ninguna migracion anterior y no toca
--  db/schema.sql. No mueve ni un importe: las dos tablas nacen VACIAS y las
--  cuatro columnas nuevas nacen en 0 / NULL, que es «sin codigo», que es como
--  se vendio todo hasta hoy.
--
--  ═══ LO QUE HACE DISTINTO A ESTE ESCALON ══════════════════════════════════
--
--  Es EL UNICO DE LOS CUATRO QUE LE PROMETE ALGO A ALGUIEN DE FUERA DE LA
--  CASA. Una escala de volumen es una regla interna: si manana cambia, nadie
--  fuera se entera. Un cupon se le DICE a un cliente, y a partir de ahi el
--  sistema tiene que poder sostener esa frase.
--
--  De ahi salen las dos propiedades que un cupon tiene y el volumen no: VENCE
--  y SE AGOTA. Y las dos son, literalmente, un reloj y un contador -- dos
--  cosas que no pueden vivir en el navegador de quien vende (hallazgo B40).
--  Por eso esta fase parte en dos lo que la Fase 2 tenia junto: las REGLAS en
--  `apps/web/lib/codigo-promocional.ts` (puro) y los DATOS que las alimentan
--  --`current_date` y el conteo de canjes-- en Postgres, leidos con la fila del
--  cupon BLOQUEADA.
--
--  ═══ LAS CUATRO DECISIONES DE DISENO, con el motivo escrito ═══════════════
--
--  1 · EL CANJE SE CUENTA AL APLICAR EL CODIGO, NO AL APROBAR LA PROPUESTA.
--
--  Las dos opciones tienen un coste y no es el mismo. Contar al APLICAR hace
--  que una propuesta que nunca se cierra se coma un uso. Contar al APROBAR
--  hace que dos vendedores apliquen el ultimo uso a la vez, le prometan los dos
--  el descuento a su cliente, y uno de los dos se lo tenga que quitar al
--  firmar.
--
--  Se elige APLICAR, y el motivo es el de la primera seccion: **un cupon es lo
--  unico de esta cadena que se le promete a alguien de fuera**. El momento en
--  que se hace la promesa es el momento en que se teclea el codigo, asi que es
--  ahi donde el sistema tiene que poder decir «si» o «no». Un «si» que despues
--  se convierte en «no» no se arregla con una nota de credito.
--
--  El coste --el uso que se come una propuesta abandonada-- se paga y se
--  mitiga: quitar el codigo de la propuesta BORRA el canje y devuelve el uso,
--  y borrar la propuesta tambien (por `on delete cascade`). O sea que el uso
--  solo se queda retenido mientras la propuesta siga viva con el codigo
--  puesto, que es exactamente mientras la promesa siga en pie.
--
--  2 · EL CONTADOR DE USOS NO EXISTE COMO COLUMNA: SE CUENTAN LOS CANJES.
--
--  No hay `usos_consumidos` en `codigos_promocionales`. El numero de usos es
--  `count(*)` sobre `canjes_codigo`, y punto. Una columna contador ADEMAS del
--  registro de canjes serian dos respuestas a la misma pregunta, y el dia que
--  discrepen nadie sabra cual es la buena -- que es el vicio que este
--  repositorio persigue por todas partes.
--
--  Y no es solo higiene: un contador se DESINCRONIZA de verdad por caminos que
--  nadie ve. Un `on delete cascade` desde `propuestas` borraria la fila de
--  canje sin decrementar nada, y el cupon quedaria agotado para siempre con
--  cero canjes vivos. Contando filas eso no puede pasar por construccion.
--
--  3 · LA CARRERA DEL ULTIMO USO LA RESUELVE LA BASE, NO LA APLICACION.
--
--  Dos vendedores canjeando el ultimo uso a la vez es una carrera real, y
--  «leer el conteo, comprobarlo y luego insertar» la PIERDE siempre: los dos
--  leen N-1 y los dos insertan. La resuelve un `select ... for update` sobre la
--  fila del CUPON antes de contar (`codigos-repo.ts:canjearCodigo`). El segundo
--  se queda esperando en esa linea, y cuando el primero confirma, vuelve a
--  contar y ya ve el canje nuevo.
--
--  El `unique (propuesta_id)` de abajo es la SEGUNDA red, y cubre otra cosa: el
--  mismo codigo aplicado dos veces a la MISMA propuesta. Esa no es una carrera
--  entre personas, es un doble clic, y contra un doble clic lo unico que sirve
--  es una restriccion de la base.
--
--  4 · LA PROPUESTA GUARDA NUMEROS; EL CANJE GUARDA EL HECHO. Y NO SE REPITEN.
--
--  `propuestas.codigo_texto` y `propuestas.codigo_descuento_pct` son el PRECIO
--  congelado: es lo que lee toda la cadena economica. `canjes_codigo` es el
--  HECHO --quien, cuando, en que propuesta, contra que cupon-- y es lo que se
--  cuenta. El porcentaje esta en UN solo sitio a proposito: si estuviera en los
--  dos, el dia que discrepen habria dos precios para la misma venta.
--
--  Por eso al BORRAR un cupon la fila de canje se va con el (`cascade`) y las
--  columnas de la propuesta NO SE MUEVEN: el presupuesto deja de existir, asi
--  que contar contra el deja de tener sentido, pero el precio que el cliente
--  acepto sigue siendo el que era. Es el invariante 3 del ADR 0039 y hay una
--  prueba que lo exige, en unitarias y en e2e.
--
--  ═══ LO QUE ESTA MIGRACION NO HACE, y hay que saberlo ═════════════════════
--
--  · NO arregla el hallazgo B40. La `tarifa_unitaria` de la Fase 1 sigue
--    llegando del navegador; esta fase no lo amplia -- el porcentaje del cupon
--    NUNCA entra por el cuerpo de la peticion, solo el codigo tecleado.
--  · NO prohibe en la base que un cupon se cree ya vencido. Es legitimo
--    capturar la promocion de diciembre en octubre, y «ya vencido» es solo el
--    caso en que las dos fechas quedaron atras; el canje lo rechaza igual.
--  · NO limita cuantos cupones puede tener una organizacion.
--  · NO admite mas de UN codigo por propuesta. Es el `unique (propuesta_id)`.
--    Dos cupones compuestos en una venta es una decision de negocio que nadie
--    ha pedido, y abrirla despues es aditivo; cerrarla despues, no.
--  · NO construye paquetes cerrados: es la Fase 4 del ADR 0039.
--
--  ═══ POSTGRESQL 14 ════════════════════════════════════════════════════════
--  Nada de sintaxis posterior a la 14. El unico indice de expresion es
--  `upper(codigo)`, que existe desde siempre y que este repositorio ya usa en
--  `usuarios_email_lower_uidx`. Por eso NO lleva `-- @pg-min`.
--
--  Transaccional e idempotente.
-- ============================================================================
begin;

-- ─── 1 · EL CATALOGO DE CUPONES DE LA ORGANIZACION ─────────────────────────
--
-- DISPERSA POR DISENO, como la rejilla y como la escala de volumen: una
-- organizacion sin filas aqui vende exactamente como ayer.
create table if not exists codigos_promocionales (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  -- El codigo TAL Y COMO LO CAPTURO EL DUENO. Se guarda con su capitalizacion
  -- --es lo que el imprime en su publicidad-- y se COMPARA en mayusculas.
  codigo         text not null,
  descuento_pct  numeric(5,2) not null,
  -- Los dos extremos son INCLUSIVOS. Quien configura «hasta el 30» espera
  -- poder canjear el 30; mismo criterio que el tope de descuento del 28/09,
  -- que admite el valor exacto que alguien tecleo.
  vigente_desde  date not null,
  vigente_hasta  date not null,
  -- NULL = SIN TOPE. No es lo mismo que 0, y por eso no hay un default: un
  -- cupon de campana abierta es legitimo, y su freno es la fecha. El 0 se
  -- prohibe abajo porque «se puede usar cero veces» no es un cupon.
  usos_maximos   integer,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- Estrictamente mayor que 0: un cupon al 0 % es una regla que no hace nada y
  -- que hace creer que si -- el cliente teclea el codigo, se lo aceptan, y no
  -- ve bajar el precio. El 100 se admite --regalar la compra entera es una
  -- decision valida-- y ahi el guard que queda es `PropuestaCeroError`.
  constraint codigos_promocionales_pct_ck
    check (descuento_pct > 0 and descuento_pct <= 100),
  constraint codigos_promocionales_vigencia_ck
    check (vigente_hasta >= vigente_desde),
  constraint codigos_promocionales_usos_ck
    check (usos_maximos is null or usos_maximos >= 1),
  -- La forma del codigo se fija en la BASE y no solo en el zod, porque es lo
  -- que se teclea y lo que se busca: un codigo con espacios o con acentos se
  -- captura bien y despues NO se puede canjear, y el fallo aparece en el
  -- cliente, no en quien lo creo.
  constraint codigos_promocionales_codigo_ck
    check (codigo ~ '^[A-Za-z0-9-]{3,32}$')
);

-- EL UNIQUE VA SOBRE `upper(codigo)`, Y ESO ES LO QUE HACE QUE UN CUPON SEA UNA
-- PALABRA Y NO DOS. Un cupon se dice de viva voz o se pega de un correo: nadie
-- teclea `VERANO20` exactamente. Si `verano20` y `VERANO20` pudieran ser dos
-- filas con dos porcentajes, el descuento que recibe un cliente dependeria de
-- como lo escribio -- y seis meses despues nadie sabria cual se aplico.
--
-- Indice de EXPRESION, el mismo recurso que uso la Fase 1 con `COALESCE` para
-- el unique con NULLs y que este repositorio ya tiene en
-- `usuarios_email_lower_uidx`. Compatible con PostgreSQL 14 sin nada especial.
create unique index if not exists idx_codigos_promocionales_uq
  on codigos_promocionales (tenant_id, upper(codigo));

-- Para la FK COMPUESTA de `canjes_codigo`. Mismo motivo que
-- `entidades_fiscales_id_tenant_uq` (20260918) y `franjas_horarias_id_tenant_uq`
-- (Fase 1): sin el, la FK solo puede apuntar al `id`, y un canje podria
-- referenciar el cupon de OTRA organizacion sin que la base dijera nada.
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'codigos_promocionales_id_tenant_uq'
                    and conrelid = 'codigos_promocionales'::regclass) then
    alter table codigos_promocionales
      add constraint codigos_promocionales_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

drop trigger if exists trg_codigos_promocionales_upd on codigos_promocionales;
create trigger trg_codigos_promocionales_upd before update on codigos_promocionales
  for each row execute function set_actualizado_en();

comment on table codigos_promocionales is
  'COD-01 (ADR 0039, Fase 3). Los codigos promocionales de la organizacion, con vigencia y tope de usos. El tope de usos NO se guarda como contador: se cuenta `canjes_codigo`. El unique va sobre upper(codigo) porque un cupon es una palabra, no dos.';
comment on column codigos_promocionales.usos_maximos is
  'COD-01. Cuantas veces se puede canjear EN TOTAL. NULL = sin tope (el freno es la fecha). Nunca 0: un cupon que no se puede usar no es un cupon.';
comment on column codigos_promocionales.vigente_hasta is
  'COD-01. Ultimo dia en que se puede CANJEAR, inclusive. No afecta a lo ya canjeado: un cupon aplicado antes de vencer sigue valiendo al aprobar la propuesta tres dias despues -- ver la cabecera de 20260928_codigo_promocional.sql.';

-- ─── 2 · EL REGISTRO DE CANJES: quien, cuando, en que propuesta ────────────
--
-- ESTA TABLA ES EL CONTADOR. No hay otro. Su `count(*)` por `codigo_id` es lo
-- que se compara contra `usos_maximos`, y por eso el indice de abajo no es un
-- adorno: es la consulta que se hace en cada canje, con la fila del cupon
-- bloqueada y por tanto con todo el mundo esperando detras.
create table if not exists canjes_codigo (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  -- `cascade`: si el cupon se borra, su presupuesto deja de existir y contar
  -- contra el deja de tener sentido. Lo que NO se mueve es el precio de la
  -- propuesta, que vive en sus propias columnas -- ver la decision 4.
  codigo_id    uuid not null,
  propuesta_id uuid not null,
  -- QUIEN lo canjeo. Sale de la SESION, nunca del cuerpo de la peticion, igual
  -- que el vendedor de VEND-01. `set null` al dar de baja a la persona: el
  -- canje sigue siendo un hecho aunque quien lo hizo ya no trabaje aqui.
  usuario_id   uuid references usuarios(id) on delete set null,
  canjeado_en  timestamptz not null default now()
);

-- UN SOLO CODIGO POR PROPUESTA, y es una restriccion de la BASE porque contra
-- un doble clic no sirve ninguna validacion de aplicacion. Es tambien lo que
-- impide que el mismo codigo se cuente dos veces en la misma venta.
create unique index if not exists idx_canjes_codigo_propuesta_uq
  on canjes_codigo (propuesta_id);
-- EL CONTADOR. `count(*) where codigo_id = $1` es la consulta caliente del
-- canje; sin este indice recorreria la tabla entera sosteniendo el bloqueo.
create index if not exists idx_canjes_codigo_codigo
  on canjes_codigo (codigo_id, tenant_id);

-- Las dos FK son COMPUESTAS con el tenant. La RLS ya lo impediria; esto es lo
-- que queda en pie el dia que alguien conecte con un rol que la salte, y sin
-- ello un canje podria gastarle un uso al cupon de otra organizacion (R2).
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'propuestas_id_tenant_uq'
                    and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_id_tenant_uq unique (id, tenant_id);
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'canjes_codigo_codigo_fkey'
                    and conrelid = 'canjes_codigo'::regclass) then
    alter table canjes_codigo add constraint canjes_codigo_codigo_fkey
      foreign key (codigo_id, tenant_id)
      references codigos_promocionales (id, tenant_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'canjes_codigo_propuesta_fkey'
                    and conrelid = 'canjes_codigo'::regclass) then
    alter table canjes_codigo add constraint canjes_codigo_propuesta_fkey
      foreign key (propuesta_id, tenant_id)
      references propuestas (id, tenant_id) on delete cascade;
  end if;
end $$;

comment on table canjes_codigo is
  'COD-01 (ADR 0039, Fase 3). El registro de cada canje: quien, cuando, en que propuesta, contra que cupon. ES EL CONTADOR DE USOS: no existe ninguna columna `usos_consumidos`, y esta tabla es la unica respuesta a «cuantas veces se uso». El canje se cuenta al APLICAR el codigo, no al aprobar la propuesta.';

-- ─── 3 · QUE CODIGO SE APLICO A LA PROPUESTA ───────────────────────────────
--
-- EL PRECIO CONGELADO VIVE AQUI, y en ningun otro sitio. Estas dos columnas
-- son lo que lee la cadena economica entera (`armarPropuesta`, el snapshot, la
-- liga publica, la campana). Se copian al CANJEAR --igual que el item ya
-- copiaba `tarifa_unitaria` y `descuento_volumen_pct`-- y el snapshot las
-- vuelve a congelar al APROBAR sin releer `codigos_promocionales`. Dos redes.
--
-- Y por eso borrar o cambiar el cupon manana NO mueve una propuesta: el
-- porcentaje ya no esta en el cupon, esta aqui.
alter table propuestas
  add column if not exists codigo_texto text;
-- DEFAULT 0 y NOT NULL, y no NULL = «no se calculo»: aqui el 0 YA significa
-- «sin codigo». Todo lo ya vendido queda en 0, que es la verdad.
alter table propuestas
  add column if not exists codigo_descuento_pct numeric(5,2) not null default 0;
-- EL MOMENTO DEL CANJE, y vive AQUI y no solo en `canjes_codigo` a proposito.
--
-- `canjes_codigo` se borra en cascada cuando se borra el cupon, asi que si la
-- fecha viviera solo alli, borrar un cupon le quitaria a una propuesta ya
-- aprobada la mitad de su explicacion -- y lo que el ADR 0039 exige es que
-- borrar el cupon NO MUEVA NADA de la venta. Esta fecha es parte del precio
-- congelado, no del presupuesto del cupon, asi que vive con el precio.
--
-- Y es la que responde a la tercera pregunta con trampa: un cupon aplicado el
-- 30 y aprobado el 3 sigue valiendo, y esta columna es lo que lo demuestra.
alter table propuestas
  add column if not exists codigo_canjeado_en timestamptz;

-- La reserva guarda el precio NETO, que ya lleva el cupon dentro. Sin esta
-- columna, la ficha de la campana ensenaria una cuenta que no da --
-- `tarifa x cantidad x (1-volumen) x (1-descuento) x (1-comision)` no llegaria
-- al importe-- y eso se lee como un defecto del sistema. Mismo motivo por el
-- que la Fase 2 anadio aqui `descuento_volumen_pct`.
alter table reservas
  add column if not exists codigo_descuento_pct numeric(5,2) not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'propuestas_codigo_pct_ck'
                   and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_codigo_pct_ck
      check (codigo_descuento_pct >= 0 and codigo_descuento_pct <= 100);
  end if;
  -- LA PAREJA VIAJA JUNTA O NO VIAJA. Un porcentaje sin su codigo es un
  -- descuento que nadie puede auditar --seis meses despues nadie sabra si ese
  -- 20 % salio de un cupon o de un dedazo-- y un codigo con 0 % es una promesa
  -- que se acepto y no se cumplio. Las dos son filas que se escriben cuando
  -- alguien toca UNA de las dos columnas y se olvida de la otra.
  if not exists (select 1 from pg_constraint where conname = 'propuestas_codigo_pareja_ck'
                   and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_codigo_pareja_ck
      check ((codigo_texto is null     and codigo_descuento_pct = 0
                                       and codigo_canjeado_en is null)
          or (codigo_texto is not null and codigo_descuento_pct > 0
                                       and codigo_canjeado_en is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservas_codigo_pct_ck'
                   and conrelid = 'reservas'::regclass) then
    alter table reservas add constraint reservas_codigo_pct_ck
      check (codigo_descuento_pct >= 0 and codigo_descuento_pct <= 100);
  end if;
end $$;

comment on column propuestas.codigo_texto is
  'COD-01. El codigo promocional aplicado a esta propuesta, CONGELADO el dia del canje. NULL = sin codigo (todo lo anterior al 2026-09-28). Se copia el TEXTO y no solo la FK a proposito: borrar el cupon manana no puede cambiar lo que un cliente ya acepto.';
comment on column propuestas.codigo_descuento_pct is
  'COD-01. El descuento del codigo, en por ciento, CONGELADO el dia del canje. 0 = sin codigo. Se aplica DESPUES del descuento comercial y ANTES de la comision (ADR 0039). Se COMPONE con las otras capas, no se suma.';
comment on column reservas.codigo_descuento_pct is
  'COD-01. Heredado de la propuesta al convertirla en campana. La reserva guarda el precio NETO --que ya lo lleva dentro--, asi que esto es lo que explica por que ese neto no cuadra con la multiplicacion de sus partes.';

-- ─── 4 · RLS, igual que las tablas de las Fases 1 y 2 ──────────────────────
--
-- Fail-closed ESTRICTO --sin el `or ... is null` que llevan `tickets`--: sin
-- `app.tenant_id` fijado no se ve ni se escribe nada, por los DOS lados
-- (`using` para leer, `with check` para escribir). Lo exige la regla 3 del ADR
-- 0039, dictada por el dueno el 2026-09-28: «las promociones las debe de poner
-- cada empresa».
--
-- Y aqui la fuga tendria una forma especialmente fea: un cupon que se ve desde
-- otra organizacion no solo es una fuga de informacion, es que gastarle un uso
-- le agota la promocion a una empresa que no lo autorizo.
--
-- `propuestas` y `reservas` ya tienen su politica desde
-- 20260720_hard1_rls_todas_tablas.sql y no se tocan: una columna nueva queda
-- cubierta por la politica de su tabla.
do $$
declare t text;
begin
  foreach t in array array['codigos_promocionales','canjes_codigo'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- ─── 5 · GRANTs al rol de la app ───────────────────────────────────────────
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
      foreach t in array array['codigos_promocionales','canjes_codigo'] loop
        execute format('grant select, insert, update, delete on %I to %I', t, r);
      end loop;
    end if;
  end loop;
end $$;

commit;

-- ─── Verificacion ──────────────────────────────────────────────────────────
-- Las dos ultimas filas son las que importan el dia del despliegue: dicen que
-- NADA cambio de precio. Las dos tablas nacen vacias y ninguna propuesta lleva
-- codigo, asi que todo se sigue vendiendo exactamente como ayer.
select 'las dos tablas nuevas existen' k, count(*)::text v
  from information_schema.tables
 where table_name in ('codigos_promocionales','canjes_codigo')
union all
select 'las dos tablas nuevas con RLS forzada',
       count(*)::text from pg_class
 where relname in ('codigos_promocionales','canjes_codigo')
   and relrowsecurity and relforcerowsecurity
union all
select 'las cuatro columnas nuevas de codigo',
       count(*)::text from information_schema.columns
 where (table_name = 'propuestas' and column_name in ('codigo_texto','codigo_descuento_pct','codigo_canjeado_en'))
    or (table_name = 'reservas'   and column_name = 'codigo_descuento_pct')
union all
select 'el unique va sobre upper(codigo)',
       count(*)::text from pg_indexes
 where indexname = 'idx_codigos_promocionales_uq' and indexdef ilike '%upper%'
union all
select 'cupones capturados (nace vacia: nada cambia de precio)',
       count(*)::text from codigos_promocionales
union all
select 'propuestas CON codigo aplicado (nace en cero)',
       count(*)::text from propuestas where codigo_descuento_pct <> 0;
