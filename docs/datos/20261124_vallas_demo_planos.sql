-- ============================================================================
--  20261124_vallas_demo_planos.sql — una propuesta y una campaña de EJEMPLO en
--  la DEMO para que se vean los TRES planos de vallas
-- ----------------------------------------------------------------------------
--  Pedido del dueño el 24/11: las vallas del 23/11 (20261123_vallas_demo.sql)
--  se veían en Comercial → Vallas, pero «no hay nada de los planos»: sin
--  propuestas ni campañas no hay plano en la propuesta, ni en la liga del
--  cliente, ni nada ocupado.
--
--  Qué deja, todo con prefijo DEMO- para reconocerlo y quitarlo:
--    · cliente   «Refrescos DEMO Vallas»   (RFC DMV030303AB1)
--    · cliente   «Bebidas DEMO del Sur»    (RFC DMV030303AB2)
--    · propuesta DEMO-PR-VAL-01, ENVIADA, marca «Refrescos DEMO», con
--                DEMO-VAL-01 (Reforma, 3 vallas en grupo, una en esquina) y
--                DEMO-VAL-03 (Insurgentes, 2 caras) de hoy a +30 días.
--                → «Dibujar plano» en su ficha y «Así se ven tus vallas» en
--                  su liga (son 5 vallas: la liga lo pide con más de una).
--    · campaña   DEMO-CA-VAL-01, ACTIVA, marca «Bebidas DEMO», con su reserva
--                CONFIRMADA en DEMO-VAL-02 (Periférico Sur) de hace 5 días a
--                +25. → en el plano de Comercial → Vallas ese sitio sale
--                OCUPADO por «Bebidas DEMO»; los otros dos, Libre.
--
--  Requisito: haber corrido antes 20261123_vallas_demo.sql en la MISMA
--  organización (los sitios DEMO-VAL-0x). Si faltan, para sin tocar nada.
--
--  Uso (en el droplet de la DEMO, como postgres: salta la RLS a propósito, la
--  organización se fija a mano en cada fila):
--    sudo -u postgres psql -d spaces -v ON_ERROR_STOP=1 -v org=g500 -f 20261124_vallas_demo_planos.sql
--
--  Idempotente: correrlo dos veces no duplica nada.
--  Vuelta atrás: 20261124_vallas_demo_planos_rollback.sql.
--
--  El historial de propuestas (propuesta_cambios, por trigger) registra el
--  alta con autor «Semilla DEMO». Es de solo crecer: el rollback borra la
--  propuesta pero esas filas se quedan, a propósito (ADR 0051).
-- ============================================================================

begin;

-- Autor del historial de la propuesta (el trigger lo lee de la sesión).
select set_config('app.usuario_nombre', 'Semilla DEMO', true);

create temp table _org on commit drop as
  select id from tenants where slug = :'org';

do $$
begin
  if (select count(*) from _org) <> 1 then
    raise exception 'No hay una organizacion con ese slug. Mira los slugs con: select slug, nombre from tenants;';
  end if;
  if (select count(*) from sitios s join _org o on o.id = s.tenant_id
       where s.clave_interna in ('DEMO-VAL-01','DEMO-VAL-02','DEMO-VAL-03')) <> 3 then
    raise exception 'Faltan los sitios DEMO-VAL-0x en esta organizacion: corre antes 20261123_vallas_demo.sql.';
  end if;
end $$;

-- ── Clientes ───────────────────────────────────────────────────────────────
insert into clientes (tenant_id, nombre, rfc, razon_social, regimen_fiscal, cp_fiscal, uso_cfdi,
                      tipo, iva_pct, comision_agencia_pct, contacto, activo)
select o.id, c.nombre, c.rfc, c.razon, '601', '00000', 'G03', 'DIRECTO', 16, 0,
       jsonb_build_object('nombre', c.contacto), true
  from _org o,
  (values
    ('Refrescos DEMO Vallas', 'DMV030303AB1', 'Refrescos DEMO Vallas SA de CV', 'Contacto DEMO Refrescos'),
    ('Bebidas DEMO del Sur',  'DMV030303AB2', 'Bebidas DEMO del Sur SA de CV',  'Contacto DEMO Bebidas')
  ) as c(nombre, rfc, razon, contacto)
 where not exists (select 1 from clientes x where x.tenant_id = o.id and x.rfc = c.rfc);

-- ── Propuesta enviada con dos sitios de vallas ─────────────────────────────
insert into propuestas (tenant_id, folio, token_publico, cliente_id, nombre, marca, fecha, estatus,
                        comision_pct, descuento_pct, notas)
select o.id, 'DEMO-PR-VAL-01',
       replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
       cl.id, 'DEMO · Vallas Reforma e Insurgentes', 'Refrescos DEMO', current_date, 'ENVIADA',
       0, 0, 'DEMO: propuesta de ejemplo para enseñar el plano de vallas.'
  from _org o
  join clientes cl on cl.tenant_id = o.id and cl.rfc = 'DMV030303AB1'
on conflict (folio) do nothing;

insert into propuesta_items (tenant_id, propuesta_id, sitio_id, fecha_inicio, fecha_fin, precio,
                             aprobado, unidad, cantidad, tarifa_unitaria)
select o.id, pr.id, s.id, current_date, current_date + 30, i.precio, false, 'mensual', 1, i.precio
  from _org o
  join propuestas pr on pr.tenant_id = o.id and pr.folio = 'DEMO-PR-VAL-01'
  cross join (values ('DEMO-VAL-01', 95000), ('DEMO-VAL-03', 38000)) as i(sitio, precio)
  join sitios s on s.tenant_id = o.id and s.clave_interna = i.sitio
 where not exists (select 1 from propuesta_items x
                    where x.tenant_id = o.id and x.propuesta_id = pr.id and x.sitio_id = s.id);

-- ── Campaña activa de OTRA marca en Periférico Sur ─────────────────────────
insert into campanas (tenant_id, folio, nombre, cliente_id, marca, tipo_campana,
                      fecha_inicio, fecha_fin, presupuesto_bruto, presupuesto_neto, moneda,
                      estado_comercial, oc_recibida, fotos_comprobatorias, reporte_publicacion, notas)
select o.id, 'DEMO-CA-VAL-01', 'DEMO · Bebidas en Periférico Sur', cl.id, 'Bebidas DEMO', 'OOH',
       current_date - 5, current_date + 25, 120000, 120000, 'MXN',
       'ACTIVA', true, false, false, 'DEMO: campaña de ejemplo para que el plano marque un sitio ocupado.'
  from _org o
  join clientes cl on cl.tenant_id = o.id and cl.rfc = 'DMV030303AB2'
on conflict (folio) do nothing;

insert into reservas (tenant_id, campana_id, sitio_id, fecha_inicio, fecha_fin, precio, tipo_venta,
                      estatus, unidad, cantidad, tarifa_unitaria)
select o.id, c.id, s.id, current_date - 5, current_date + 25, 120000, 'FIXED_PKG',
       'CONFIRMADA', 'mensual', 1, 120000
  from _org o
  join campanas c on c.tenant_id = o.id and c.folio = 'DEMO-CA-VAL-01'
  join sitios s on s.tenant_id = o.id and s.clave_interna = 'DEMO-VAL-02'
 where not exists (select 1 from reservas x
                    where x.tenant_id = o.id and x.campana_id = c.id and x.sitio_id = s.id);

-- Lo que quedó, para verlo en la consola.
select 'propuesta' as que, pr.folio, pr.estatus::text, s.clave_interna as sitio,
       '/spaces-dooh/p/' || pr.token_publico as liga_cliente
  from propuestas pr
  join propuesta_items it on it.propuesta_id = pr.id
  join sitios s on s.id = it.sitio_id
 where pr.tenant_id = (select id from _org) and pr.folio = 'DEMO-PR-VAL-01'
union all
select 'campana', c.folio, c.estado_comercial::text, s.clave_interna, null
  from campanas c
  join reservas r on r.campana_id = c.id
  join sitios s on s.id = r.sitio_id
 where c.tenant_id = (select id from _org) and c.folio = 'DEMO-CA-VAL-01'
 order by 1, 4;

commit;
