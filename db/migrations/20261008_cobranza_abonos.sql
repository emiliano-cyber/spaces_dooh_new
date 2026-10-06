-- @tipo: esquema
-- ============================================================================
--  FIN-PER · CADA PAGO DE UN CLIENTE, CON SU FECHA.  ADR 0046.
-- ----------------------------------------------------------------------------
--  Hasta hoy `cobranzas.monto_pagado` era un ACUMULADO: cada pago le sumaba su
--  importe (`finanzas-repo.ts:registrarPagoCobranza`) y la fecha se perdia. Con
--  eso el sistema sabia cuanto se habia cobrado, pero no CUANDO, y las dos
--  cosas que el dueno pidio el 06/10 dependen de la fecha:
--
--    · el estado de cuenta de este mes y del mes pasado (lo cobrado EN el mes);
--    · el tablero de Finanzas por periodo: mes, trimestre, ano, rango libre.
--
--  ═══ LA TABLA ═════════════════════════════════════════════════════════════
--
--  `cobranza_abonos`: un renglon por pago, con su importe, el DIA en que se
--  recibio y quien lo registro. Es el HECHO; `monto_pagado` se queda como esta
--  porque lo leen la pantalla, el barrido de recordatorios y el calculo del
--  saldo, y quitarlo no era parte del pedido.
--
--  El invariante que sostiene a las dos: para cada cobranza,
--
--      monto_pagado = sum(cobranza_abonos.monto)
--
--  Lo garantiza la aplicacion escribiendo las dos en la MISMA transaccion
--  (`registrarPagoCobranza`), con la fila de la cobranza bloqueada. Lo
--  comprueba la consulta del final de este archivo y una prueba e2e.
--
--  ═══ LO YA COBRADO ANTES DE ESTA MIGRACION ════════════════════════════════
--
--  Se rescata, pero APROXIMADO, y se marca para que nadie lo tome por exacto:
--
--    · UN renglon por cobranza con `monto_pagado > 0`, por el total ya pagado,
--      con `origen = 'historico'`. No se puede partir en los abonos reales: la
--      bitacora guarda el importe REDONDEADO al peso y por FOLIO de factura, no
--      por cuota, asi que con parcialidades no hay forma de saber a que cuota
--      fue cada abono.
--    · Su `fecha` es la del ULTIMO «Registro pago»/«Registro abono» de la
--      bitacora (`acciones`) para ese folio, en la misma organizacion y no
--      anterior a la cobranza. Si no hay ninguno (pagos de antes de que la
--      bitacora los anotara), queda NULL: aqui no se inventa ninguna fecha. El
--      calculo por periodo (`lib/finanzas-periodo.ts`) lo FECHA CON SU FACTURA
--      y lo marca como aproximado; asi ningun periodo arranca en negativo.
--
--  ═══ LO QUE NO HACE ═══════════════════════════════════════════════════════
--
--  · No cambia ninguna fila de `cobranzas` ni de `facturas`: solo inserta.
--  · No toca `pagos_renta`, que ya tiene `fecha_pago`.
--  · No edita ninguna migracion anterior ni `db/schema.sql`.
--
--  ═══ POSTGRESQL 14 ════════════════════════════════════════════════════════
--  Nada posterior a la 14. Sin `-- @pg-min`.
--
--  Transaccional e idempotente: el rescate solo inserta para cobranzas que aun
--  no tienen ningun abono.
-- ============================================================================

begin;

create table if not exists cobranza_abonos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  cobranza_id uuid not null,
  monto       numeric(16,2) not null,
  -- El DIA en que se recibio el dinero (calendario, no instante). Por omision
  -- hoy en la zona de la base, que en produccion es America/Mexico_City.
  -- NULL solo en el rescate historico sin rastro en la bitacora.
  fecha       date,
  -- 'registro' = capturado en la pantalla de cobranza; 'historico' = rescatado
  -- por esta migracion. Lo historico es aproximado y la pantalla lo dice.
  origen      text not null default 'registro',
  -- QUIEN lo registro. De la sesion, nunca del cuerpo. `set null` al dar de
  -- baja a la persona: el pago sigue siendo un hecho.
  usuario_id  uuid references usuarios(id) on delete set null,
  creado_en   timestamptz not null default now(),
  constraint cobranza_abonos_monto_ck check (monto > 0),
  constraint cobranza_abonos_origen_ck check (origen in ('registro', 'historico')),
  -- Un pago capturado HOY siempre lleva fecha; solo lo rescatado puede no
  -- tenerla.
  constraint cobranza_abonos_fecha_ck check (fecha is not null or origen = 'historico')
);

do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'cobranzas_id_tenant_uq'
                    and conrelid = 'cobranzas'::regclass) then
    alter table cobranzas add constraint cobranzas_id_tenant_uq unique (id, tenant_id);
  end if;
  -- FK compuesta: un abono no puede colgar de la cobranza de OTRA
  -- organizacion aunque alguien se equivoque de id. `cascade` igual que
  -- `cobranzas` respecto de `facturas`: si la factura se borra, sus cobros se
  -- van con ella.
  if not exists (select 1 from pg_constraint
                  where conname = 'cobranza_abonos_cobranza_fkey'
                    and conrelid = 'cobranza_abonos'::regclass) then
    alter table cobranza_abonos add constraint cobranza_abonos_cobranza_fkey
      foreign key (cobranza_id, tenant_id)
      references cobranzas (id, tenant_id) on delete cascade;
  end if;
end $$;

-- Lo que se pregunta: «lo cobrado entre tal y tal fecha» y «los abonos de esta
-- cobranza».
create index if not exists idx_cobranza_abonos_fecha on cobranza_abonos (tenant_id, fecha);
create index if not exists idx_cobranza_abonos_cobranza on cobranza_abonos (cobranza_id);

comment on table cobranza_abonos is
  'FIN-PER (ADR 0046). Cada pago recibido de un cliente, con su fecha. Invariante: para cada cobranza, monto_pagado = sum(monto). Lo de origen historico es un rescate aproximado: un renglon por cobranza, fechado con el ultimo pago de la bitacora.';
comment on column cobranza_abonos.fecha is
  'FIN-PER. Dia en que se recibio el pago. NULL solo en origen historico sin rastro en la bitacora: cuenta en el saldo, no en lo cobrado de ningun periodo.';

-- ─── Rescate de lo ya cobrado ───────────────────────────────────────────────
insert into cobranza_abonos (tenant_id, cobranza_id, monto, fecha, origen)
select c.tenant_id,
       c.id,
       c.monto_pagado,
       (select max(a."timestamp")::date
          from acciones a
         where a.tenant_id = c.tenant_id
           and a.entidad = f.folio
           and (a.accion like 'Registró pago%' or a.accion like 'Registró abono%')
           and a."timestamp" >= c.creado_en),
       'historico'
  from cobranzas c
  join facturas f on f.id = c.factura_id
 where c.monto_pagado > 0
   and not exists (select 1 from cobranza_abonos x where x.cobranza_id = c.id);

-- ─── Aislamiento: igual que el resto de tablas con tenant_id ────────────────
alter table cobranza_abonos enable row level security;
alter table cobranza_abonos force row level security;
drop policy if exists tenant_isolation on cobranza_abonos;
create policy tenant_isolation on cobranza_abonos for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on cobranza_abonos to %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Comprobacion: el invariante se cumple en TODA cobranza ─────────────────
select 'cobranzas cuyo monto_pagado no cuadra con sus abonos (tiene que ser 0)' k,
       count(*)::text v
  from cobranzas c
 where c.monto_pagado <> coalesce((select sum(x.monto) from cobranza_abonos x
                                    where x.cobranza_id = c.id), 0)
union all
select 'abonos historicos sin fecha (cuentan en el saldo, no en un periodo)',
       count(*)::text
  from cobranza_abonos where origen = 'historico' and fecha is null;
