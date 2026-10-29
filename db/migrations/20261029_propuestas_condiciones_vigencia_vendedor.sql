-- @tipo: esquema
-- ============================================================================
--  PROP-COMPLETA · CONDICIONES, VIGENCIA Y EL NOMBRE DEL VENDEDOR CONGELADO.
-- ----------------------------------------------------------------------------
--  APROBADA POR EL DUEÑO EL 29/10 (R3). Tres decisiones suyas del mismo día,
--  juntas porque las tres son columnas nuevas de `propuestas` y una migración
--  por columna dejaría tres versiones intermedias sin sentido:
--
--  ═══ 1 · CONDICIONES POR PROPUESTA, CON PLANTILLA POR ORGANIZACIÓN ════════
--
--  El documento que se le entrega al cliente (el PDF) lleva un texto de
--  términos y condiciones. El dueño eligió «por propuesta»: la organización
--  tiene una PLANTILLA (`config_negocio.condiciones_propuesta`) que se COPIA a
--  la propuesta al crearla (`propuestas.condiciones`), y ahí se puede editar.
--
--  Se copia y no se lee en vivo por lo mismo que el snapshot: cambiar la
--  plantilla mañana no puede reescribir lo que ya se le mandó a un cliente.
--  NULL en toda propuesta anterior a hoy: no tenían condiciones y no se
--  inventan. El documento simplemente no pinta el bloque.
--
--  ═══ 2 · VIGENCIA ═══════════════════════════════════════════════════════
--
--  `config_negocio.vigencia_propuesta_dias` (30 por omisión, decisión del
--  dueño) y `propuestas.vigente_hasta`. La fecha se pone al ENVIAR —no al
--  crear—, porque un borrador que pasa dos semanas en el cajón no debe llegar
--  al cliente con la mitad de su vigencia gastada. Se puede editar después.
--
--  Vencida, la liga pública no deja aceptar (`aceptarPropuestaPublica`). NULL
--  = sin vigencia, que es lo de todas las enviadas antes de hoy: siguen
--  aceptándose como hasta ahora. No se les calcula una fecha hacia atrás,
--  porque `propuestas` no guarda cuándo se envió.
--
--  ═══ 3 · EL NOMBRE DEL VENDEDOR, CONGELADO (P19) ═══════════════════════
--
--  `propuestas.usuario_id` es `on delete set null` (`20260928_vendedor_en_propuesta.sql`):
--  borrar a un vendedor convertía sus ventas en «Sin vendedor», indistinguibles
--  de las históricas. El dueño decidió conservar el nombre: `vendedor_nombre`
--  se estampa al crear, de la SESIÓN igual que `usuario_id`, y el reporte lo
--  usa cuando el usuario ya no existe.
--
--  Se rellena aquí para las propuestas que YA tienen vendedor: el nombre de hoy
--  es el único que hay, y sin rellenarlo el arreglo solo serviría para las
--  propuestas de mañana. Las que no tienen `usuario_id` se quedan en NULL —ver
--  el comentario de `CoberturaVendedor` en `lib/data/reportes.ts`: no se
--  pueden recuperar y no se inventan.
--
--  ═══ LO QUE NO HACE ═══════════════════════════════════════════════════════
--
--  · No toca `db/schema.sql` ni la FK de `usuario_id` (P21 sigue abierta).
--  · No cambia ningún importe, estatus ni snapshot.
--
--  Vuelta atrás: la versión anterior no lee ninguna de las cinco columnas; las
--  ignora y se comporta como hasta hoy.
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

alter table config_negocio
  add column if not exists condiciones_propuesta text;

alter table config_negocio
  add column if not exists vigencia_propuesta_dias integer not null default 30;

alter table config_negocio drop constraint if exists config_vigencia_propuesta_ck;
alter table config_negocio add  constraint config_vigencia_propuesta_ck
  check (vigencia_propuesta_dias between 1 and 365);

alter table propuestas add column if not exists condiciones     text;
alter table propuestas add column if not exists vigente_hasta   date;
alter table propuestas add column if not exists vendedor_nombre text;

comment on column config_negocio.condiciones_propuesta is
  'PROP-COMPLETA (29/10). Plantilla de terminos y condiciones de las propuestas de esta organizacion. Se COPIA a propuestas.condiciones al crear; cambiarla no toca las ya creadas.';
comment on column config_negocio.vigencia_propuesta_dias is
  'PROP-COMPLETA (29/10). Dias de vigencia que se le dan a una propuesta al enviarla. 30 por omision, decision del dueno.';
comment on column propuestas.condiciones is
  'PROP-COMPLETA (29/10). Terminos y condiciones de ESTA propuesta, copiados de la plantilla al crear y editables. NULL en las anteriores al 29/10.';
comment on column propuestas.vigente_hasta is
  'PROP-COMPLETA (29/10). Ultimo dia en que el cliente puede aceptar por la liga. Se pone al ENVIAR. NULL = sin vigencia (todas las enviadas antes del 29/10).';
comment on column propuestas.vendedor_nombre is
  'P19 (29/10). Nombre del vendedor al crear la propuesta, de la sesion. Sobrevive al borrado del usuario (usuario_id es on delete set null).';

update propuestas p
   set vendedor_nombre = u.nombre
  from usuarios u
 where u.id = p.usuario_id
   and u.tenant_id = p.tenant_id
   and p.vendedor_nombre is null;

commit;

select 'columnas nuevas en propuestas (deberia ser 3)' k, count(*)::text v
  from information_schema.columns
 where table_name = 'propuestas'
   and column_name in ('condiciones', 'vigente_hasta', 'vendedor_nombre')
union all
select 'columnas nuevas en config_negocio (deberia ser 2)', count(*)::text
  from information_schema.columns
 where table_name = 'config_negocio'
   and column_name in ('condiciones_propuesta', 'vigencia_propuesta_dias')
union all
select 'propuestas con vendedor y sin nombre (deberia ser 0)', count(*)::text
  from propuestas where usuario_id is not null and vendedor_nombre is null;
