
-- ===========================================================================
--  REAPUNTAR AL TENANT DE ESTA INSTANCIA
--  El tenant_id que traen las filas es el del droplet viejo. Aqui se sustituye
--  por el de la organizacion de esta instancia, resuelto por slug.
--  `folios_consecutivos` no entra: esa tabla NO tiene tenant_id (es de la
--  instancia entera, no de la organizacion — ver el censo, seccion 4).
-- ===========================================================================
do $$
declare destino uuid; t text;
begin
  select id into destino from tenants where slug = 'g500';
  for t in
    select table_name from information_schema.columns
     where table_schema = 'carga_g500' and column_name = 'tenant_id'
  loop
    execute format('update carga_g500.%I set tenant_id = $1', t) using destino;
  end loop;
end $$;

-- ===========================================================================
--  APLICAR, EN ORDEN DE CLAVES AJENAS
--  El orden no es alfabetico ni caprichoso: una reserva no puede entrar antes
--  que su campana. Sale de las claves ajenas reales de la base.
-- ===========================================================================
insert into public.clientes                select * from carga_g500.clientes;
insert into public.arrendadores            select * from carga_g500.arrendadores;
insert into public.predios                 select * from carga_g500.predios;
insert into public.sitios                  select * from carga_g500.sitios;
insert into public.sitio_modalidades       select * from carga_g500.sitio_modalidades;
insert into public.arrendador_razon_social select * from carga_g500.arrendador_razon_social;
insert into public.contratos_arrendamiento select * from carga_g500.contratos_arrendamiento;
insert into public.pagos_renta             select * from carga_g500.pagos_renta;
insert into public.propuestas              select * from carga_g500.propuestas;
insert into public.propuesta_items         select * from carga_g500.propuesta_items;
insert into public.campanas                select * from carga_g500.campanas;
insert into public.reservas                select * from carga_g500.reservas;
insert into public.creatividades           select * from carga_g500.creatividades;
insert into public.ordenes_compra          select * from carga_g500.ordenes_compra;
insert into public.ordenes_trabajo         select * from carga_g500.ordenes_trabajo;
insert into public.evidencias_ot           select * from carga_g500.evidencias_ot;
insert into public.facturas                select * from carga_g500.facturas;
insert into public.cobranzas               select * from carga_g500.cobranzas;
insert into public.notificaciones          select * from carga_g500.notificaciones;
-- `acciones` no esta, y no es un olvido: ver la cabecera.

-- ===========================================================================
--  LOS CONTADORES DE FOLIO
--  Sin esto la instancia REEMITE folios ya usados, y las UNIQUE de folio son
--  GLOBALES (db/schema.sql:94): no es un aviso, es una carga abortada mas
--  adelante. Se toma el mayor de los dos por si la instancia ya emitio algo.
-- ===========================================================================
insert into public.folios_consecutivos (ambito, periodo, ultimo)
select ambito, periodo, ultimo from carga_g500.folios_consecutivos
on conflict (ambito, periodo) do update
   set ultimo = greatest(public.folios_consecutivos.ultimo, excluded.ultimo);

-- ===========================================================================
--  LA CONFIGURACION DEL NEGOCIO
--  La instancia crea su fila sola, con valores por omision, la primera vez que
--  alguien abre la aplicacion (config-repo.ts:61). Asi que aqui se ACTUALIZA:
--  insertar una segunda chocaria con config_negocio_tenant_uidx.
--  `id` y `logo_token` NO se tocan: el id es de la fila que ya vive aqui, y el
--  token del logo apunta a un archivo que no ha viajado.
-- ===========================================================================
insert into public.config_negocio as c (
  tenant_id, moneda, plazos_cobranza, tipos_tarea, actualizado_en,
  logo_url, iva_tasas, loop_seg, spot_seg, max_clientes_pantalla, email_remitente)
select tenant_id, moneda, plazos_cobranza, tipos_tarea, actualizado_en,
       logo_url, iva_tasas, loop_seg, spot_seg, max_clientes_pantalla, email_remitente
  from carga_g500.config_negocio
on conflict (tenant_id) do update set
  moneda                = excluded.moneda,
  plazos_cobranza       = excluded.plazos_cobranza,
  tipos_tarea           = excluded.tipos_tarea,
  actualizado_en        = excluded.actualizado_en,
  logo_url              = excluded.logo_url,
  iva_tasas             = excluded.iva_tasas,
  loop_seg              = excluded.loop_seg,
  spot_seg              = excluded.spot_seg,
  max_clientes_pantalla = excluded.max_clientes_pantalla,
  email_remitente       = excluded.email_remitente;

-- ===========================================================================
--  VERIFICACION · si un recuento no cuadra, NADA se guarda
--  Los numeros vienen del censo de E2, medidos en la base puente.
-- ===========================================================================
do $$
declare
  destino uuid;
  esperado constant text[][] := array[
    ['clientes','1'], ['arrendadores','5'], ['predios','3'], ['sitios','12'],
    ['sitio_modalidades','12'], ['arrendador_razon_social','0'],
    ['contratos_arrendamiento','13'], ['pagos_renta','29'],
    ['propuestas','7'], ['propuesta_items','26'], ['campanas','7'],
    ['reservas','26'], ['creatividades','4'], ['ordenes_compra','3'],
    ['ordenes_trabajo','1'], ['evidencias_ot','1'], ['facturas','3'],
    ['cobranzas','15'], ['notificaciones','373']
  ];
  i int; tabla text; n_esperado int; n_real int; total int := 0;
begin
  select id into destino from tenants where slug = 'g500';

  for i in 1 .. array_length(esperado, 1) loop
    tabla := esperado[i][1];
    n_esperado := esperado[i][2]::int;
    execute format('select count(*) from public.%I where tenant_id = $1', tabla)
       into n_real using destino;
    if n_real <> n_esperado then
      raise exception 'CARGA INCOMPLETA en %: hay % filas y el censo decia %',
        tabla, n_real, n_esperado;
    end if;
    total := total + n_real;
  end loop;

  if total <> 541 then
    raise exception 'TOTAL INESPERADO: % filas (se esperaban 541)', total;
  end if;

  -- Las modalidades tienen que colgar de pantallas de ESTA organizacion. Es la
  -- comprobacion que le da sentido al rescate: si el remapeo se hubiera hecho
  -- mal, aqui saldria cero y la carga se deshace.
  select count(*) into n_real
    from sitio_modalidades sm join sitios s on s.id = sm.sitio_id
   where s.tenant_id = destino and sm.tenant_id = destino;
  if n_real <> 12 then
    raise exception 'RESCATE MAL APLICADO: % modalidades cuelgan de pantallas de g500 con su tenant, y deberian ser 12', n_real;
  end if;

  -- Ni una persona ni una linea de bitacora han entrado por la puerta de atras.
  -- Se compara contra la foto del principio, no contra un numero fijo.
  select count(*) into n_real from usuarios where tenant_id = destino;
  if n_real <> (select usuarios from _antes) then
    raise exception 'Los usuarios pasaron de % a %: esta carga no trae ninguno',
      (select usuarios from _antes), n_real;
  end if;

  select count(*) into n_real from acciones where tenant_id = destino;
  if n_real <> (select bitacora from _antes) then
    raise exception 'La bitacora paso de % a % filas: esta carga no trae ninguna',
      (select bitacora from _antes), n_real;
  end if;

  raise notice 'VERIFICACION OK · % filas de negocio, 12 modalidades rescatadas, 0 personas, 0 bitacora.', total;
end $$;

drop schema carga_g500 cascade;

commit;

-- ===========================================================================
--  Despues de esto, comprobar desde fuera (no desde la base):
--    curl -s https://<dominio>/spaces-dooh/api/auth/metodos/
--  y entrar a ver las 12 pantallas con su tarifa.
-- ===========================================================================
