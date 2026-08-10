-- ===========================================================================
--  ROLLBACK de 20260810_reset_tenant_eyro.sql
--
--  ###########################################################################
--  #  ESTO NO ES UN ROLLBACK DE VERDAD. LEELO ANTES DE USARLO.               #
--  ###########################################################################
--
--  El script original BORRA datos. No hay forma de recuperarlos desde aqui: no
--  quedan en ninguna tabla, ni en la bitacora (que guarda que se hizo algo, no
--  el contenido).
--
--  >>> LA UNICA MARCHA ATRAS REAL ES EL RESPALDO DEL PASO 0.1. <<<
--
--  Se escribe igualmente y con este nombre porque la convencion de
--  docs/datos/README.md lo exige, y porque callarlo seria peor: alguien
--  buscaria el `_rollback.sql`, no lo encontraria, y supondria que el script
--  original era reversible.
--
--  Este fichero solo sirve para UNA cosa: deshacer la parte de RECREACION si
--  el tenant nuevo estorba (por ejemplo, si se va a restaurar el respaldo y el
--  slug «eyro» tiene que quedar libre para que la restauracion no choque).
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  A · RECUPERAR LOS DATOS — con el respaldo, no con SQL
-- ---------------------------------------------------------------------------
--
--  Restaurar el volcado completo sobre una base APARTE y sacar de ahi lo de
--  `eyro`. NO se restaura encima de `spaces_prod`: eso se llevaria por delante
--  todo lo que las otras organizaciones hayan hecho desde el reinicio.
--
--    sudo -u postgres createdb spaces_restore
--    zcat ~/backups/spaces_prod_pre_reset_eyro_*.sql.gz \
--      | sudo -u postgres psql -d spaces_restore
--
--    -- comprobar que el eyro viejo esta ahi:
--    sudo -u postgres psql -d spaces_restore -c \
--      "select id, nombre, slug from tenants where slug='eyro';"
--
--  Y desde ahi, copiar tabla por tabla en el orden INVERSO al del borrado
--  (padres antes que hijos). Es un trabajo manual y hay que hacerlo con
--  cuidado: el tenant nuevo tiene OTRO uuid, asi que o se borra primero (parte
--  B) o hay que reescribir todos los `tenant_id` al vuelo.
--
--  Antes de empezar, decide cual de las dos:
--    · el uuid VIEJO (mas facil: los datos vienen con el puesto) -> parte B;
--    · el uuid NUEVO (hay que reescribirlo en cada fila) -> mas trabajo, sin
--      ninguna ventaja. No se recomienda.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
--  B · QUITAR EL TENANT RECREADO (para dejar libre el slug «eyro»)
-- ---------------------------------------------------------------------------
--  Solo tiene sentido si el tenant nuevo esta VACIO, o sea si nadie lo ha
--  usado desde el reinicio. Si ya hay datos de prueba nuevos dentro, esto los
--  borra: la guarda de abajo lo impide y hay que decidirlo a conciencia.

\set ON_ERROR_STOP on

begin;

create temporary table _nuevo on commit drop as
  select id from tenants where slug = 'eyro';

do $$
declare
  v_id uuid;
  v_n  int;
  t    text;
  tablas text[] := array[
    'almacen_activos','almacen_movimientos','arrendador_razon_social',
    'arrendadores','campanas','clientes','cobranzas','contrato_firmas',
    'contratos_arrendamiento','creatividades','doohmain_consultas_play',
    'evidencias_ot','facturas','incidencias','licencias','notificaciones',
    'ordenes_compra','ordenes_impresion','ordenes_trabajo','pagos_renta',
    'password_resets','predios','propuesta_items','propuestas','reservas',
    'sitio_modalidades','sitios'];
begin
  select id into v_id from _nuevo;
  if v_id is null then
    raise exception 'No hay ningun tenant con slug «eyro». Nada que quitar.';
  end if;

  -- GUARDA: si alguien ya trabajo en el tenant recreado, para.
  foreach t in array tablas loop
    execute format('select count(*) from %I where tenant_id = $1', t)
      into v_n using v_id;
    if v_n <> 0 then
      raise exception
        'El tenant recreado YA TIENE datos (% filas en %). Esto no es un tenant virgen: revisalo a mano antes de borrarlo.',
        v_n, t;
    end if;
  end loop;
end $$;

select set_config('app.tenant_id', (select id::text from _nuevo), false);

-- Solo lo que el script original creo: su Dueno, su configuracion y la fila
-- del tenant. Las identidades de Google del Dueno caen por cascada.
delete from identidades_externas where tenant_id = (select id from _nuevo);
delete from usuarios             where tenant_id = (select id from _nuevo);
delete from config_negocio       where tenant_id = (select id from _nuevo);
delete from tenants              where id        = (select id from _nuevo);

-- La bitacora NO se toca: es append-only, y una entrada de auditoria no se
-- borra porque se deshaga lo que registro. Se deja, y esta anade la suya.
-- Va sin `tenant_id` de eyro porque ya no existe: se registra en el tenant de
-- plataforma para que quede en algun sitio visible.
insert into acciones (accion, entidad, usuario_nombre, tenant_id)
select 'Rollback: se quito el tenant «eyro» recreado',
       'Deshace la parte de recreacion de 20260810_reset_tenant_eyro.sql. Los datos borrados NO se recuperan con esto: hace falta el respaldo.',
       'Sistema', id
  from tenants order by creado_en limit 1;

do $$
begin
  if exists (select 1 from tenants where slug = 'eyro') then
    raise exception 'El tenant «eyro» sigue ahi.';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
--  DESPUES
--  · El slug «eyro» queda libre para restaurar el viejo desde el respaldo.
--  · Si no se va a restaurar nada, la organizacion simplemente ya no existe y
--    hay que volver a crearla desde el panel (o con la parte 3 del script
--    original).
-- ---------------------------------------------------------------------------
