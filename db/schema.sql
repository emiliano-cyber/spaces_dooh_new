-- ============================================================================
--  Spaces — Esquema PostgreSQL (mapea 1:1 la capa de datos de la demo)
-- ----------------------------------------------------------------------------
--  Cubre todo lo que hoy maneja la demo en memoria: inventario de sitios y sus
--  modalidades, arrendadores/contratos/pagos, incidencias, clientes, campañas,
--  creatividades, reservas, órdenes de trabajo + evidencias, órdenes de
--  impresión, facturación/cobranza, usuarios, configuración del negocio y la
--  bitácora de acciones.
--
--  Cómo correrlo:
--    createdb spaces
--    psql -d spaces -f db/schema.sql
--
--  Diseño: un solo schema (public). Multi-tenant (schema-per-tenant) se puede
--  añadir después envolviendo todo en CREATE SCHEMA <tenant>. IDs uuid con
--  default; claves de negocio (codigo_proveedor, folios, email) son UNIQUE.
-- ============================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ─── Función para actualizar `actualizado_en` automáticamente ───────────────
create or replace function set_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type rol_demo            as enum ('DUENO','COMERCIAL','OPERACIONES','IMPRENTA','FINANZAS','CLIENTE');
create type tipo_medio          as enum ('ESPECTACULAR','PANTALLA_DIGITAL','PUENTE_PEATONAL','MOBILIARIO_URBANO','MURAL','VALLA','OTRO');
create type est_comercial       as enum ('DISPONIBLE','RESERVADO','OCUPADO','BLOQUEADO','EN_MANTENIMIENTO','BAJA');
create type est_legal           as enum ('EN_ORDEN','PERMISO_VENCIDO','EN_TRAMITE','SUSPENDIDO','SIN_PERMISO');
create type est_operativo       as enum ('ACTIVO','EN_MANTENIMIENTO','APAGADO','DANADO','BAJA');
create type comercializacion    as enum ('PROGRAMATICO','TRADICIONAL');
create type cms                 as enum ('BROADSIGN','INVIDIS','DOOHMAIN','OTRO');
create type tipo_contenido      as enum ('VIDEO','IMAGEN');
create type est_contrato        as enum ('VIGENTE','POR_VENCER','VENCIDO','RENOVADO','CANCELADO');
create type est_pago_renta      as enum ('PENDIENTE','PAGADO','VENCIDO');
create type tipo_incidencia     as enum ('CLIMA','MANTENIMIENTO','LEGAL','VANDALISMO','SUSPENSION_OPERATIVA','ACCIDENTE','OTRO');
create type est_incidencia      as enum ('ABIERTA','EN_PROCESO','RESUELTA','CERRADA');
create type tipo_campana        as enum ('OOH','DOOH','HIBRIDA');
create type est_comercial_campana as enum ('DRAFT','COTIZACION','CONFIRMADA','ACTIVA','COMPLETADA','CANCELADA','LISTA_FACTURAR');
create type est_validacion_crea as enum ('PENDIENTE','VALIDADA','RECHAZADA');
create type est_reserva         as enum ('TENTATIVA','CONFIRMADA','CANCELADA');
create type tipo_venta          as enum ('SPOT_UNIT','DAY_PACK','HOUR_PACK','SOV','TAKEOVER','FIXED_PKG','PROG_DIRECT','PROG_PMP','PROG_OPEN','MAKEGOOD','HOUSE_AD');
create type prioridad           as enum ('BAJA','NORMAL','ALTA','URGENTE');
create type tipo_ot             as enum ('MONTAJE_LONA','MONTAJE_DIGITAL','DESMONTAJE','MANTENIMIENTO_PREVENTIVO','MANTENIMIENTO_CORRECTIVO','HERRERIA','ELECTRICO','INSPECCION','OTRO');
create type est_ot              as enum ('PENDIENTE','ASIGNADA','EN_PROCESO','BLOQUEADA','EN_REVISION','COMPLETADA','RECHAZADA','CANCELADA');
create type est_orden_impresion as enum ('ARTE_RECIBIDO','VALIDADO','EN_PRODUCCION','IMPRESO','LISTO_MONTAJE');
create type est_factura         as enum ('EMITIDA','PAGADA','ANULADA');
create type est_cobranza        as enum ('AL_CORRIENTE','POR_VENCER','VENCIDA','PAGADA');

-- ─── Usuarios y configuración ───────────────────────────────────────────────
create table usuarios (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  email         text not null unique,
  cargo         text,
  rol           rol_demo not null default 'COMERCIAL',
  password_hash text,                     -- bcrypt; null = aún sin contraseña
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

-- Permisos por rol y módulo (V/C/A/F). Una fila por (rol, módulo, acción).
create table rol_permisos (
  rol     rol_demo not null,
  modulo  text not null,
  accion  text not null,            -- ver | crear | aprobar | facturar
  primary key (rol, modulo, accion)
);

-- Sesiones (token aleatorio en cookie httpOnly; revocable y con expiración).
create table sesiones (
  token      text primary key,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  creado_en  timestamptz not null default now(),
  expira_en  timestamptz not null
);
create index idx_sesiones_usuario on sesiones (usuario_id);

create table config_negocio (
  id              uuid primary key default gen_random_uuid(),
  nombre_tenant   text not null,
  moneda          text not null default 'PEN',
  plazos_cobranza integer[] not null default '{60,90,120}',
  tipos_tarea     text[]   not null default '{}',
  actualizado_en  timestamptz not null default now()
);
create trigger trg_config_upd before update on config_negocio
  for each row execute function set_actualizado_en();

-- ─── Inventario: sitios + modalidades ───────────────────────────────────────
create table sitios (
  id                  uuid primary key default gen_random_uuid(),
  clave_interna       text unique,
  codigo_proveedor    text unique,
  nombre              text not null,
  tipo_medio          tipo_medio not null default 'OTRO',
  -- ubicación
  direccion           text,
  direccion_predio    text,
  direccion_comercial text,
  alcaldia            text,          -- distrito
  plaza_ciudad        text,
  ciudad              text,
  estado              text,
  pais                text not null default 'PE',
  lat                 numeric(10,7),
  lng                 numeric(11,7),
  pendiente_verificacion boolean not null default false,
  -- características físicas
  ancho               numeric(8,2),
  alto                numeric(8,2),
  caras               integer not null default 1,
  iluminado           boolean not null default false,
  orientacion         text,
  tipo_estructura     text,
  vista               text,
  tramo               text,
  exhibicion          text,          -- fijo | digital | rotativo
  es_rotativo         boolean not null default false,
  unidad              text,          -- modalidad principal
  -- DOOH
  resolucion_px       text,
  tipo_contenido      tipo_contenido,
  spots_por_hora      integer,
  duracion_spot_seg   integer,
  total_spots         integer,
  spots_disponibles   integer,
  horario             text,
  computer_vision     boolean not null default false,
  admobilize_id       text,
  -- comercial / network
  tarifa_mensual      numeric(14,2),
  tarifa_publicada    numeric(14,2),
  costo_compra        numeric(14,2),
  precio_m2           numeric(12,2),
  tarifa_impresion    numeric(14,2),
  comercializacion    comercializacion not null default 'TRADICIONAL',
  en_network          boolean not null default false,
  cms                 cms,
  -- estatus
  estatus_comercial   est_comercial not null default 'DISPONIBLE',
  estatus_legal       est_legal     not null default 'EN_ORDEN',
  estatus_operativo   est_operativo not null default 'ACTIVO',
  -- media / notas
  fotos               text[] not null default '{}',
  imagen_promocional  text,
  notas               text,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index idx_sitios_estatus_comercial on sitios (estatus_comercial);
create index idx_sitios_tipo_medio        on sitios (tipo_medio);
create index idx_sitios_plaza             on sitios (plaza_ciudad);
create index idx_sitios_en_network        on sitios (en_network) where en_network;
create trigger trg_sitios_upd before update on sitios
  for each row execute function set_actualizado_en();

-- Una fila por modalidad de venta del sitio (agrupada por codigo_proveedor en
-- la importación). Una pantalla física → varias modalidades.
create table sitio_modalidades (
  id               uuid primary key default gen_random_uuid(),
  sitio_id         uuid not null references sitios(id) on delete cascade,
  unidad           text not null,   -- mensual | catorcenal | semanal | diaria | spot | hora | programatico
  tarifa_publicada numeric(14,2) not null default 0,
  costo_compra     numeric(14,2) not null default 0,
  creado_en        timestamptz not null default now(),
  unique (sitio_id, unidad)
);
create index idx_modalidades_sitio on sitio_modalidades (sitio_id);

-- ─── Arrendadores / contratos / pagos ───────────────────────────────────────
create table arrendadores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  rfc       text,
  telefono  text,
  email     text,
  notas     text,
  creado_en timestamptz not null default now()
);

create table contratos_arrendamiento (
  id             uuid primary key default gen_random_uuid(),
  sitio_id       uuid not null references sitios(id) on delete restrict,
  arrendador_id  uuid not null references arrendadores(id) on delete restrict,
  fecha_inicio   date not null,
  fecha_fin      date not null,
  monto_renta    numeric(14,2) not null,
  periodicidad   text not null default 'MENSUAL',
  moneda         text not null default 'PEN',
  auto_renovable boolean not null default false,
  documento_url  text,
  estatus        est_contrato not null default 'VIGENTE',
  creado_en      timestamptz not null default now()
);
create index idx_contratos_sitio      on contratos_arrendamiento (sitio_id);
create index idx_contratos_arrendador on contratos_arrendamiento (arrendador_id);
create index idx_contratos_estatus    on contratos_arrendamiento (estatus);

create table pagos_renta (
  id          uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos_arrendamiento(id) on delete cascade,
  periodo     text not null,
  monto       numeric(14,2) not null,
  fecha_pago  date,
  factura_url text,
  estatus     est_pago_renta not null default 'PENDIENTE',
  creado_en   timestamptz not null default now()
);
create index idx_pagos_contrato on pagos_renta (contrato_id);
create index idx_pagos_estatus  on pagos_renta (estatus);

-- ─── Incidencias ────────────────────────────────────────────────────────────
create table incidencias (
  id                    uuid primary key default gen_random_uuid(),
  sitio_id              uuid not null references sitios(id) on delete cascade,
  tipo                  tipo_incidencia not null,
  descripcion           text not null,
  fecha_inicio          timestamptz not null default now(),
  fecha_resolucion      timestamptz,
  impacta_comercial     boolean not null default true,
  estatus               est_incidencia not null default 'ABIERTA',
  fotos                 text[] not null default '{}',
  reportado_por_usuario uuid references usuarios(id) on delete set null,
  notas                 text,
  creado_en             timestamptz not null default now()
);
create index idx_incidencias_sitio   on incidencias (sitio_id);
create index idx_incidencias_estatus on incidencias (estatus);

-- ─── Clientes / campañas / creatividades ────────────────────────────────────
create table clientes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  rfc            text,
  razon_social   text,          -- datos fiscales (para facturar)
  regimen_fiscal text,
  cp_fiscal      text,
  uso_cfdi       text,
  tipo           text not null default 'DIRECTO',
  contacto       jsonb not null default '{}',
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

-- ─── Propuestas comerciales (método del divisor: bruto/neto) ─────────────────
create type est_propuesta as enum ('BORRADOR','ENVIADA','APROBADA','RECHAZADA');
create table propuestas (
  id           uuid primary key default gen_random_uuid(),
  folio        text not null unique,
  cliente_id   uuid references clientes(id) on delete set null,
  nombre       text not null,
  fecha        date not null default current_date,
  estatus      est_propuesta not null default 'BORRADOR',
  comision_pct numeric(5,2) not null default 0,   -- comisión de agencia → divisor
  notas        text,
  creado_en    timestamptz not null default now()
);
create table propuesta_items (
  id           uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null references propuestas(id) on delete cascade,
  sitio_id     uuid not null references sitios(id) on delete restrict,
  fecha_inicio date not null,
  fecha_fin    date not null,
  precio       numeric(14,2) not null default 0,   -- tarifa bruta de lista
  aprobado     boolean not null default false,     -- aprobación granular
  creado_en    timestamptz not null default now()
);
create index idx_prop_items_propuesta on propuesta_items (propuesta_id);

-- ─── Órdenes de compra del cliente (ODC) ─────────────────────────────────────
create type est_odc as enum ('PENDIENTE','RECIBIDA','CANCELADA');
create table ordenes_compra (
  id            uuid primary key default gen_random_uuid(),
  folio         text not null unique,
  campana_id    uuid not null references campanas(id) on delete cascade,
  monto         numeric(14,2) not null default 0,
  fecha         date not null default current_date,
  estatus       est_odc not null default 'RECIBIDA',
  documento_url text,
  notas         text,
  creado_en     timestamptz not null default now()
);
create index idx_odc_campana on ordenes_compra (campana_id);

create table campanas (
  id                    uuid primary key default gen_random_uuid(),
  folio                 text unique,
  nombre                text not null,
  cliente_id            uuid not null references clientes(id) on delete restrict,
  agencia               text,
  marca                 text,
  tipo_campana          tipo_campana not null default 'OOH',
  fecha_inicio          date not null,
  fecha_fin             date not null,
  presupuesto_bruto     numeric(16,2),
  presupuesto_neto      numeric(16,2),
  moneda                text not null default 'PEN',
  estado_comercial      est_comercial_campana not null default 'DRAFT',
  -- candado de facturación
  oc_recibida           boolean not null default false,
  fotos_comprobatorias  boolean not null default false,
  reporte_publicacion   boolean not null default false,
  oc_url                text,
  reporte_publicacion_url text,
  portal_token          text unique,
  portal_activo         boolean not null default false,
  notas                 text,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
create index idx_campanas_cliente on campanas (cliente_id);
create index idx_campanas_estado  on campanas (estado_comercial);
create trigger trg_campanas_upd before update on campanas
  for each row execute function set_actualizado_en();

create table creatividades (
  id                 uuid primary key default gen_random_uuid(),
  campana_id         uuid not null references campanas(id) on delete cascade,
  nombre             text not null,
  archivo_url        text,
  codigo             text,          -- creativo como código (HTML/UTF) en vez de imagen
  formato            text,
  resolucion         text,
  estatus_validacion est_validacion_crea not null default 'PENDIENTE',
  rechazado_motivo   text,
  creado_en          timestamptz not null default now()
);
create index idx_creatividades_campana on creatividades (campana_id);

-- ─── Reservas (sitio ↔ campaña) ─────────────────────────────────────────────
create table reservas (
  id           uuid primary key default gen_random_uuid(),
  campana_id   uuid not null references campanas(id) on delete cascade,
  sitio_id     uuid not null references sitios(id) on delete restrict,
  fecha_inicio date not null,
  fecha_fin    date not null,
  precio       numeric(14,2) not null,
  tipo_venta   tipo_venta not null default 'FIXED_PKG',
  estatus      est_reserva not null default 'TENTATIVA',
  spots_reservados int,                     -- spots reservados (DOOH); null en estáticas
  creativos    jsonb not null default '[]', -- [{creatividadId, veces}] exhibidos en este spot
  creado_en    timestamptz not null default now()
);
create index idx_reservas_campana on reservas (campana_id);
create index idx_reservas_sitio   on reservas (sitio_id);
create index idx_reservas_estatus on reservas (estatus);

-- ─── Operaciones: órdenes de trabajo + evidencias ───────────────────────────
create table ordenes_trabajo (
  id                uuid primary key default gen_random_uuid(),
  folio             text unique,
  tipo              tipo_ot not null,
  sitio_id          uuid references sitios(id) on delete set null,
  campana_id        uuid references campanas(id) on delete set null,
  descripcion       text not null,
  instrucciones     text,
  checklist         jsonb not null default '[]',
  prioridad         prioridad not null default 'NORMAL',
  asignado_a        uuid references usuarios(id) on delete set null,
  supervisor        uuid references usuarios(id) on delete set null,
  fecha_programada  timestamptz,
  fecha_inicio      timestamptz,
  fecha_completada  timestamptz,
  estatus           est_ot not null default 'PENDIENTE',
  requiere_revision boolean not null default false,
  notas             text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create index idx_ot_sitio   on ordenes_trabajo (sitio_id);
create index idx_ot_campana on ordenes_trabajo (campana_id);
create index idx_ot_estatus on ordenes_trabajo (estatus);
create trigger trg_ot_upd before update on ordenes_trabajo
  for each row execute function set_actualizado_en();

create table evidencias_ot (
  id          uuid primary key default gen_random_uuid(),
  ot_id       uuid not null references ordenes_trabajo(id) on delete cascade,
  foto_url    text not null,
  formato     text not null default 'image/jpeg',
  lat         numeric(10,7),
  lng         numeric(11,7),
  precision_m numeric(6,2),
  tipo        text not null default 'INSTALACION',
  uploaded_by uuid references usuarios(id) on delete set null,
  tomada_en   timestamptz,        -- fecha de creación de la imagen (EXIF/archivo)
  timestamp   timestamptz not null default now()  -- fecha de subida
);
create index idx_evidencias_ot on evidencias_ot (ot_id);

-- ─── Imprenta ───────────────────────────────────────────────────────────────
create table ordenes_impresion (
  id             uuid primary key default gen_random_uuid(),
  folio          text unique,
  campana_id     uuid not null references campanas(id) on delete cascade,
  sitio_id       uuid references sitios(id) on delete set null,
  material       text,
  alto           numeric(8,2),
  ancho          numeric(8,2),
  estatus        est_orden_impresion not null default 'ARTE_RECIBIDO',
  proveedor      text,
  prueba_color_url      text,                       -- prueba de color (probatorio)
  prueba_color_aprobada boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index idx_impresion_campana on ordenes_impresion (campana_id);
create trigger trg_impresion_upd before update on ordenes_impresion
  for each row execute function set_actualizado_en();

-- ─── Finanzas: facturas + cobranza ──────────────────────────────────────────
create table facturas (
  id            uuid primary key default gen_random_uuid(),
  folio         text unique,
  campana_id    uuid not null references campanas(id) on delete restrict,
  cliente_id    uuid not null references clientes(id) on delete restrict,
  subtotal      numeric(16,2) not null default 0,   -- neto sin IGV
  igv           numeric(16,2) not null default 0,   -- IGV 18%
  monto         numeric(16,2) not null,             -- total = subtotal + igv
  moneda        text not null default 'PEN',
  fecha_emision date not null default current_date,
  estatus       est_factura not null default 'EMITIDA',
  -- Datos fiscales (snapshot al emitir) + folio fiscal simulado (CFDI/UUID)
  serie         text,
  folio_fiscal  text,
  rfc           text,
  razon_social  text,
  uso_cfdi      text,
  creado_en     timestamptz not null default now()
);
create index idx_facturas_campana on facturas (campana_id);
create index idx_facturas_cliente on facturas (cliente_id);

create table cobranzas (
  id                uuid primary key default gen_random_uuid(),
  factura_id        uuid not null references facturas(id) on delete cascade,
  plazo_dias        integer not null default 90,
  fecha_vencimiento date not null,
  estatus           est_cobranza not null default 'AL_CORRIENTE',
  monto_pagado      numeric(16,2) not null default 0,
  creado_en         timestamptz not null default now()
);
create index idx_cobranzas_factura on cobranzas (factura_id);
create index idx_cobranzas_estatus on cobranzas (estatus);

-- ─── Bitácora de acciones (quién hizo qué y cuándo) ─────────────────────────
create table acciones (
  id              uuid primary key default gen_random_uuid(),
  accion          text not null,   -- "Confirmó reserva", "Cerró OT", …
  entidad         text not null,   -- sobre qué
  usuario_id      uuid references usuarios(id) on delete set null,
  usuario_nombre  text not null default 'Sistema',
  timestamp       timestamptz not null default now()
);
create index idx_acciones_timestamp on acciones (timestamp desc);

-- ============================================================================
--  Fin del esquema. Para datos semilla, mapear el seed de la demo
--  (apps/web/lib/data/seed.ts) a INSERTs — pedirlo aparte si se requiere.
-- ============================================================================
