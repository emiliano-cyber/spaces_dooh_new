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
create type estado_predio       as enum ('PROSPECTO','EN_NEGOCIACION','DISPONIBLE','OCUPADO','SUSPENDIDO','PROBLEMA_LEGAL','FUERA_DE_SERVICIO');
-- Periodicidad de pago. Equiv. mensual: SEMANAL x30/7, CATORCENAL x30/14, QUINCENAL x2,
-- MENSUAL x1, BIMESTRAL /2, TRIMESTRAL /3, SEMESTRAL /6, ANUAL /12.
create type periodicidad_pago   as enum ('SEMANAL','CATORCENAL','QUINCENAL','MENSUAL','BIMESTRAL','TRIMESTRAL','SEMESTRAL','ANUAL');
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
  email         text not null,
  cargo         text,
  rol           rol_demo not null default 'COMERCIAL',
  password_hash text,                     -- bcrypt; null = aún sin contraseña
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);
-- Correo ÚNICO e insensible a mayúsculas (el login usa lower(email)): no puede
-- haber dos usuarios con el mismo correo aunque cambie la capitalización.
create unique index if not exists usuarios_email_lower_uidx on usuarios (lower(email));

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

-- Contador de folios por ámbito y periodo (ver db/migrations/20260804_folios_
-- consecutivos.sql). Los folios eran aleatorios sobre espacios diminutos y
-- chocaban contra sus propias restricciones UNIQUE. Global y sin RLS: solo
-- guarda un entero por ámbito, y las UNIQUE de folio también son globales.
create table folios_consecutivos (
  ambito   text    not null,
  periodo  text    not null,          -- '20260804' (día) o '2026' (año)
  ultimo   integer not null default 0,
  primary key (ambito, periodo)
);

-- ADR 0011: UNA FILA POR TENANT. `tenant_id` y su índice único se añaden más
-- abajo, junto al bloque multi-tenant, porque `tenants` se declara después.
--
-- NO lleva `nombre_tenant`: el nombre de la organización es `tenants.nombre` y
-- esa es su única fuente. Tenerlo aquí también es lo que hacía que el sidebar
-- dijera «G500» y Configuración «RGB Catorce» (M5 de la auditoría).
create table config_negocio (
  id              uuid primary key default gen_random_uuid(),
  moneda          text not null default 'PEN',
  plazos_cobranza integer[] not null default '{60,90,120}',
  tipos_tarea     text[]   not null default '{}',
  -- ADR 0008: cupo de clientes por defecto para las pantallas sin uno propio.
  -- NULL = sin límite, que es como nace la instalación.
  max_clientes_pantalla integer check (max_clientes_pantalla is null or max_clientes_pantalla >= 1),
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
  -- ADR 0008: cupo de clientes distintos que admite la pantalla. NULL = sin
  -- límite (cae al default global de config_negocio). Es política comercial,
  -- no capacidad técnica: total_spots dice cuántos slots hay, esto cuántos
  -- anunciantes distintos pueden compartirlos.
  max_clientes        integer check (max_clientes is null or max_clientes >= 1),
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
  -- propietario/arrendador del inmueble (directo; independiente del contrato).
  -- La FK se agrega tras crear la tabla arrendadores (definida más abajo).
  arrendador_id       uuid,
  -- DEPRECADOS (Fase 1): la renta ahora vive en el contrato del predio.
  renta_arrendador    numeric(14,2),
  periodicidad_renta  text,
  -- Predio al que pertenece la pantalla (FK se agrega en M2). N pantallas : 1 predio.
  predio_id           uuid,
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
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  rfc             text,
  curp            text,
  telefono        text,
  email           text,
  direccion       text,
  cuenta_bancaria text,
  forma_pago      text,
  observaciones   text,
  notas           text,
  activo          boolean not null default true,   -- soft-delete (Fase 1)
  creado_en       timestamptz not null default now()
);

-- FK diferida: sitios.arrendador_id → arrendadores (sitios se define más arriba).
alter table sitios
  add constraint sitios_arrendador_id_fkey
  foreign key (arrendador_id) references arrendadores(id) on delete set null;

create table contratos_arrendamiento (
  id             uuid primary key default gen_random_uuid(),
  sitio_id       uuid not null references sitios(id) on delete restrict,
  arrendador_id  uuid not null references arrendadores(id) on delete restrict,
  fecha_inicio   date not null,
  fecha_fin      date not null,
  monto_renta    numeric(14,2) not null,
  periodicidad   periodicidad_pago not null default 'MENSUAL',
  moneda         text not null default 'PEN',
  auto_renovable boolean not null default false,
  documento_url  text,
  deposito          numeric(14,2),
  motivo_cancelacion text,
  -- Vínculos a predio/razón social (FK se agrega tras crear esas tablas — M2).
  predio_id         uuid,
  razon_social_id   uuid,
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
  comprobante_url text,
  metodo_pago     text,
  observaciones   text,
  estatus     est_pago_renta not null default 'PENDIENTE',
  creado_en   timestamptz not null default now()
);

-- Predio: nucleo del modulo (Arrendador -> Predio -> Contrato -> Pantallas).
create table predios (
  id             uuid primary key default gen_random_uuid(),
  arrendador_id  uuid not null references arrendadores(id) on delete restrict,
  nombre         text not null,
  direccion      text,
  lat            numeric(10,7),
  lng            numeric(11,7),
  tipo_ubicacion text,
  estado         estado_predio not null default 'DISPONIBLE',
  documentos     jsonb not null default '[]'::jsonb,
  creado_en      timestamptz not null default now()
);
create index if not exists predios_arrendador_idx on predios(arrendador_id);

-- Razon social del arrendador (factura la renta bajo N razones sociales).
create table arrendador_razon_social (
  id            uuid primary key default gen_random_uuid(),
  arrendador_id uuid not null references arrendadores(id) on delete cascade,
  razon_social  text not null,
  rfc           text,
  regimen       text,
  creado_en     timestamptz not null default now()
);
create index if not exists ars_arrendador_idx on arrendador_razon_social(arrendador_id);

-- FKs de los vinculos declarados arriba (predios ya existe).
alter table contratos_arrendamiento
  add constraint contratos_predio_fk       foreign key (predio_id)       references predios(id)                  on delete restrict,
  add constraint contratos_razon_social_fk foreign key (razon_social_id) references arrendador_razon_social(id) on delete set null;
alter table sitios
  add constraint sitios_predio_fk foreign key (predio_id) references predios(id) on delete restrict;
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
  iva_pct        numeric(5,2) not null default 16,  -- IVA configurado por cliente
  comision_agencia_pct numeric(5,2) not null default 0,  -- comisión de agencia (divisor)
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
  token_publico text unique,                        -- token aleatorio de la liga pública (S1-3)
  cliente_id   uuid references clientes(id) on delete set null,
  nombre       text not null,
  fecha        date not null default current_date,
  estatus      est_propuesta not null default 'BORRADOR',
  comision_pct numeric(5,2) not null default 0,   -- comisión de agencia → divisor
  descuento_pct numeric(5,2) not null default 0,  -- descuento comercial sobre la tarifa de lista (≠ comisión)
  version      integer not null default 1,         -- versión de la propuesta (sube en cada renegociación)
  notas        text,
  aceptado_en  timestamptz,                        -- aceptación del cliente desde la liga pública (medio-contrato)
  aceptado_por text,                               -- nombre que el cliente escribió al aceptar
  aceptado_ip  text,                               -- IP de origen de la aceptación
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
-- Campañas (definida antes de ordenes_compra, que la referencia).
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
  propuesta_id          uuid references propuestas(id) on delete set null,  -- campaña derivada de una propuesta aprobada (nullable: manuales sin propuesta)
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
create index idx_campanas_propuesta on campanas (propuesta_id);
create trigger trg_campanas_upd before update on campanas
  for each row execute function set_actualizado_en();

create table ordenes_compra (
  id            uuid primary key default gen_random_uuid(),
  folio         text not null unique,
  numero_oc     text,                                -- número de OC del cliente (S1-4)
  campana_id    uuid not null references campanas(id) on delete cascade,
  monto         numeric(14,2) not null default 0,
  fecha         date not null default current_date,
  estatus       est_odc not null default 'RECIBIDA',
  documento_url text,
  notas         text,
  creado_en     timestamptz not null default now()
);
create index idx_odc_campana on ordenes_compra (campana_id);

-- ─── Notificaciones por evento (centro in-app) ───────────────────────────────
create table notificaciones (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null,                 -- ODC | FACTURA | PAGO | OT | PROPUESTA
  nivel     text not null default 'info',  -- info | ok | warn
  titulo    text not null,
  detalle   text,
  link      text,
  leida     boolean not null default false,
  creado_en timestamptz not null default now()
);
create index idx_notif_creado on notificaciones (creado_en desc);

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
  expira_en    timestamptz,                 -- TTL: una TENTATIVA caduca sola en esta fecha (null = no caduca)
  creativos    jsonb not null default '[]', -- [{creatividadId, veces}] exhibidos en este spot
  creado_en    timestamptz not null default now()
);
create index idx_reservas_campana on reservas (campana_id);
create index idx_reservas_sitio   on reservas (sitio_id);
create index idx_reservas_estatus on reservas (estatus);
create index idx_reservas_expira  on reservas (expira_en) where estatus = 'TENTATIVA';

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
  foto_url    text not null,                 -- base64 (legado) o vacío si va a Spaces
  foto_key    text,                          -- key del objeto en Spaces (si aplica)
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
  recordatorio_en       timestamptz,                 -- último recordatorio de cobro enviado (cadencia + idempotencia)
  recordatorios_enviados integer not null default 0, -- cuántos recordatorios se han enviado
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
--  Multi-tenant + RLS (aditivo). tenant_id en todas las tablas de datos. RLS
--  ENABLE (no FORCE): el rol dueño/superusuario la salta -> no rompe la app.
--  Para ENFORZAR en producción: conectar como rol NO-superusuario y
--  `set app.tenant_id = '<uuid>'` por request (transacción).
-- ============================================================================
create table if not exists tenants (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  slug      text not null unique,
  moneda    text not null default 'MXN',   -- moneda estándar por organización
  creado_en timestamptz not null default now()
);

-- ─── El esquema NACE SIN NINGUNA ORGANIZACIÓN, y es a propósito ─────────────
-- Aquí había un `insert into tenants … ('RGB Catorce','rgb')`. En el modelo de
-- instancias soberanas eso significaba que CADA instancia nueva nacía con la
-- identidad de otro owner dentro: la de PIXELED, la de Telcel y la de quien
-- viniera empezaban con una organización 'rgb' que nadie dio de alta, más su
-- fila de `config_negocio`. Rompía dos criterios del plan v3 —F4.2, «ni una
-- fila de ningún owner», y F4.5, que exige que los slugs de DEMO y de
-- `spaces_prod` no compartan ninguno— y sobre todo era justo lo que el modelo
-- existe para evitar.
--
-- La organización de una instancia se crea AL APROVISIONAR
-- (`apps/web/scripts/bootstrap-auth.mjs`, que la pide por variables de entorno).
-- Para trabajar en local, el tenant 'rgb' vive ahora en
-- `db/semilla-desarrollo.sql`, que no viaja en la imagen.

do $$
declare
  t text;
  tbls text[] := array[
    'usuarios','sitios','clientes','propuestas','propuesta_items','ordenes_compra',
    'campanas','creatividades','reservas','ordenes_trabajo','evidencias_ot','ordenes_impresion',
    'facturas','cobranzas','arrendadores','contratos_arrendamiento','pagos_renta',
    'incidencias','notificaciones','acciones','sitio_modalidades',
    'predios','arrendador_razon_social'];
begin
  -- Aquí se resolvía `def` (el id del tenant 'rgb') y con él se hacían dos
  -- cosas que ya no tienen sentido ni a quién apuntar: rellenar el `tenant_id`
  -- de las filas existentes y poner ese uuid como DEFAULT de la columna. Ese
  -- DEFAULT es la deriva que etiquetó como RGB filas de otras organizaciones
  -- —15 modalidades de g500/eyro— y lo retira `20260812_sin_default_tenant.sql`;
  -- el relleno era un `update` sobre tablas recién creadas, o sea vacías.
  -- Sin él, un `set not null` sobre una tabla con filas sin organización FALLA
  -- en vez de inventarle dueño, que es el fail-loud que se busca.
  foreach t in array tbls loop
    execute format('alter table %I add column if not exists tenant_id uuid', t);
    execute format('alter table %I alter column tenant_id set not null', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid
             or nullif(current_setting('app.tenant_id', true),'') is null)
      with check (true)$p$, t);
  end loop;
end $$;

-- ─── config_negocio: una fila POR TENANT (ADR 0011) ─────────────────────────
-- Va aparte del bucle de arriba por dos motivos:
--   · necesita un índice ÚNICO sobre tenant_id (una sola fila por organización),
--     que el bucle genérico no pone;
--   · NO lleva DEFAULT de tenant_id. Ese default —que el bucle aplicaba a las
--     otras tablas apuntando a 'rgb'— es el que ha ido etiquetando como RGB
--     filas de otras organizaciones cuando alguien olvidaba fijar el tenant.
--     Aquí se prefiere que un insert sin tenant FALLE.
--
-- Antes era una fila global compartida por todas las organizaciones, y la
-- pantalla de Configuración escribía sobre ella: cambiar tu IVA se lo cambiaba
-- a todo el mundo.
--
-- El `update … set tenant_id = (select id from tenants where slug='rgb')` que
-- iba aquí se retiró con la semilla: sin organización sembrada no hay a quién
-- apuntar, y la tabla acaba de crearse vacía. El `insert` de abajo es genérico
-- —una fila por organización EXISTENTE— así que en una instancia recién nacida
-- no inserta nada, y la fila de cada organización la crea quien la dé de alta
-- (o la app al primer acceso, `lib/server/config-repo.ts:59-61`).
alter table config_negocio add column if not exists tenant_id uuid references tenants(id) on delete cascade;
insert into config_negocio (tenant_id, moneda)
select t.id, 'MXN' from tenants t
 where not exists (select 1 from config_negocio c where c.tenant_id = t.id);
alter table config_negocio alter column tenant_id set not null;
create unique index if not exists config_negocio_tenant_uidx on config_negocio (tenant_id);

alter table config_negocio enable row level security;
alter table config_negocio force row level security;
drop policy if exists tenant_isolation on config_negocio;
create policy tenant_isolation on config_negocio for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

-- ============================================================================
--  Fin del esquema. Para datos semilla, mapear el seed de la demo
--  (apps/web/lib/data/seed.ts) a INSERTs — pedirlo aparte si se requiere.
-- ============================================================================
