-- ============================================================================
--  ADR 0040 · La matriz de los cuatro roles nuevos, y el retiro de COMERCIAL.
-- ----------------------------------------------------------------------------
--  VA DESPUES de `20260929_roles_de_venta_enum.sql`, y no es una preferencia:
--  este archivo USA los cuatro valores que aquel anade, y un valor de enum
--  recien anadido no se puede usar en la misma transaccion. Por eso son dos
--  archivos, y por eso este empieza negandose a correr si aquel no corrio.
--
--  --- Las TRES cosas que hace, y ninguna es opcional ------------------------
--
--  1. SIEMBRA la matriz de los cuatro roles nuevos.
--  2. LE QUITA a COMERCIAL sus cinco filas: el valor sigue en el enum --no se
--     puede quitar-- pero deja de autorizar nada.
--  3. CAMBIA EL DEFAULT de `usuarios.rol` y MIGRA a los que lo tengan. Si el
--     default se quedara en 'COMERCIAL', cada usuario nuevo sin rol explicito
--     naceria con un rol que a partir de aqui NO PUEDE HACER NADA, y el sintoma
--     --«entro y no veo ninguna pantalla»-- no senala la causa.
--
--  --- El modulo `precios` es NUEVO, y hay que explicar por que --------------
--
--  El ADR pide que el VENDEDOR cotice y aplique codigos pero NO los cree. Eso
--  era IMPOSIBLE de expresar hasta hoy: desde el 2026-09-29 por la manana, los
--  diez route.ts del catalogo de precio --franjas, temporadas, escalas de
--  volumen, codigos y paquetes-- exigian `comercial.crear`, que es EXACTAMENTE
--  el mismo permiso con el que se crea una propuesta. Un vendedor que pueda
--  cotizar podria crear cupones, y la matriz no tiene forma de separarlos.
--
--  Asi que el catalogo de precio pasa a su propio modulo, `precios`, y los diez
--  guards con el. No es una vuelta atras de aquella decision: aquella movio las
--  pantallas de Inventario a Comercial --de quien es el TRABAJO-- y esta separa
--  QUIEN PUEDE ESCRIBIRLO, que es otra pregunta.
--
--  Consecuencia que se dice antes de hacerla: `DUENO` pasa de 24 filas a 26.
--
--  --- Lo que NO se puede expresar, y queda como pregunta al dueno -----------
--
--  El ADR quiere que el GERENTE DE VENTAS cree paquetes SIN autorizacion y
--  codigos PIDIENDOLA. Las dos cosas son `precios.crear`: el vocabulario de
--  acciones (ver/crear/aprobar/facturar) no distingue una de otra. Aqui el
--  gerente recibe `precios.crear` ENTERO --o sea que tambien crea codigos-- y
--  eso queda anotado como pregunta, no escondido. Separarlo de verdad seria un
--  modulo mas (`codigos`), y eso es una decision de producto.
--
--  --- Por que NO lleva `-- @tipo: datos`, aunque reescriba filas ------------
--
--  Con esa marca el runner la omite salvo `--con-datos`, y `update.sh` no la
--  pasa a proposito. Una instancia se actualizaria con los cuatro valores del
--  enum puestos y la matriz sin sembrar: cuatro roles que existen y no
--  autorizan nada, y un COMERCIAL sin permisos y sin rol nuevo. Mismo criterio
--  que `20260819_semilla_rol_permisos.sql`, que lo explica en su cabecera: esto
--  no es una correccion de datos de un tenant, es configuracion de PRODUCTO.
--
--  Idempotente: `on conflict do nothing` en el insert, y el `delete`, el
--  `update` y el `set default` son todos convergentes.
-- ============================================================================

begin;

-- --- 0 · GUARD: el rol que aplica esto tiene que SALTAR la RLS de `usuarios` -
--
-- `usuarios` es fail-closed + FORCE (`20260720_hard1_usuarios_rls.sql`). Si el
-- rol que corre esta migracion no saltara la RLS, el `update` de mas abajo NO
-- FALLARIA: afectaria a CERO filas EN SILENCIO, porque `app.tenant_id` no esta
-- fijado y la politica compara contra NULL. Los COMERCIAL se quedarian sin
-- permisos y sin rol nuevo, y nada lo diria. Es el modo de fallo de la zona R2
-- del proyecto --el mismo que dejo el desbloqueo de usuarios inservible un
-- despliegue entero-- y por eso se comprueba ANTES en vez de confiar.
do $$
begin
  if not exists (
    select 1 from pg_roles
     where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception
      'El rol % no salta la RLS de `usuarios` (ni rolsuper ni rolbypassrls). '
      'El `update` de esta migracion afectaria a CERO filas en silencio. '
      'Aplicala con el mismo rol que aplico 20260720_hard1_usuarios_rls.sql.',
      current_user;
  end if;
end $$;

-- --- 1 · GUARD: los cuatro valores del enum ya existen ---------------------
-- Si esto salta, la migracion de al lado no se aplico antes. Es el guard que
-- convierte el orden lexicografico en un contrato: sin el, el fallo seria un
-- «invalid input value for enum» a mitad del insert, con parte del trabajo
-- hecho y sin decir cual es el problema de verdad.
do $$
declare faltan text;
begin
  select string_agg(v, ', ' order by v) into faltan
    from (values ('ADMINISTRADOR'),('DIRECTOR_COMERCIAL'),('GERENTE_VENTAS'),('VENDEDOR')) as c(v)
   where not exists (
     select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'rol_demo' and e.enumlabel = c.v
   );
  if faltan is not null then
    raise exception
      'Al enum rol_demo le faltan los valores: %. Aplica antes '
      '20260929_roles_de_venta_enum.sql (van en ESE orden a proposito: un valor '
      'de enum no se puede usar en la transaccion que lo anade).', faltan;
  end if;
end $$;

-- --- 2 · La matriz ---------------------------------------------------------
--
-- Se escribe LITERAL y no como `insert ... select ... where rol = 'DUENO'`.
-- Derivarla del Dueno haria que «el administrador tiene lo mismo que el Dueno»
-- fuera cierto por construccion, y entonces la prueba que lo comprueba no
-- diria nada. Ademas copiaria los permisos que alguien haya concedido a mano en
-- una base concreta, que es exactamente lo que no se quiere: la politica de
-- acceso de una instancia nueva la fija el repositorio, no el ultimo script que
-- corrio (leccion de ROJO-2, el 2026-08-20).
insert into rol_permisos (rol, modulo, accion)
values
  -- DUENO · lo unico que gana es el modulo nuevo. Sus otras 24 filas las puso
  -- `20260820_catalogo_permisos_completo.sql` y no se tocan.
  ('DUENO',              'precios',        'ver'),
  ('DUENO',              'precios',        'crear'),

  -- ADMINISTRADOR · las MISMAS 26 del Dueno, escritas una por una.
  -- Lo que NO le dan estas filas, y hay que saberlo: los sitios donde 'DUENO'
  -- esta escrito a mano FUERA de esta tabla. Son cuatro, medidos el 29/09:
  --   · `lib/server/tenant.ts` (puedeCambiarCrm y el override de tenant)
  --     -> NO se abre. Cambiar de organizacion es de FLOTA, no de empresa.
  --   · `app/api/organizacion/route.ts` y `configuracion/page.tsx`
  --     -> SI se abren, en este mismo commit.
  --   · `inventario/page.tsx` («exclusiva del Dueno») -> SI se abre.
  ('ADMINISTRADOR',      'administracion', 'ver'),
  ('ADMINISTRADOR',      'administracion', 'crear'),
  ('ADMINISTRADOR',      'administracion', 'aprobar'),
  ('ADMINISTRADOR',      'arrendadores',   'ver'),
  ('ADMINISTRADOR',      'arrendadores',   'crear'),
  ('ADMINISTRADOR',      'arrendadores',   'aprobar'),
  ('ADMINISTRADOR',      'comercial',      'ver'),
  ('ADMINISTRADOR',      'comercial',      'crear'),
  ('ADMINISTRADOR',      'comercial',      'aprobar'),
  ('ADMINISTRADOR',      'dashboard',      'ver'),
  ('ADMINISTRADOR',      'finanzas',       'ver'),
  ('ADMINISTRADOR',      'finanzas',       'crear'),
  ('ADMINISTRADOR',      'finanzas',       'facturar'),
  ('ADMINISTRADOR',      'imprenta',       'ver'),
  ('ADMINISTRADOR',      'imprenta',       'crear'),
  ('ADMINISTRADOR',      'imprenta',       'aprobar'),
  ('ADMINISTRADOR',      'inventario',     'ver'),
  ('ADMINISTRADOR',      'inventario',     'crear'),
  ('ADMINISTRADOR',      'inventario',     'aprobar'),
  ('ADMINISTRADOR',      'network',        'ver'),
  ('ADMINISTRADOR',      'network',        'crear'),
  ('ADMINISTRADOR',      'operaciones',    'ver'),
  ('ADMINISTRADOR',      'operaciones',    'crear'),
  ('ADMINISTRADOR',      'operaciones',    'aprobar'),
  ('ADMINISTRADOR',      'precios',        'ver'),
  ('ADMINISTRADOR',      'precios',        'crear'),

  -- DIRECTOR_COMERCIAL · vende, aprueba lo vendido y DEFINE el catalogo de
  -- precio. No administra usuarios, no toca inventario mas que para mirarlo, y
  -- no ve finanzas: «aprobar un descuento sin ver el margen es firmar a ciegas»
  -- sigue siendo la pregunta 3 del ADR, y abrirle `finanzas` por si acaso seria
  -- decidirla sin que nadie la decida.
  ('DIRECTOR_COMERCIAL', 'comercial',      'ver'),
  ('DIRECTOR_COMERCIAL', 'comercial',      'crear'),
  ('DIRECTOR_COMERCIAL', 'comercial',      'aprobar'),
  ('DIRECTOR_COMERCIAL', 'dashboard',      'ver'),
  ('DIRECTOR_COMERCIAL', 'inventario',     'ver'),
  ('DIRECTOR_COMERCIAL', 'network',        'ver'),
  ('DIRECTOR_COMERCIAL', 'precios',        'ver'),
  ('DIRECTOR_COMERCIAL', 'precios',        'crear'),

  -- GERENTE_VENTAS · HOY identico al director, y eso se dice en voz alta en vez
  -- de disimularlo. Las TRES diferencias que el ADR les pone --el techo de
  -- descuento por rol, quien autoriza al aprobar y los preaprobados-- son
  -- justo lo que este tramo NO construye. Cuando lleguen, se separan ahi, que
  -- es donde viven: ninguna de las tres es un par (modulo, accion).
  ('GERENTE_VENTAS',     'comercial',      'ver'),
  ('GERENTE_VENTAS',     'comercial',      'crear'),
  ('GERENTE_VENTAS',     'comercial',      'aprobar'),
  ('GERENTE_VENTAS',     'dashboard',      'ver'),
  ('GERENTE_VENTAS',     'inventario',     'ver'),
  ('GERENTE_VENTAS',     'network',        'ver'),
  ('GERENTE_VENTAS',     'precios',        'ver'),
  ('GERENTE_VENTAS',     'precios',        'crear'),

  -- VENDEDOR · cotiza y APLICA lo que otros definieron. `precios.ver` sin
  -- `precios.crear` es la linea entera del ADR: elige un cupon de la lista, no
  -- lo inventa. Y sin `comercial.aprobar`: quien aprueba una propuesta con
  -- descuento es su jefe, y el reparto fino de eso es el tramo siguiente.
  ('VENDEDOR',           'comercial',      'ver'),
  ('VENDEDOR',           'comercial',      'crear'),
  ('VENDEDOR',           'dashboard',      'ver'),
  ('VENDEDOR',           'inventario',     'ver'),
  ('VENDEDOR',           'network',        'ver'),
  ('VENDEDOR',           'precios',        'ver')
on conflict (rol, modulo, accion) do nothing;

-- --- 3 · COMERCIAL se retira DE USO ----------------------------------------
--
-- Sin filas, el valor existe y no autoriza nada: `permisosDeRol` y
-- `tienePermiso` (`apps/web/lib/server/auth.ts`) son consultas directas a esta
-- tabla, sin excepcion para ningun rol, y `exigir()` es fail-closed.
--
-- Se borran SUS filas y solo las suyas. Un `delete` mas ancho se llevaria por
-- delante permisos concedidos a mano en una base concreta, que es una decision
-- de quien administra esa instancia y no de esta migracion.
delete from rol_permisos where rol = 'COMERCIAL';

-- Y su gente pasa a VENDEDOR. Decidido por el dueno el 2026-09-29: es lo que
-- hace hoy un COMERCIAL. NO es una decision de codigo --a una persona se le
-- esta asignando un puesto-- y por eso estaba en el ADR como pregunta 10.
update usuarios set rol = 'VENDEDOR' where rol = 'COMERCIAL';

-- El default de la columna. `db/schema.sql` la crea con `default 'COMERCIAL'` y
-- ese archivo no se edita: los cambios van por migracion, asi que una base
-- nueva nace con el default viejo y esta linea lo corrige un momento despues.
alter table usuarios alter column rol set default 'VENDEDOR';

-- --- 4 · ASSERT: lo que esta migracion promete, cumplido -------------------
--
-- Se comprueba PRESENCIA y AUSENCIA, nunca el total de la tabla. Un
-- `count(*) = 86` abortaria en cualquier base donde alguien haya concedido un
-- permiso de mas a proposito (`apps/web/scripts/a4-candado-banco.mjs` hace
-- justo eso), y negarse a actualizar por eso seria peor que el problema que se
-- arregla. Esta migracion responde de SUS filas; de las demas, no.
do $$
declare faltan text; quedan int;
begin
  select string_agg(format('%s.%s.%s', c.rol, c.modulo, c.accion), ', ' order by 1)
    into faltan
    from (values
      ('DUENO','precios','ver'),('DUENO','precios','crear'),
      ('ADMINISTRADOR','administracion','ver'),('ADMINISTRADOR','administracion','crear'),
      ('ADMINISTRADOR','administracion','aprobar'),
      ('ADMINISTRADOR','arrendadores','ver'),('ADMINISTRADOR','arrendadores','crear'),
      ('ADMINISTRADOR','arrendadores','aprobar'),
      ('ADMINISTRADOR','comercial','ver'),('ADMINISTRADOR','comercial','crear'),
      ('ADMINISTRADOR','comercial','aprobar'),
      ('ADMINISTRADOR','dashboard','ver'),
      ('ADMINISTRADOR','finanzas','ver'),('ADMINISTRADOR','finanzas','crear'),
      ('ADMINISTRADOR','finanzas','facturar'),
      ('ADMINISTRADOR','imprenta','ver'),('ADMINISTRADOR','imprenta','crear'),
      ('ADMINISTRADOR','imprenta','aprobar'),
      ('ADMINISTRADOR','inventario','ver'),('ADMINISTRADOR','inventario','crear'),
      ('ADMINISTRADOR','inventario','aprobar'),
      ('ADMINISTRADOR','network','ver'),('ADMINISTRADOR','network','crear'),
      ('ADMINISTRADOR','operaciones','ver'),('ADMINISTRADOR','operaciones','crear'),
      ('ADMINISTRADOR','operaciones','aprobar'),
      ('ADMINISTRADOR','precios','ver'),('ADMINISTRADOR','precios','crear'),
      ('DIRECTOR_COMERCIAL','comercial','ver'),('DIRECTOR_COMERCIAL','comercial','crear'),
      ('DIRECTOR_COMERCIAL','comercial','aprobar'),('DIRECTOR_COMERCIAL','dashboard','ver'),
      ('DIRECTOR_COMERCIAL','inventario','ver'),('DIRECTOR_COMERCIAL','network','ver'),
      ('DIRECTOR_COMERCIAL','precios','ver'),('DIRECTOR_COMERCIAL','precios','crear'),
      ('GERENTE_VENTAS','comercial','ver'),('GERENTE_VENTAS','comercial','crear'),
      ('GERENTE_VENTAS','comercial','aprobar'),('GERENTE_VENTAS','dashboard','ver'),
      ('GERENTE_VENTAS','inventario','ver'),('GERENTE_VENTAS','network','ver'),
      ('GERENTE_VENTAS','precios','ver'),('GERENTE_VENTAS','precios','crear'),
      ('VENDEDOR','comercial','ver'),('VENDEDOR','comercial','crear'),
      ('VENDEDOR','dashboard','ver'),('VENDEDOR','inventario','ver'),
      ('VENDEDOR','network','ver'),('VENDEDOR','precios','ver')
    ) as c(rol, modulo, accion)
   where not exists (
     select 1 from rol_permisos p
      where p.rol::text = c.rol and p.modulo = c.modulo and p.accion = c.accion
   );
  if faltan is not null then
    raise exception 'La matriz del ADR 0040 quedo incompleta. Faltan: %', faltan;
  end if;

  -- El vendedor NO escribe el catalogo de precio. Si esta fila apareciera, la
  -- linea entera del ADR se cae sin que nada de err.
  if exists (
    select 1 from rol_permisos
     where rol::text = 'VENDEDOR' and modulo = 'precios' and accion <> 'ver'
  ) then
    raise exception 'El rol VENDEDOR tiene escritura sobre `precios`: el ADR 0040 dice que solo la ve.';
  end if;

  -- Y COMERCIAL se queda a cero.
  select count(*) into quedan from rol_permisos where rol::text = 'COMERCIAL';
  if quedan > 0 then
    raise exception 'El rol COMERCIAL conserva % filas en rol_permisos y deberia quedarse sin ninguna.', quedan;
  end if;
end $$;

commit;

-- --- Verificacion ----------------------------------------------------------
--   select rol::text, count(*) from rol_permisos group by 1 order by 1;
--   -- En una instancia recien aprovisionada se esperan 86 filas, 10 modulos y
--   -- 8 roles: ADMINISTRADOR 26 · DIRECTOR_COMERCIAL 8 · DUENO 26 ·
--   -- FINANZAS 4 · GERENTE_VENTAS 8 · IMPRENTA 3 · OPERACIONES 5 · VENDEDOR 6.
--   -- En una base con permisos concedidos a mano pueden ser mas: lo que esta
--   -- migracion garantiza es que las suyas esten.
--
--   select count(*) from usuarios where rol = 'COMERCIAL';   -- 0
--   select column_default from information_schema.columns
--    where table_name = 'usuarios' and column_name = 'rol';  -- 'VENDEDOR'::rol_demo
--
-- --- ROLLBACK --------------------------------------------------------------
-- Se incluye por disciplina. Ojo con la tercera linea: NO devuelve a su rol a
-- quien era COMERCIAL, porque despues de esta migracion no hay forma de saber
-- quien lo era y quien es vendedor de nacimiento. Si hay que poder deshacerlo,
-- hay que capturar la lista ANTES:
--
--   select id, email from usuarios where rol = 'COMERCIAL';   -- ANTES de aplicar
--
--   delete from rol_permisos
--    where rol::text in ('ADMINISTRADOR','DIRECTOR_COMERCIAL','GERENTE_VENTAS','VENDEDOR')
--       or (rol::text = 'DUENO' and modulo = 'precios');
--   insert into rol_permisos (rol, modulo, accion) values
--     ('COMERCIAL','comercial','ver'),('COMERCIAL','comercial','crear'),
--     ('COMERCIAL','dashboard','ver'),('COMERCIAL','inventario','ver'),
--     ('COMERCIAL','network','ver')
--   on conflict do nothing;
--   alter table usuarios alter column rol set default 'COMERCIAL';
--   -- y, con la lista capturada arriba:
--   -- update usuarios set rol = 'COMERCIAL' where id in (...);
