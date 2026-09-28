-- @tipo: esquema
-- ============================================================================
--  TOPE-01 · techo de descuento comercial POR ORGANIZACION.
-- ----------------------------------------------------------------------------
--  El agujero: `lib/descuento.ts` acotaba el descuento a [0, 100] y nada mas.
--  El 90 % pasaba liso, lo podia poner cualquier rol COMERCIAL y sin pedir la
--  contrasena --propuestas no esta entre las rutas con `exigirCambioSensible`--.
--  Cambiar la renta de una pantalla si la pedia; regalar el 80 % de una venta,
--  no. El unico freno era el 100 % exacto, y ese ni siquiera mira el
--  porcentaje: es `PropuestaCeroError`, que mira el TOTAL.
--
--  Va en `config_negocio` porque es UNA FILA POR TENANT desde el ADR 0011: el
--  techo es una politica comercial de cada organizacion, no de la instalacion.
--
--  ─── EL VALOR POR OMISION ES 100, Y ES LA DECISION QUE IMPORTA ─────────────
--  100 % = exactamente lo que hacia el codigo antes de esta migracion. O sea
--  que desplegarla NO invalida ni una sola propuesta viva: hoy hay propuestas
--  con cualquier descuento entre 0 y 100, y todas siguen siendo validas.
--
--  Sembrar aqui un numero "prudente" --20, 30-- convertiria de golpe en
--  invalidas las propuestas que ya lo superan, y eso es una decision de
--  negocio que le toca a cada dueno, no a una migracion. Es la misma eleccion
--  que el ADR 0008 con `max_clientes_pantalla`: la regla NACE APAGADA y se
--  enciende capturando un numero.
--
--  Y hay una segunda consecuencia, deliberada: la validacion es para lo que se
--  ESCRIBE, no para lo ya escrito. Si manana el dueno baja el techo al 10, las
--  propuestas vivas al 40 conservan su 40 y se pueden seguir editando --lo que
--  ya no se puede es volver a teclear ese 40--. Reescribir lo pactado seria
--  mover dinero que alguien ya negocio. Mismo criterio que CFG-01 con los
--  plazos de cobranza retirados.
--
--  NOT NULL con DEFAULT, y no NULL = "sin tope", porque aqui el 100 YA
--  significa "sin tope": `descuentoValido` nunca deja pasar mas de 100. Dos
--  formas de decir lo mismo son dos formas de que la lectura se equivoque.
--
--  Aditiva e idempotente. No toca ninguna fila existente: el DEFAULT rellena
--  las que habia.
-- ============================================================================
begin;

alter table config_negocio
  add column if not exists tope_descuento_pct numeric(5,2) not null default 100;

-- Se acota en la BASE ademas de en zod: la validacion de la aplicacion no
-- protege a quien entra por psql, y este numero decide cuanto dinero se puede
-- regalar en una venta. Un tope de 0 SI es valido --significa "en esta
-- organizacion no se descuenta"-- y por eso el limite inferior es 0 y no 1.
alter table config_negocio drop constraint if exists config_tope_descuento_ck;
alter table config_negocio add  constraint config_tope_descuento_ck
  check (tope_descuento_pct >= 0 and tope_descuento_pct <= 100);

comment on column config_negocio.tope_descuento_pct is
  'TOPE-01. Descuento comercial maximo que esta organizacion autoriza en una propuesta, en por ciento. 100 = sin tope, que es como nace. Lo aplica lib/descuento.ts:descuentoDentroDelTope y solo lo cambia administracion, con contrasena.';

commit;

-- Verificacion
select 'config_negocio.tope_descuento_pct' k, count(*)::text v
  from information_schema.columns
 where table_name='config_negocio' and column_name='tope_descuento_pct'
union all
select 'filas sin tope (deberia ser 0)', count(*)::text
  from config_negocio where tope_descuento_pct is null
union all
select 'organizaciones con tope por debajo de 100', count(*)::text
  from config_negocio where tope_descuento_pct < 100;
