-- @tipo: esquema
-- ============================================================================
--  OT-COSTO-01 · lo que de verdad costo esa visita.
-- ----------------------------------------------------------------------------
--  Pedido del dueno el 2026-09-29: «que las ordenes de trabajo tengan la opcion
--  de anadir costo, para que en el reporte el costo de operacion se sume y
--  tener los costos reales».
--
--  La medicion que lo motiva: `ordenes_trabajo` tenia 20 columnas y NINGUNA era
--  un costo. Lo que el reporte de rentabilidad llama «costo de operacion» NO es
--  un costo: es una TARIFA POR TIPO que sale de `config_negocio.costos_ot`
--  (ADR 0011), asi que TODAS las ordenes del mismo tipo cuestan lo mismo. Una
--  herreria de $12,000 y otra de $800 entraban las dos al reporte por el mismo
--  importe, y el margen salia igual de falso en las dos direcciones.
--
--  ─── SUSTITUYE LA TARIFA, NO SE SUMA A ELLA ───────────────────────────────
--  La decision que gobierna todo lo demas, y esta escrita aqui porque es de
--  datos antes que de codigo: `costo_real` es el costo de la orden ENTERA, el
--  mismo hecho que la tarifa por tipo estimaba.
--
--  `costos-ot.ts` lo dice de su propio valor --«El costo de UNA orden de
--  trabajo de este tipo»--: no es un componente del costo, es el costo. Sumar
--  los dos cobraria DOS VECES la misma visita, y el error ni siquiera se veria:
--  daria un costo de operacion mas alto y un margen mas bajo, que es justo la
--  direccion en la que nadie sospecha de una cifra.
--
--  Asi que la regla es: hay `costo_real` -> vale ese. No hay -> vale la
--  estimacion por tipo, como hasta hoy.
--
--  ─── NULLABLE Y SIN DEFAULT, Y ESA ES LA DECISION QUE MAS IMPORTA ─────────
--  NULL significa «nadie ha capturado lo que costo», y tiene que poder
--  distinguirse de 0. Son cosas distintas:
--
--    · NULL -> se usa la estimacion por tipo. El reporte lo DECLARA.
--    · 0    -> costo real, capturado, y vale cero. Una inspeccion que hace el
--              propio dueno no paga cuadrilla. Es el mismo criterio que ya
--              aplica `importeValido()` en `lib/costos-ot.ts`, que acepta el 0
--              a proposito y con el motivo escrito.
--
--  Por eso NO lleva DEFAULT 0. Un default de cero convertiria «no se sabe» en
--  la AFIRMACION «no costo nada», y encima sobre dinero: TODAS las ordenes ya
--  capturadas --y son todas-- pasarian a valer cero de golpe, el costo de
--  operacion del reporte se desplomaria y el margen se dispararia, sin un solo
--  error y sin que nada en pantalla lo dijera. Mismo criterio que el DEFAULT de
--  tenant que retiro `20260812_sin_default_tenant.sql` y que el `usuario_id`
--  nullable de `20260928_vendedor_en_propuesta.sql`.
--
--  Lo que esto CUESTA, dicho con todas las letras: el dia del despliegue TODAS
--  las ordenes existentes siguen con la estimacion por tipo, porque nadie ha
--  capturado nada todavia. Eso NO es un fallo: es el estado real del dato, y el
--  reporte lo pinta con su aviso de cobertura --cuantas van con costo real y
--  cuantas con la estimacion-- en vez de mezclarlas en un total mudo.
--
--  ─── EL CHECK: NO NEGATIVO ────────────────────────────────────────────────
--  Un costo negativo no es un costo, y colado en el reporte SUBIRIA el margen:
--  entra restando en `ingreso - costoEspacio - costoOperacion - costoEnergia`.
--  El guard esta en la base ademas de en el zod del controller a proposito: la
--  validacion de la capa de arriba protege a quien pasa por la ruta, y esto
--  protege a la tabla de un `psql` o de una correccion de datos a mano.
--
--  ─── UN SOLO NUMERO, NO UN DESGLOSE ───────────────────────────────────────
--  No hay `materiales`, `mano_de_obra` ni `transporte`. Lo que sustituye es un
--  numero --la tarifa por tipo-- y el reporte suma un numero; tres columnas mas
--  darian tres huecos mas que capturar para que el total no cambiara. Un
--  desglose es una tabla hija con sus filas, no columnas, y se anade el dia que
--  alguien pregunte «en que se fue» --pregunta que hoy nadie ha hecho--, sin
--  mover este numero ni el reporte.
--
--  ─── PostgreSQL 14 ────────────────────────────────────────────────────────
--  Sin sintaxis de 15 y sin `@pg-min`: g500 corre 14.24 y el guard del runner
--  (codigo de salida 4) parara la cola entera de esa base. `add column if not
--  exists` + `check` por `do $$` son de siempre.
--
--  Aditiva e idempotente. NO toca ninguna fila existente ni `db/schema.sql`, y
--  no edita ninguna migracion anterior. No mueve ni un importe: el dia que se
--  aplica, el reporte da EXACTAMENTE las mismas cifras que daba antes.
-- ============================================================================
begin;

alter table ordenes_trabajo
  add column if not exists costo_real numeric(14,2);

-- El check se crea aparte del `add column` para que la migracion sea idempotente
-- tambien a medias: si una corrida anterior murio entre las dos, la segunda no
-- falla por restriccion duplicada. Mismo patron que la FK de
-- `20260928_vendedor_en_propuesta.sql`.
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ordenes_trabajo_costo_real_no_negativo'
       and conrelid = 'ordenes_trabajo'::regclass
  ) then
    alter table ordenes_trabajo
      add constraint ordenes_trabajo_costo_real_no_negativo
      check (costo_real is null or costo_real >= 0);
  end if;
end $$;

comment on column ordenes_trabajo.costo_real is
  'OT-COSTO-01. Lo que de verdad costo esta orden de trabajo, capturado a mano. SUSTITUYE la tarifa por tipo de config_negocio.costos_ot en el reporte de rentabilidad: es el costo de la orden entera, no un componente, y sumarlos cobraria dos veces la misma visita. NULL = nadie lo ha capturado, y entonces vale la estimacion por tipo; el reporte DECLARA cuantas van con cada cosa. NULL no es 0: el 0 es un costo real y valido (una inspeccion que hace el propio dueno).';

commit;

-- ─── Verificacion ──────────────────────────────────────────────────────────
-- La tercera fila es la que importa el dia del despliegue: dice cuantas ordenes
-- siguen con la estimacion por tipo. No es un error --es el estado real del
-- dato-- y es la cifra que el aviso de cobertura del reporte va a ensenar.
select 'ordenes_trabajo.costo_real existe' k, count(*)::text v
  from information_schema.columns
 where table_name = 'ordenes_trabajo' and column_name = 'costo_real'
union all
select 'el check de no negativo existe',
       count(*)::text
  from pg_constraint
 where conname = 'ordenes_trabajo_costo_real_no_negativo'
union all
select 'ordenes SIN costo real capturado (usan la estimacion por tipo)',
       count(*)::text
  from ordenes_trabajo where costo_real is null;
