-- ===========================================================================
--  CARGA DE LOS DATOS DE g500 EN SU INSTANCIA
--  Plan: docs/Plan_Migracion_Datos_g500.md · etapa E4
--  Censo: docs/evidencias/migracion-g500-E2-censo.md
--  Generado: 2026-09-09 desde la base puente, a partir del dump del droplet
--            viejo (sha256 67ecf51d…)
--
--  QUE HACE
--    Mete 541 filas de negocio de g500 y actualiza su configuracion. Todo
--    dentro de UNA transaccion: entra completo o no entra nada.
--
--  QUE NO TRAE
--    Ninguna persona. Ni usuarios, ni credenciales, ni sesiones. Las columnas
--    que nombran a un usuario llegan en nulo, a proposito.
--    Tampoco la bitacora (`acciones`): es append-only por trigger, y cargarla
--    dejaria esta operacion sin marcha atras en el sitio. Decidido el 09/09
--    con su contenido delante -- 175 filas de `Sistema` y del usuario `DEMO`.
--
--  COMO SE APLICA
--    psql "<conexion>" -v ON_ERROR_STOP=1 -f <este archivo>
--    Con un rol SUPERUSUARIO. Con el rol de la aplicacion, la RLS fail-closed
--    haria que los insert no vieran nada y el fallo seria SILENCIOSO (R2).
--
--  EL TENANT DESTINO NO ESTA ESCRITO EN NINGUNA PARTE
--    Se resuelve por slug contra la propia instancia. Ningun UUID real viaja
--    en este archivo.
-- ===========================================================================
\set ON_ERROR_STOP on
\timing off

begin;

-- ─── Guard 1 · la organizacion tiene que existir ───────────────────────────
do $$
declare destino uuid;
begin
  select id into destino from tenants where slug = 'g500';
  if destino is null then
    raise exception 'No hay ninguna organizacion con slug g500 en esta instancia. Slugs presentes: %',
      (select coalesce(string_agg(slug, ', '), '(ninguno)') from tenants);
  end if;
  raise notice 'Organizacion destino encontrada.';
end $$;

-- ─── Guard 2 · no cargar dos veces ─────────────────────────────────────────
-- Este archivo NO es idempotente: los id vienen del origen, asi que una
-- segunda pasada chocaria contra las claves primarias a mitad de camino. Se
-- para antes, con un mensaje que se entiende.
do $$
declare n int;
begin
  select count(*) into n from sitios where tenant_id = (select id from tenants where slug='g500');
  if n > 0 then
    raise exception 'Esta instancia YA tiene % pantallas de g500. La carga ya se hizo: no se repite.', n;
  end if;
end $$;

-- ─── Foto de ANTES ─────────────────────────────────────────────────────────
-- Se guarda cuanta gente y cuanta bitacora habia al empezar, para comprobar al
-- final que esta carga no metio ninguna de las dos. Comparar contra la foto y
-- no contra un numero fijo: esta instancia puede haber invitado gente ya, y esa
-- carga no tiene por que saberlo.
create temp table _antes on commit drop as
select (select count(*) from usuarios where tenant_id = (select id from tenants where slug='g500')) as usuarios,
       (select count(*) from acciones where tenant_id = (select id from tenants where slug='g500')) as bitacora;

-- ─── Esquema de estacionamiento ────────────────────────────────────────────
-- Los datos aterrizan aqui primero, se les cambia el tenant, y de aqui pasan a
-- las tablas de verdad. Se hace asi porque un COPY no puede resolver el tenant
-- con una subconsulta, y quemar el UUID en el archivo era justo lo que no
-- queriamos.
create schema carga_g500;

create table carga_g500.arrendador_razon_social (like public.arrendador_razon_social);
create table carga_g500.arrendadores            (like public.arrendadores);
create table carga_g500.campanas                (like public.campanas);
create table carga_g500.clientes                (like public.clientes);
create table carga_g500.cobranzas               (like public.cobranzas);
create table carga_g500.config_negocio          (like public.config_negocio);
create table carga_g500.contratos_arrendamiento (like public.contratos_arrendamiento);
create table carga_g500.creatividades           (like public.creatividades);
create table carga_g500.evidencias_ot           (like public.evidencias_ot);
create table carga_g500.facturas                (like public.facturas);
create table carga_g500.folios_consecutivos     (like public.folios_consecutivos);
create table carga_g500.notificaciones          (like public.notificaciones);
create table carga_g500.ordenes_compra          (like public.ordenes_compra);
create table carga_g500.ordenes_trabajo         (like public.ordenes_trabajo);
create table carga_g500.pagos_renta             (like public.pagos_renta);
create table carga_g500.predios                 (like public.predios);
create table carga_g500.propuesta_items         (like public.propuesta_items);
create table carga_g500.propuestas              (like public.propuestas);
create table carga_g500.reservas                (like public.reservas);
create table carga_g500.sitio_modalidades       (like public.sitio_modalidades);
create table carga_g500.sitios                  (like public.sitios);

-- ===========================================================================
--  LOS DATOS
-- ===========================================================================
