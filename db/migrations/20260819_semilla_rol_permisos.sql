-- ============================================================================
--  El catálogo de permisos viaja con el código: una instancia nueva no nace
--  vacía.
-- ----------------------------------------------------------------------------
--  MEDIDO antes de escribir esto (2026-08-19):
--
--    · base recién aprovisionada (rol de app → `db/schema.sql` → `migrar.mjs
--      --instalacion-nueva`) → `rol_permisos` con **5 filas de 1 módulo**;
--    · base de desarrollo → **25 filas · 8 módulos · 3 roles**.
--
--  `db/schema.sql:75-80` crea la tabla VACÍA, y el único sembrado que viajaba
--  en la cadena era `20260804_modulo_inventario.sql:22` — las cinco filas de
--  `inventario` del ADR 0010. Las otras veinte se pusieron a mano en la base de
--  desarrollo hace meses y nunca entraron al repositorio. O sea que la
--  configuración que hace utilizable el producto no estaba en ninguna parte de
--  lo que se despliega.
--
--  Por qué importa tanto: NO hay atajo para el Dueño. `permisosDeRol` y
--  `tienePermiso` (`apps/web/lib/server/auth.ts:126-142`) son consultas
--  directas a esta tabla, sin excepción para ningún rol, y `exigir()` es
--  fail-closed. Con cinco filas de `inventario`, el Dueño de una instancia
--  recién creada entra y ve la aplicación entera cerrada: ni Administración
--  —desde donde da de alta a su equipo— ni Comercial ni Finanzas. Falla
--  cerrado, así que no es una fuga; simplemente la instancia no sirve para
--  nada desde el minuto uno.
--
--  Migración y no `bootstrap-auth.mjs` (decisión de Jochelo, 2026-08-19): el
--  catálogo es configuración de PRODUCTO, igual para toda la flota, y así llega
--  también a las instancias que ya existan cuando se actualicen. El bootstrap
--  crea la identidad de CADA instancia (su organización y su Dueño), que es lo
--  contrario: lo único que no debe ser igual en dos droplets.
--
--  NO lleva `-- @tipo: datos` a propósito. Con esa marca el runner la saltaría
--  salvo `--con-datos` y `deploy.yml:141-148` no la aplicaría nunca, así que la
--  instancia nueva seguiría naciendo sin permisos — que es justo lo que esto
--  viene a arreglar. Mismo criterio que `20260804_modulo_inventario.sql`, que
--  tampoco la lleva: esto no es una corrección de datos de un tenant, es la
--  configuración base que toda instancia necesita para arrancar.
--
--  ─── Lo que este archivo NO decide, y es deliberado ───────────────────────
--
--  Se siembra EXACTAMENTE el estado que se sabe que funciona. Ampliar el
--  catálogo aquí sería inventar política de acceso a espaldas de nadie:
--
--    · El módulo `imprenta` (`apps/web/lib/modulos.ts:42`) queda SIN una sola
--      fila, igual que hoy en desarrollo. Es el único módulo del catálogo del
--      ADR 0010 en esa situación, y significa que la pantalla de Imprenta no la
--      abre nadie — tampoco el Dueño. Está anotado, no resuelto.
--    · Los roles `IMPRENTA` y `FINANZAS` del enum `rol_demo` tampoco reciben
--      ninguna fila, y `components/demo/shell/nav.ts:132-133` sí los ofrece al
--      dar de alta un usuario. Es la misma trampa que el ADR 0010 le cerró a
--      `CLIENTE` (`nav.ts:134`): se puede crear, entra, y recibe 403 en todo.
--    · `CLIENTE` se queda fuera por decisión expresa de ese ADR.
--
--  Idempotente y aditiva: `on conflict do nothing`, ni un `delete` ni un
--  `update`. Sobre desarrollo y sobre el droplet —que ya tienen las 25— no
--  cambia una sola fila; sobre una base nueva convive con las 5 que ya sembró
--  `20260804_modulo_inventario.sql` y el resultado son 25, no 30.
-- ============================================================================

begin;

-- ─── 1. Guard: el `on conflict` necesita la clave, y sin ella el error es 42P10
-- Sin la primaria (rol, modulo, accion), Postgres contesta «there is no unique
-- or exclusion constraint matching the ON CONFLICT specification» y la
-- migración muere sin decir qué falta. Es literalmente el fallo que tuvo
-- `bootstrap-auth.mjs` durante semanas (`apps/web/scripts/bootstrap-auth.mjs:151-155`),
-- así que aquí se nombra el problema en vez de dejar el código de error.
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
    raise exception 'rol_permisos no tiene la primaria (rol, modulo, accion); el ON CONFLICT de esta migración no puede resolverse';
  end if;
end $$;

-- ─── 2. El catálogo ────────────────────────────────────────────────────────
-- Las cinco de `inventario` se repiten a conciencia: este archivo tiene que
-- poder sembrar una base entera él solo, sin depender del orden en que se
-- apliquen las migraciones. `on conflict do nothing` las absorbe.
insert into rol_permisos (rol, modulo, accion)
values
  -- DUEÑO — el rol que administra la instancia. Sin esto no puede ni dar de
  -- alta al resto de su equipo (`administracion`).
  ('DUENO',       'administracion', 'ver'),
  ('DUENO',       'administracion', 'crear'),
  ('DUENO',       'administracion', 'aprobar'),
  ('DUENO',       'arrendadores',   'ver'),
  ('DUENO',       'arrendadores',   'crear'),
  ('DUENO',       'arrendadores',   'aprobar'),
  ('DUENO',       'comercial',      'ver'),
  ('DUENO',       'comercial',      'crear'),
  ('DUENO',       'comercial',      'aprobar'),
  ('DUENO',       'dashboard',      'ver'),
  ('DUENO',       'finanzas',       'ver'),
  ('DUENO',       'finanzas',       'crear'),
  ('DUENO',       'finanzas',       'facturar'),
  ('DUENO',       'inventario',     'ver'),
  ('DUENO',       'inventario',     'crear'),
  ('DUENO',       'inventario',     'aprobar'),
  ('DUENO',       'network',        'ver'),
  ('DUENO',       'operaciones',    'ver'),
  ('DUENO',       'operaciones',    'crear'),
  -- COMERCIAL — vende, y ve el inventario que vende. NO lo edita: esa es la
  -- separación que introdujo el ADR 0010 y no se toca aquí.
  ('COMERCIAL',   'comercial',      'ver'),
  ('COMERCIAL',   'comercial',      'crear'),
  ('COMERCIAL',   'dashboard',      'ver'),
  ('COMERCIAL',   'inventario',     'ver'),
  ('COMERCIAL',   'network',        'ver'),
  -- OPERACIONES — solo lectura del catálogo de pantallas.
  ('OPERACIONES', 'inventario',     'ver')
on conflict (rol, modulo, accion) do nothing;

-- ─── 3. ASSERT: están las 25 ───────────────────────────────────────────────
-- Se comprueba PRESENCIA, nunca el total. Un `count(*) = 25` sobre la tabla
-- entera abortaría en cualquier base donde alguien haya concedido un permiso de
-- más a propósito (`apps/web/scripts/a4-candado-banco.mjs:101` hace justo eso),
-- y negarse a actualizar por eso sería peor que el problema que se arregla.
-- Esta migración responde de sus 25 filas; de las demás, no.
do $$
declare faltan text;
begin
  select string_agg(format('%s.%s.%s', c.rol, c.modulo, c.accion), ', ' order by 1)
    into faltan
    from (values
      ('DUENO','administracion','ver'),('DUENO','administracion','crear'),('DUENO','administracion','aprobar'),
      ('DUENO','arrendadores','ver'),('DUENO','arrendadores','crear'),('DUENO','arrendadores','aprobar'),
      ('DUENO','comercial','ver'),('DUENO','comercial','crear'),('DUENO','comercial','aprobar'),
      ('DUENO','dashboard','ver'),
      ('DUENO','finanzas','ver'),('DUENO','finanzas','crear'),('DUENO','finanzas','facturar'),
      ('DUENO','inventario','ver'),('DUENO','inventario','crear'),('DUENO','inventario','aprobar'),
      ('DUENO','network','ver'),
      ('DUENO','operaciones','ver'),('DUENO','operaciones','crear'),
      ('COMERCIAL','comercial','ver'),('COMERCIAL','comercial','crear'),
      ('COMERCIAL','dashboard','ver'),('COMERCIAL','inventario','ver'),('COMERCIAL','network','ver'),
      ('OPERACIONES','inventario','ver')
    ) as c(rol, modulo, accion)
   where not exists (
     select 1 from rol_permisos p
      where p.rol::text = c.rol and p.modulo = c.modulo and p.accion = c.accion
   );
  if faltan is not null then
    raise exception 'El catálogo de permisos quedó incompleto. Faltan: %', faltan;
  end if;
end $$;

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
-- En una instancia recién aprovisionada se esperan 25 · 8 · 3. En una base con
-- permisos concedidos a mano, los totales pueden ser mayores: lo que esta
-- migración garantiza es que las 25 estén, no que no haya más.
select count(*)                  as filas,
       count(distinct modulo)    as modulos,
       count(distinct rol)       as roles
  from rol_permisos;

-- ─── ROLLBACK ──────────────────────────────────────────────────────────────
-- ⚠️ Deshacer esto deja al Dueño sin acceso a su propia instancia. Se incluye
-- por disciplina, no porque tenga un caso de uso.
--
-- Borra las VEINTE que introduce este archivo. Las cinco de `inventario` se
-- dejan estar: son de `20260804_modulo_inventario.sql`, y quitarlas aquí
-- desharía otra migración.
--
--   delete from rol_permisos
--    where modulo <> 'inventario'
--      and (rol::text, modulo, accion) in (
--        ('DUENO','administracion','ver'),('DUENO','administracion','crear'),('DUENO','administracion','aprobar'),
--        ('DUENO','arrendadores','ver'),('DUENO','arrendadores','crear'),('DUENO','arrendadores','aprobar'),
--        ('DUENO','comercial','ver'),('DUENO','comercial','crear'),('DUENO','comercial','aprobar'),
--        ('DUENO','dashboard','ver'),
--        ('DUENO','finanzas','ver'),('DUENO','finanzas','crear'),('DUENO','finanzas','facturar'),
--        ('DUENO','network','ver'),
--        ('DUENO','operaciones','ver'),('DUENO','operaciones','crear'),
--        ('COMERCIAL','comercial','ver'),('COMERCIAL','comercial','crear'),
--        ('COMERCIAL','dashboard','ver'),('COMERCIAL','network','ver')
--      );
