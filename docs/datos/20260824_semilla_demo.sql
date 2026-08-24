-- ============================================================================
--  Inventario de juguete para DEMO — F4.4, paso 2 del plan v3.
-- ----------------------------------------------------------------------------
--  Base destino: `spaces_demo`, en el PADRE (`137.184.107.53`).
--  Sirve `https://demo.space-os.io`.
--
--  ─── Qué siembra esto, y qué NO ───────────────────────────────────────────
--
--  SIEMBRA: dos arrendadores y seis pantallas inventadas, con tarifas
--  plausibles. Es lo que F4.4 llama «inventario ficticio».
--
--  NO SIEMBRA la organización ni su Dueño. Eso lo hace
--  `apps/web/scripts/bootstrap-auth.mjs`, que es la ÚNICA vía y tiene que
--  correr ANTES. Escribir el alta a mano aquí seria abrir un segundo camino
--  para crear identidades, y este proyecto ya sabe cómo acaba eso: hasta el
--  2026-08-20 hubo DOS catálogos de permisos y ganaba el que corriera último,
--  sin error y sin aviso (ROJO-2). El alta hoy además VALIDA el correo
--  (`lib/validacion-email.mjs`, 24/08) y **genera** la contraseña, que se
--  enseña una sola vez: nada de eso se puede reproducir en un `.sql`.
--
--  NO SIEMBRA clientes ni campañas, a propósito. Que la demostración se llene
--  usando la aplicación es mejor demostración que una base precargada — y
--  ademas F4.4 pide inventario, no operación.
--
--  ─── Regla que no se negocia (§3 del plan) ────────────────────────────────
--
--  **Nada exportado de una base real.** Todo lo de aquí está inventado. Los
--  RFC son sintácticamente válidos y no corresponden a nadie; las direcciones
--  son de calles que existen pero sin número real de predio.
--
--  ─── Orden ────────────────────────────────────────────────────────────────
--
--    1. rol de app -> schema.sql -> migrar.mjs --instalacion-nueva
--    2. bootstrap-auth.mjs   (ORG_SLUG=demo)
--    3. ESTE ARCHIVO
--
--  Idempotente: cada bloque comprueba antes de insertar. Correrlo dos veces no
--  duplica una sola fila.
--
--  Cómo se aplica:
--    sudo -u postgres psql -d spaces_demo -v ON_ERROR_STOP=1 \
--      -f docs/datos/20260824_semilla_demo.sql
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ─── GUARDA 1 · la base ─────────────────────────────────────────────────────
--
-- Esto escribe filas de mentira. Correrlo contra la base del PADRE le metería
-- inventario falso a la organización del super admin de toda la flota, y
-- borrarlo despues es peor que no haberlo hecho: hay que distinguir a mano lo
-- inventado de lo real. Se niega por NOMBRE, igual que el arnés de pruebas se
-- niega a apuntar a una base que no acabe en `_e2e`.
do $$
begin
  if current_database() <> 'spaces_demo' then
    raise exception
      'Esta semilla es SOLO para la base de la demostracion. Estas en "%". '
      'Si de verdad quieres otra base, cambia el nombre en esta guarda a '
      'proposito y explica por que.', current_database();
  end if;
end $$;

-- ─── GUARDA 2 · la organización tiene que existir YA ────────────────────────
--
-- La crea `bootstrap-auth.mjs`. Si no está, este archivo no la inventa: para.
do $$
begin
  if not exists (select 1 from tenants where slug = 'demo') then
    raise exception
      'No existe la organizacion "demo". Creala primero con el alta, que es la '
      'unica via: ORG_SLUG=demo ORG_NOMBRE="SPACE OS - Demostracion" '
      'ADMIN_EMAIL=<correo real> ADMIN_NOMBRE="<nombre>" DATABASE_URL=... '
      'node apps/web/scripts/bootstrap-auth.mjs';
  end if;
end $$;

-- ─── GUARDA 3 · y NO puede llamarse `rgb` ───────────────────────────────────
--
-- El criterio de aceptacion de F4.5 compara los slugs de `spaces_demo` con los
-- de `spaces_prod` y exige interseccion VACIA. `rgb` es el tenant del super
-- admin en el PADRE, asi que si alguien nombro `rgb` a la organizacion de la
-- demostracion, el criterio no se puede cumplir y hay que rehacer el alta.
do $$
begin
  if exists (select 1 from tenants where slug = 'rgb') then
    raise exception
      'Esta base tiene un tenant "rgb", que es el del PADRE. La demostracion no '
      'puede compartir slug con el: F4.5 exige que las dos listas no tengan '
      'ninguno en comun.';
  end if;
end $$;

-- ─── Arrendadores ───────────────────────────────────────────────────────────
--
-- `tenant_id` va EXPLICITO en cada insert. Desde `20260812_sin_default_tenant.sql`
-- (F1.2) las tablas ya no llevan DEFAULT, asi que omitirlo revienta con 23502 en
-- vez de etiquetar la fila como de otra organizacion en silencio. Es la red que
-- puso la Fase 1; escribirlo igual es cinturon y tirantes.

insert into arrendadores (tenant_id, nombre, rfc, telefono, email, direccion, forma_pago, activo)
select (select id from tenants where slug = 'demo'),
       'Inmobiliaria Poniente Demo, S.A. de C.V.', 'IPD060215AB3',
       '55 5555 0101', 'contacto@poniente.demo',
       'Av. Revolucion 1200, Col. Mixcoac, Benito Juarez, CDMX',
       'Transferencia', true
where not exists (select 1 from arrendadores
                   where rfc = 'IPD060215AB3'
                     and tenant_id = (select id from tenants where slug = 'demo'));

insert into arrendadores (tenant_id, nombre, rfc, telefono, email, direccion, forma_pago, activo)
select (select id from tenants where slug = 'demo'),
       'Grupo Norte Demo, S. de R.L.', 'GND110930KL9',
       '55 5555 0202', 'arrendamientos@gruponorte.demo',
       'Calzada Vallejo 850, Col. Industrial Vallejo, Azcapotzalco, CDMX',
       'Transferencia', true
where not exists (select 1 from arrendadores
                   where rfc = 'GND110930KL9'
                     and tenant_id = (select id from tenants where slug = 'demo'));

-- ─── Pantallas ──────────────────────────────────────────────────────────────
--
-- Seis, con la mezcla que hace util una demostracion: digitales con spots para
-- enseñar el calculo de disponibilidad, y espectaculares fijos para enseñar el
-- otro modelo. `pais` va EXPLICITO: la columna trae default 'PE' y el negocio
-- es Mexico.
--
-- ❌ `costo_compra` se queda en NULL A PROPOSITO, y no es un olvido: una
--    pantalla tiene UN solo costo, la renta al arrendador, y esa vive en el
--    contrato del predio. `renta_arrendador` y `periodicidad_renta` estan
--    marcadas DEPRECADAS en el esquema por lo mismo (Fase 1). Rellenarlas aqui
--    enseñaria en la demostracion un modelo de costos que ya no es el del
--    producto.

insert into sitios (
  tenant_id, clave_interna, nombre, tipo_medio,
  direccion, alcaldia, ciudad, estado, pais, lat, lng,
  ancho, alto, caras, iluminado, orientacion, exhibicion,
  resolucion_px, tipo_contenido, spots_por_hora, duracion_spot_seg, total_spots,
  tarifa_mensual, tarifa_publicada,
  arrendador_id,
  estatus_comercial, estatus_legal, estatus_operativo, notas
)
select v.* from (values
  ( (select id from tenants where slug = 'demo'),
    'DEMO-P01', 'Periferico Sur / Barranca del Muerto', 'PANTALLA_DIGITAL'::tipo_medio,
    'Periferico Sur esq. Barranca del Muerto', 'Alvaro Obregon', 'Ciudad de Mexico', 'CDMX', 'MX',
    19.3562000::numeric(10,7), -99.1934000::numeric(11,7),
    12.00::numeric(8,2), 6.00::numeric(8,2), 1, true, 'Sur-Norte', 'digital',
    '1920x960', 'VIDEO'::tipo_contenido, 360, 10, 8640,
    185000.00::numeric(14,2), 210000.00::numeric(14,2),
    (select id from arrendadores where rfc = 'IPD060215AB3'
       and tenant_id = (select id from tenants where slug = 'demo')),
    'DISPONIBLE'::est_comercial, 'EN_ORDEN'::est_legal, 'ACTIVO'::est_operativo,
    'Pantalla de demostracion. Datos inventados.' ),

  ( (select id from tenants where slug = 'demo'),
    'DEMO-P02', 'Insurgentes Sur / World Trade Center', 'PANTALLA_DIGITAL'::tipo_medio,
    'Av. Insurgentes Sur frente a WTC', 'Benito Juarez', 'Ciudad de Mexico', 'CDMX', 'MX',
    19.3936000::numeric(10,7), -99.1750000::numeric(11,7),
    10.00::numeric(8,2), 5.00::numeric(8,2), 2, true, 'Norte-Sur', 'digital',
    '1920x960', 'VIDEO'::tipo_contenido, 360, 10, 8640,
    240000.00::numeric(14,2), 275000.00::numeric(14,2),
    (select id from arrendadores where rfc = 'IPD060215AB3'
       and tenant_id = (select id from tenants where slug = 'demo')),
    'DISPONIBLE'::est_comercial, 'EN_ORDEN'::est_legal, 'ACTIVO'::est_operativo,
    'Pantalla de demostracion. Datos inventados.' ),

  ( (select id from tenants where slug = 'demo'),
    'DEMO-P03', 'Viaducto / Eje Central', 'PANTALLA_DIGITAL'::tipo_medio,
    'Viaducto Miguel Aleman esq. Eje Central', 'Benito Juarez', 'Ciudad de Mexico', 'CDMX', 'MX',
    19.4021000::numeric(10,7), -99.1412000::numeric(11,7),
    8.00::numeric(8,2), 4.00::numeric(8,2), 1, true, 'Oriente-Poniente', 'digital',
    '1280x640', 'IMAGEN'::tipo_contenido, 240, 15, 5760,
    120000.00::numeric(14,2), 140000.00::numeric(14,2),
    (select id from arrendadores where rfc = 'GND110930KL9'
       and tenant_id = (select id from tenants where slug = 'demo')),
    'DISPONIBLE'::est_comercial, 'EN_ORDEN'::est_legal, 'ACTIVO'::est_operativo,
    'Pantalla de demostracion. Datos inventados.' ),

  ( (select id from tenants where slug = 'demo'),
    'DEMO-E01', 'Calzada Vallejo km 3', 'ESPECTACULAR'::tipo_medio,
    'Calzada Vallejo km 3, cuerpo poniente', 'Azcapotzalco', 'Ciudad de Mexico', 'CDMX', 'MX',
    19.4869000::numeric(10,7), -99.1631000::numeric(11,7),
    12.90::numeric(8,2), 7.20::numeric(8,2), 1, true, 'Norte-Sur', 'fijo',
    null, null, null, null, null,
    95000.00::numeric(14,2), 110000.00::numeric(14,2),
    (select id from arrendadores where rfc = 'GND110930KL9'
       and tenant_id = (select id from tenants where slug = 'demo')),
    'DISPONIBLE'::est_comercial, 'EN_ORDEN'::est_legal, 'ACTIVO'::est_operativo,
    'Espectacular de demostracion. Datos inventados.' ),

  ( (select id from tenants where slug = 'demo'),
    'DEMO-E02', 'Autopista Mexico-Queretaro km 22', 'ESPECTACULAR'::tipo_medio,
    'Autopista Mexico-Queretaro km 22, cuerpo norte', 'Tlalnepantla', 'Tlalnepantla', 'Mexico', 'MX',
    19.5893000::numeric(10,7), -99.2210000::numeric(11,7),
    12.90::numeric(8,2), 7.20::numeric(8,2), 2, false, 'Sur-Norte', 'fijo',
    null, null, null, null, null,
    78000.00::numeric(14,2), 90000.00::numeric(14,2),
    (select id from arrendadores where rfc = 'GND110930KL9'
       and tenant_id = (select id from tenants where slug = 'demo')),
    'DISPONIBLE'::est_comercial, 'EN_ORDEN'::est_legal, 'ACTIVO'::est_operativo,
    'Espectacular de demostracion. Datos inventados.' ),

  ( (select id from tenants where slug = 'demo'),
    'DEMO-M01', 'Corredor Reforma - mobiliario', 'MOBILIARIO_URBANO'::tipo_medio,
    'Paseo de la Reforma, tramo Angel-Diana', 'Cuauhtemoc', 'Ciudad de Mexico', 'CDMX', 'MX',
    19.4270000::numeric(10,7), -99.1677000::numeric(11,7),
    1.20::numeric(8,2), 1.80::numeric(8,2), 2, true, 'Ambas', 'digital',
    '1080x1920', 'IMAGEN'::tipo_contenido, 300, 12, 7200,
    42000.00::numeric(14,2), 52000.00::numeric(14,2),
    (select id from arrendadores where rfc = 'IPD060215AB3'
       and tenant_id = (select id from tenants where slug = 'demo')),
    'EN_MANTENIMIENTO'::est_comercial, 'EN_ORDEN'::est_legal, 'EN_MANTENIMIENTO'::est_operativo,
    'Mobiliario de demostracion, a proposito NO disponible: sirve para enseñar los estatus.' )
) as v
where not exists (select 1 from sitios s where s.clave_interna = v.column2);

commit;

-- ─── Verificación ───────────────────────────────────────────────────────────

select 'organizaciones' as que, string_agg(slug, ', ') as valor from tenants
union all
select 'arrendadores', count(*)::text from arrendadores
union all
select 'pantallas',    count(*)::text from sitios
union all
select 'disponibles',  count(*)::text from sitios where estatus_comercial = 'DISPONIBLE';

-- Esperado: organizaciones = demo · arrendadores = 2 · pantallas = 6 · disponibles = 5

-- ─── ROLLBACK ───────────────────────────────────────────────────────────────
--
-- Solo borra lo que sembró este archivo, y se reconoce por la clave interna.
-- El orden importa: las pantallas apuntan a los arrendadores.
--
--   begin;
--   delete from sitios where clave_interna like 'DEMO-%';
--   delete from arrendadores where rfc in ('IPD060215AB3','GND110930KL9');
--   commit;
--
-- No toca la organización ni el Dueño: eso lo deshace quien lo creó.
