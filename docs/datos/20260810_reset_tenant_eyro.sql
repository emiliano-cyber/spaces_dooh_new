-- ===========================================================================
--  REINICIO DEL TENANT DE PRUEBAS `eyro` — borrar todo y recrearlo desde cero.
--
--  Pedido por el usuario el 10/08. `eyro` es su perfil de PRUEBAS
--  (ver vault/02-Backend/multi-tenancy-y-rls.md).
--
--  ESTO ES DESTRUCTIVO Y VA CONTRA PRODUCCION. No lo corras sin leer entero el
--  PASO 0 y sin el respaldo hecho.
--
--  ###########################################################################
--  #  LO QUE ESTE SCRIPT **NO** PUEDE DESHACER                               #
--  ###########################################################################
--
--  1. LO PUBLICADO EN DOOHMAIN SIGUE EN LAS PANTALLAS.
--     `DOOHMAIN_PUBLISH_ENABLED=1` en produccion y hay folios reales
--     (`EYRO20260709622`). Borrar filas de esta base NO retira nada de ninguna
--     pantalla: eso lo decide el SDK de DOOHmain, no un `delete`.
--     Peor aun: al borrar las campanas se pierde el rastro de QUE se publico,
--     asi que despues ya no se sabe que hay que retirar.
--     >>> Si hay algo publicado que deba bajarse, RETIRALO ANTES por su
--         flujo normal, y solo despues corre esto. <<<
--
--  2. LA BITACORA DE `eyro` NO SE BORRA, Y ES A PROPOSITO.
--     `acciones` tiene un trigger `append_only` que rechaza DELETE **incluso
--     para el superusuario** (`20260629_bitacora_append_only.sql`). La unica
--     forma de saltarselo seria `TRUNCATE` —que se llevaria la bitacora de
--     TODAS las organizaciones— o tirar el trigger un rato, que es justo la
--     garantia que da valor a la bitacora.
--     Sus filas quedan HUERFANAS de tenant: invisibles para la aplicacion
--     (ninguna organizacion las reclama por RLS) e inertes. Se aceptan.
--
--  3. LOS FOLIOS CONSUMIDOS NO SE DEVUELVEN.
--     `folios_consecutivos` es global y sin `tenant_id`. El contador sigue
--     donde estaba. Es lo correcto: reutilizar folios ya emitidos seria peor
--     que saltarselos.
--
--  ###########################################################################
--
--  ORDEN DE BORRADO — no es arbitrario. Hay 13 claves foraneas con RESTRICT
--  (`facturas->campanas`, `reservas->sitios`, `sitios->predios`,
--  `predios->arrendadores`, `contratos->arrendadores|predios|sitios`,
--  `propuesta_items->sitios`, `campanas|facturas->clientes`...). Con el orden
--  mal, el borrado revienta a mitad y deja el tenant medio vacio. Los hijos
--  van primero, siempre.
--
--  `clientes.agencia_id` y `propuestas.agencia_id` se autorreferencian con
--  NO ACTION: se comprueban al FINAL de la sentencia, asi que un unico DELETE
--  por tabla funciona aunque una agencia sea cliente de otra.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  PASO 0 · ANTES DE NADA
-- ---------------------------------------------------------------------------
--
--  0.1 · RESPALDO. Sin esto no hay vuelta atras: el rollback de este script
--        NO restaura datos, solo deja el tenant utilizable.
--
--    sudo -u postgres pg_dump spaces_prod | gzip \
--      > ~/backups/spaces_prod_pre_reset_eyro_$(date +%Y%m%d_%H%M%S).sql.gz
--
--    Comprobar que trae DATOS (no solo esquema):
--      zcat ~/backups/spaces_prod_pre_reset_eyro_*.sql.gz | grep -c '^COPY'
--    >>> Como `postgres`, NO como el rol de la app: `spaces_user` es
--        NOBYPASSRLS y el volcado saldria SIN FILAS pareciendo bueno. <<<
--
--  0.2 · Anotar el id y los datos fiscales del tenant, que el paso 3 recrea:
--    select id, nombre, slug, moneda, razon_social, nombre_comercial, rfc,
--           domicilio_fiscal, representante_legal, datos_constitucion,
--           exigir_reautenticacion
--      from tenants where slug = 'eyro';
--
--  0.3 · Anotar SUS USUARIOS. El paso 3 recrea UNO; si habia mas, hay que
--        volver a darlos de alta desde Administracion.
--    select id, nombre, email, cargo, rol, activo from usuarios
--     where tenant_id = (select id from tenants where slug='eyro');
--
--  0.4 · Ver que se va a perder, para no llevarse una sorpresa:
--    select set_config('app.tenant_id',
--           (select id::text from tenants where slug='eyro'), false);
--    select 'campanas' t, count(*) from campanas union all
--    select 'facturas', count(*) from facturas union all
--    select 'sitios', count(*) from sitios union all
--    select 'reservas', count(*) from reservas union all
--    select 'creatividades', count(*) from creatividades union all
--    select 'propuestas', count(*) from propuestas union all
--    select 'clientes', count(*) from clientes union all
--    select 'arrendadores', count(*) from arrendadores union all
--    select 'usuarios', count(*) from usuarios;
--
--  0.5 · ¿QUEDA ALGO PUBLICADO EN DOOHMAIN? Si esto devuelve filas, decide
--        antes si hay que retirarlo (ver aviso 1 de la cabecera):
--    select c.folio, c.nombre, c.estado_comercial, c.validacion_estatus
--      from campanas c where c.enviada_dominio;
--
--  0.6 · ENSAYO: este mismo archivo con `commit` cambiado por `rollback`.
--        Debe llegar al final sin excepcion. Anota los conteos que imprime.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

-- ###########################################################################
--  EDITA ESTA LINEA ANTES DE CORRER. Sale del PASO 0.3.
--
--  El correo del Dueno NO va escrito a mano en el script, y no es purismo: el
--  indice `usuarios_email_lower_uidx` es UNICO GLOBAL, no por organizacion. Si
--  el correo que pongas pertenece a OTRA organizacion, la recreacion revienta
--  DESPUES de haber borrado todo — y te quedas sin tenant y sin Dueno.
--
--  Lo cazo el ensayo en local: `emistreg@gmail.com` resulto ser de
--  `emis-pruebas`, no de `eyro`. El runbook de INC-02 nombra ese correo y
--  `yahel@adavailable.com` juntos, y su «(Dueno de eyro)» es ambiguo sobre
--  cual de los dos lo es. Comprobalo con el PASO 0.3, no lo supongas.
-- ###########################################################################
\set duenio_email 'CAMBIAME@ejemplo.com'
\set duenio_nombre 'Dueño de pruebas'

begin;

-- ─── 1. Localizar el tenant y fijar el contexto ────────────────────────────
-- El id NO se escribe a mano: se resuelve por slug. Un uuid copiado mal aqui
-- borra la organizacion equivocada.
create temporary table _eyro on commit drop as
  select id from tenants where slug = 'eyro';

-- Las variables de psql pasan por una tabla temporal y NO se usan dentro de los
-- bloques `do $$ ... $$`. No es rodeo: psql sustituye `:'var'` en el lexer y se
-- SALTA el texto entre comillas de dolar, asi que ahi dentro llegan literales y
-- el bloque revienta con «syntax error at or near ":"». Lo cazo el ensayo.
create temporary table _cfg on commit drop as
  select lower(:'duenio_email')::text as email,
         :'duenio_nombre'::text       as nombre;

-- ─── 1b. GUARDAS PREVIAS · antes de borrar nada ────────────────────────────
-- Todo lo que pueda hacer fallar el paso 3 se comprueba AQUI. Fallar despues
-- del borrado deja la organizacion destruida y sin recrear, que es el peor
-- resultado posible de este script.
do $$
declare v_email text := (select email from _cfg);
begin
  if (select count(*) from _eyro) <> 1 then
    raise exception 'Se esperaba exactamente 1 tenant con slug «eyro» y hay %.',
      (select count(*) from _eyro);
  end if;

  if v_email = 'cambiame@ejemplo.com' then
    raise exception
      'Edita «\set duenio_email» al principio del script con el correo del Dueno (PASO 0.3).';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo «%» no tiene forma de correo.', v_email;
  end if;

  -- LA COMPROBACION QUE IMPORTA: el correo no puede ser de otra organizacion.
  if exists (
    select 1 from usuarios
     where lower(email) = v_email
       and tenant_id is distinct from (select id from _eyro)
  ) then
    raise exception
      'El correo % YA pertenece a otra organizacion (%). El indice de correo es unico GLOBAL: la recreacion fallaria DESPUES de borrarlo todo. Elige otro correo.',
      v_email,
      (select t.slug from usuarios u join tenants t on t.id = u.tenant_id
        where lower(u.email) = v_email limit 1);
  end if;
end $$;

select set_config('app.tenant_id', (select id::text from _eyro), false);

-- ─── 2. Borrado, de hijos a padres ─────────────────────────────────────────
-- Cada sentencia se acota por `tenant_id`: ninguna toca otra organizacion.

-- 2.1 · Finanzas (facturas bloquea campanas y clientes con RESTRICT)
delete from cobranzas               where tenant_id = (select id from _eyro);
delete from facturas                where tenant_id = (select id from _eyro);

-- 2.2 · Operaciones e imprenta
delete from evidencias_ot           where tenant_id = (select id from _eyro);
delete from ordenes_trabajo         where tenant_id = (select id from _eyro);
delete from ordenes_impresion       where tenant_id = (select id from _eyro);

-- 2.3 · Comercial (reservas y propuesta_items bloquean sitios)
delete from ordenes_compra          where tenant_id = (select id from _eyro);
delete from creatividades           where tenant_id = (select id from _eyro);
delete from reservas                where tenant_id = (select id from _eyro);
delete from campanas                where tenant_id = (select id from _eyro);
delete from propuesta_items         where tenant_id = (select id from _eyro);
delete from propuestas              where tenant_id = (select id from _eyro);
delete from clientes                where tenant_id = (select id from _eyro);

-- 2.4 · Arrendadores (contratos bloquean arrendadores, predios y sitios)
delete from contrato_firmas         where tenant_id = (select id from _eyro);
delete from pagos_renta             where tenant_id = (select id from _eyro);
delete from contratos_arrendamiento where tenant_id = (select id from _eyro);

-- 2.5 · Inventario (sitios bloquea predios; predios bloquea arrendadores)
delete from licencias               where tenant_id = (select id from _eyro);
delete from incidencias             where tenant_id = (select id from _eyro);
delete from sitio_modalidades       where tenant_id = (select id from _eyro);
delete from sitios                  where tenant_id = (select id from _eyro);
delete from predios                 where tenant_id = (select id from _eyro);
delete from arrendador_razon_social where tenant_id = (select id from _eyro);
delete from arrendadores            where tenant_id = (select id from _eyro);

-- 2.6 · Almacen e integraciones
delete from almacen_movimientos     where tenant_id = (select id from _eyro);
delete from almacen_activos         where tenant_id = (select id from _eyro);
delete from doohmain_consultas_play where tenant_id = (select id from _eyro);

-- 2.7 · Acceso. `usuarios` arrastra por cascada `sesiones`; las identidades de
-- Google se borran antes porque su FK a `tenants` es NO ACTION.
delete from notificaciones          where tenant_id = (select id from _eyro);
delete from password_resets         where tenant_id = (select id from _eyro);
delete from identidades_externas    where tenant_id = (select id from _eyro);
delete from usuarios                where tenant_id = (select id from _eyro);

-- 2.8 · La organizacion. `config_negocio` cae por cascada desde `tenants`.
delete from config_negocio          where tenant_id = (select id from _eyro);
delete from tenants                 where id        = (select id from _eyro);

-- NOTA: `acciones` NO se borra. Ver el aviso 2 de la cabecera.

-- ─── 3. Recrear el tenant desde cero ───────────────────────────────────────
-- Los datos fiscales nacen VACIOS a proposito: son de una empresa real y
-- copiarlos de la que se acaba de borrar seria arrastrar el estado que este
-- reinicio venia a limpiar. Se rellenan desde Configuracion.
insert into tenants (nombre, slug, moneda, razon_social, nombre_comercial, rfc,
                     domicilio_fiscal, representante_legal, datos_constitucion,
                     exigir_reautenticacion)
values ('Eyro', 'eyro', 'MXN', '', 'Eyro', '', '', '', '', false);

-- `config_negocio` NO tiene DEFAULT de `tenant_id` (ADR 0011, a proposito:
-- ahi se prefiere que un insert sin tenant FALLE). Se fija explicito.
insert into config_negocio (tenant_id, moneda)
select id, 'MXN' from tenants where slug = 'eyro';

-- El Dueno, con el correo que fijaste arriba. Entra con GOOGLE: la primera vez
-- se vincula por correo verificado y despues por `sub` (ADR 0012).
--
-- La fila nace CON `password_hash` —bcrypt de un uuid que nadie conoce— porque
-- sin el no podria desbloquear operaciones de dinero (`cambios.ts:168-170`) ni
-- cambiar su perfil, y un restablecimiento lo dejaria encerrado. Es el mismo
-- invariante que respeta el alta «entra con Google» del producto.
insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
select (select nombre from _cfg), (select email from _cfg), 'Dueño', 'DUENO',
       crypt(gen_random_uuid()::text, gen_salt('bf', 10)), true, t.id
  from tenants t where t.slug = 'eyro';

-- ─── 4. Bitacora ───────────────────────────────────────────────────────────
-- A nombre del tenant NUEVO: el viejo ya no existe. Un reinicio a mano no
-- aparece en `git log` de ninguna otra forma.
insert into acciones (accion, entidad, usuario_nombre, tenant_id)
select 'Reinicio completo del tenant de pruebas',
       'Se borro todo el contenido de «eyro» y se recreo vacio (decision del usuario, 10/08)',
       'Sistema', id
  from tenants where slug = 'eyro';

-- ─── 5. Comprobacion dentro de la misma transaccion ────────────────────────
do $$
declare
  v_nuevo uuid;
  v_n     int;
  t       text;
  tablas  text[] := array[
    'almacen_activos','almacen_movimientos','arrendador_razon_social',
    'arrendadores','campanas','clientes','cobranzas','contrato_firmas',
    'contratos_arrendamiento','creatividades','doohmain_consultas_play',
    'evidencias_ot','facturas','identidades_externas','incidencias',
    'licencias','notificaciones','ordenes_compra','ordenes_impresion',
    'ordenes_trabajo','pagos_renta','password_resets','predios',
    'propuesta_items','propuestas','reservas','sitio_modalidades','sitios'];
begin
  select id into v_nuevo from tenants where slug = 'eyro';
  if v_nuevo is null then
    raise exception 'El tenant «eyro» no se recreo.';
  end if;

  -- Cero contenido en el tenant nuevo, tabla por tabla. Un `delete` que se
  -- hubiera saltado una tabla se ve AQUI y no dentro de tres semanas.
  foreach t in array tablas loop
    execute format('select count(*) from %I where tenant_id = $1', t)
      into v_n using v_nuevo;
    if v_n <> 0 then
      raise exception 'La tabla % quedo con % filas del tenant nuevo.', t, v_n;
    end if;
  end loop;

  -- Un solo usuario, Dueno, activo y CON hash (el invariante).
  select count(*) into v_n from usuarios where tenant_id = v_nuevo;
  if v_n <> 1 then
    raise exception 'Se esperaba 1 usuario en el tenant nuevo y hay %.', v_n;
  end if;
  if exists (select 1 from usuarios where tenant_id = v_nuevo
              and (password_hash is null or rol <> 'DUENO' or not activo)) then
    raise exception 'El Dueno del tenant nuevo esta mal: sin hash, sin rol o inactivo.';
  end if;

  -- Su fila de configuracion, exactamente una.
  select count(*) into v_n from config_negocio where tenant_id = v_nuevo;
  if v_n <> 1 then
    raise exception 'Se esperaba 1 fila de config_negocio y hay %.', v_n;
  end if;

  raise notice 'OK · tenant «eyro» recreado vacio con id %', v_nuevo;
end $$;

commit;

-- ---------------------------------------------------------------------------
--  DESPUES DE APLICAR
--
--  · Entrar con el correo que fijaste en `\set duenio_email`, por «Continuar
--    con Google». La primera vez se vincula por correo verificado y se graba
--    el `sub` (ADR 0012).
--  · Configuracion: rellenar razon social, RFC y domicilio fiscal, que nacen
--    vacios a proposito.
--  · Si habia mas usuarios (PASO 0.3), volver a darlos de alta desde
--    Administracion.
--  · La bitacora del `eyro` viejo sigue en `acciones`, huerfana e invisible.
--    Es lo esperado.
--  · Si algo seguia publicado en DOOHmain (PASO 0.5), ya no hay en esta base
--    rastro de que era. Comprobarlo por el lado de DOOHmain.
-- ---------------------------------------------------------------------------
