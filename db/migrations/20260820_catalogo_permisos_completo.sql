-- ============================================================================
--  El catalogo de permisos, COMPLETO: 41 filas . 9 modulos . 5 perfiles.
-- ----------------------------------------------------------------------------
--  MEDIDO en el re-ensayo de la Fase 4 (2026-08-19) y confirmado el 20/08:
--  habia DOS catalogos de permisos y podian divergir. De hecho divergian.
--
--    - la migracion `20260819_semilla_rol_permisos.sql` sembraba 25 filas,
--      8 modulos, 3 roles;
--    - `apps/web/scripts/bootstrap-auth.mjs:90-99` llevaba su propia MATRIZ, con
--      36 filas -- y con `inventario`, que viene de otra migracion, la union da
--      41, 9 modulos y 5 roles.
--
--  El que corriera ULTIMO fijaba la politica de acceso efectiva de la
--  instancia, sin un error y sin un aviso. En el ensayo el Dueno paso de 19
--  permisos a 24 solo por el orden. Eso es ROJO-2.
--
--  DECISION (2026-08-20): manda el contenido del alta y se adopta ENTERO, no
--  solo sus dos perfiles nuevos. Y sigue viviendo en la MIGRACION, no en el
--  script de alta: el catalogo es configuracion de PRODUCTO, igual para toda la
--  flota, y asi llega tambien a las instancias que ya existan cuando se
--  actualicen. El bootstrap crea la identidad de CADA instancia, que es lo
--  contrario. Es la misma decision del 19/08, sostenida.
--
--  --- Que anade sobre las 25 -----------------------------------------------
--
--    - DUENO (19 -> 24): `imprenta` completo, `operaciones: aprobar` y
--      `network: crear`.
--    - OPERACIONES (1 -> 5): ve y crea lo suyo, y mira `comercial` e `imprenta`.
--    - IMPRENTA (0 -> 3): ve y crea sus trabajos, y mira `operaciones` para
--      saber que se instala. NO tiene `aprobar`: no cierra nada por su cuenta.
--    - FINANZAS (0 -> 4): ve, crea y FACTURA, mas el tablero.
--
--  `facturar` para FINANZAS es accion de dinero irreversible (zona R4) y va por
--  decision expresa: un Finanzas que no puede facturar obliga al Dueno a hacer
--  el trabajo diario, y eso acaba con todo el mundo entrando como Dueno, que es
--  peor. La traza de quien facturo no cambia.
--
--  `IMPRENTA` y `FINANZAS` ya estaban en el enum `rol_demo` (`db/schema.sql:31`)
--  y `nav.ts` los ofrecia al dar de alta un usuario, pero no tenian NI UNA fila:
--  se podian crear, entraban, y recibian 403 en todo. Es la misma trampa que el
--  ADR 0010 le cerro a `CLIENTE` -- que se queda fuera, por ese mismo ADR.
--  `imprenta` era ademas el unico modulo del catalogo sin una sola fila: la
--  pantalla no la abria nadie, tampoco el Dueno.
--
--  OJO: ESTO AMPLIA PERMISOS EN INSTANCIAS QUE YA EXISTEN. La migracion es
--  aditiva (`on conflict do nothing`, ni un `delete` ni un `update`), asi que al
--  actualizarse, desarrollo y el droplet GANAN filas. No es un efecto colateral:
--  es la decision. Pero conviene decirlo antes, no descubrirlo despues en un
--  tablero de produccion.
--
--  NO lleva `-- @tipo: datos`, por el mismo motivo que la del 19/08: con esa
--  marca el runner la saltaria salvo `--con-datos` y una instancia nueva
--  seguiria naciendo incompleta.
--
--  Se siembran las 41 y no solo las 16 que faltan: este archivo tiene que poder
--  sembrar una base entera el solo, sin depender de que migraciones corrieron
--  antes. `on conflict do nothing` absorbe las repetidas.
-- ============================================================================

begin;

-- --- 1. Guard: el `on conflict` necesita la clave, y sin ella el error es 42P10
do $$
begin
  if not exists (
    select 1
      from pg_index i
      join pg_class c on c.oid = i.indrelid
     where c.relname = 'rol_permisos' and i.indisprimary
       and (select array_agg(a.attname::text order by a.attname)
              from pg_attribute a
             where a.attrelid = c.oid and a.attnum = any(i.indkey))
           = array['accion','modulo','rol']
  ) then
    raise exception 'rol_permisos no tiene la primaria (rol, modulo, accion); el ON CONFLICT de esta migracion no puede resolverse';
  end if;
end $$;

-- --- 2. El catalogo completo ------------------------------------------------
insert into rol_permisos (rol, modulo, accion)
values
  ('DUENO',       'administracion',  'ver'),
  ('DUENO',       'administracion',  'crear'),
  ('DUENO',       'administracion',  'aprobar'),
  ('DUENO',       'arrendadores',    'ver'),
  ('DUENO',       'arrendadores',    'crear'),
  ('DUENO',       'arrendadores',    'aprobar'),
  ('DUENO',       'comercial',       'ver'),
  ('DUENO',       'comercial',       'crear'),
  ('DUENO',       'comercial',       'aprobar'),
  ('DUENO',       'inventario',      'ver'),
  ('DUENO',       'inventario',      'crear'),
  ('DUENO',       'inventario',      'aprobar'),
  ('DUENO',       'operaciones',     'ver'),
  ('DUENO',       'operaciones',     'crear'),
  ('DUENO',       'operaciones',     'aprobar'),
  ('DUENO',       'imprenta',        'ver'),
  ('DUENO',       'imprenta',        'crear'),
  ('DUENO',       'imprenta',        'aprobar'),
  ('DUENO',       'finanzas',        'ver'),
  ('DUENO',       'finanzas',        'crear'),
  ('DUENO',       'finanzas',        'facturar'),
  ('DUENO',       'network',         'ver'),
  ('DUENO',       'network',         'crear'),
  ('DUENO',       'dashboard',       'ver'),
  ('COMERCIAL',   'comercial',       'ver'),
  ('COMERCIAL',   'comercial',       'crear'),
  ('COMERCIAL',   'inventario',      'ver'),
  ('COMERCIAL',   'network',         'ver'),
  ('COMERCIAL',   'dashboard',       'ver'),
  ('OPERACIONES', 'operaciones',     'ver'),
  ('OPERACIONES', 'operaciones',     'crear'),
  ('OPERACIONES', 'inventario',      'ver'),
  ('OPERACIONES', 'comercial',       'ver'),
  ('OPERACIONES', 'imprenta',        'ver'),
  ('IMPRENTA',    'imprenta',        'ver'),
  ('IMPRENTA',    'imprenta',        'crear'),
  ('IMPRENTA',    'operaciones',     'ver'),
  ('FINANZAS',    'finanzas',        'ver'),
  ('FINANZAS',    'finanzas',        'crear'),
  ('FINANZAS',    'finanzas',        'facturar'),
  ('FINANZAS',    'dashboard',       'ver')
on conflict (rol, modulo, accion) do nothing;

-- --- 3. ASSERT: estan las 41 ------------------------------------------------
-- Se comprueba PRESENCIA, nunca el total: un `count(*) = 41` abortaria en
-- cualquier base donde alguien haya concedido un permiso de mas a proposito
-- (`apps/web/scripts/a4-candado-banco.mjs:101` hace justo eso), y negarse a
-- actualizar por eso seria peor que el problema que se arregla.
do $$
declare faltan text;
begin
  select string_agg(format('%s.%s.%s', c.rol, c.modulo, c.accion), ', ' order by 1)
    into faltan
    from (values
      ('DUENO','administracion','ver'),
      ('DUENO','administracion','crear'),
      ('DUENO','administracion','aprobar'),
      ('DUENO','arrendadores','ver'),
      ('DUENO','arrendadores','crear'),
      ('DUENO','arrendadores','aprobar'),
      ('DUENO','comercial','ver'),
      ('DUENO','comercial','crear'),
      ('DUENO','comercial','aprobar'),
      ('DUENO','inventario','ver'),
      ('DUENO','inventario','crear'),
      ('DUENO','inventario','aprobar'),
      ('DUENO','operaciones','ver'),
      ('DUENO','operaciones','crear'),
      ('DUENO','operaciones','aprobar'),
      ('DUENO','imprenta','ver'),
      ('DUENO','imprenta','crear'),
      ('DUENO','imprenta','aprobar'),
      ('DUENO','finanzas','ver'),
      ('DUENO','finanzas','crear'),
      ('DUENO','finanzas','facturar'),
      ('DUENO','network','ver'),
      ('DUENO','network','crear'),
      ('DUENO','dashboard','ver'),
      ('COMERCIAL','comercial','ver'),
      ('COMERCIAL','comercial','crear'),
      ('COMERCIAL','inventario','ver'),
      ('COMERCIAL','network','ver'),
      ('COMERCIAL','dashboard','ver'),
      ('OPERACIONES','operaciones','ver'),
      ('OPERACIONES','operaciones','crear'),
      ('OPERACIONES','inventario','ver'),
      ('OPERACIONES','comercial','ver'),
      ('OPERACIONES','imprenta','ver'),
      ('IMPRENTA','imprenta','ver'),
      ('IMPRENTA','imprenta','crear'),
      ('IMPRENTA','operaciones','ver'),
      ('FINANZAS','finanzas','ver'),
      ('FINANZAS','finanzas','crear'),
      ('FINANZAS','finanzas','facturar'),
      ('FINANZAS','dashboard','ver')
    ) as c(rol, modulo, accion)
   where not exists (
     select 1 from rol_permisos p
      where p.rol::text = c.rol and p.modulo = c.modulo and p.accion = c.accion
   );
  if faltan is not null then
    raise exception 'El catalogo de permisos quedo incompleto. Faltan: %', faltan;
  end if;
end $$;

commit;

-- --- Verificacion -----------------------------------------------------------
-- En una instancia recien aprovisionada se esperan 41 . 9 . 5. En una base con
-- permisos concedidos a mano los totales pueden ser mayores: lo que esta
-- migracion garantiza es que las 41 esten, no que no haya mas.
select count(*)               as filas,
       count(distinct modulo) as modulos,
       count(distinct rol)    as roles
  from rol_permisos;
select rol, count(*) as permisos from rol_permisos group by rol order by rol;

-- --- ROLLBACK ---------------------------------------------------------------
-- OJO: deshacer esto deja a IMPRENTA y FINANZAS sin poder entrar a nada y al
-- Dueno sin `imprenta`. Se incluye por disciplina, no porque tenga un caso de
-- uso. Borra SOLO las dieciseis que introduce este archivo: las otras 25 son de
-- `20260819_semilla_rol_permisos.sql` y las 5 de `inventario` de
-- `20260804_modulo_inventario.sql`; quitarlas aqui desharia otra migracion.
--
--   delete from rol_permisos where (rol::text, modulo, accion) in (
--     ('DUENO','imprenta','ver'),('DUENO','imprenta','crear'),('DUENO','imprenta','aprobar'),
--     ('DUENO','operaciones','aprobar'),('DUENO','network','crear'),
--     ('OPERACIONES','operaciones','ver'),('OPERACIONES','operaciones','crear'),
--     ('OPERACIONES','comercial','ver'),('OPERACIONES','imprenta','ver'),
--     ('IMPRENTA','imprenta','ver'),('IMPRENTA','imprenta','crear'),('IMPRENTA','operaciones','ver'),
--     ('FINANZAS','finanzas','ver'),('FINANZAS','finanzas','crear'),
--     ('FINANZAS','finanzas','facturar'),('FINANZAS','dashboard','ver')
--   );
