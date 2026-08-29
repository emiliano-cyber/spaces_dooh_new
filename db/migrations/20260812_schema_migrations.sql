-- ============================================================================
--  `schema_migrations` — el registro de lo que cada instancia ya aplicó.
-- ----------------------------------------------------------------------------
--  Hasta hoy no existe ninguna tabla de control: el despliegue reaplica TODAS
--  las migraciones en cada corrida y confía en que sean idempotentes
--  (`.github/workflows/deploy.yml:141-148`). Con un solo servidor y una persona
--  mirando funciona. Con una flota de instancias no: no hay forma de preguntar
--  en qué versión de esquema está un droplet salvo ir a mirarlo a mano.
--
--  Esta tabla es la respuesta, y el runner de migraciones (F3.2) la consume.
--
--  ── Por qué está EXENTA de RLS ────────────────────────────────────────────
--  No es un olvido ni una excepción negociada: es infraestructura de la
--  instancia, no dato de negocio. Misma categoría que `folios_consecutivos`
--  (`db/schema.sql:93-99`). No tiene `tenant_id` porque en el modelo de
--  instancias soberanas el registro de esquema es de la INSTANCIA entera, no de
--  una organización dentro de ella. Y el runner la lee antes de que exista
--  sesión alguna: con RLS activa y sin `app.tenant_id` fijado devolvería cero
--  filas —sin error— y el runner concluiría que no hay nada aplicado. Ese es
--  justo el modo de fallo silencioso de R2, por el otro extremo.
--
--  ── El backfill, y por qué la lista va escrita ────────────────────────────
--  Sin backfill, la primera corrida del runner en el droplet actual «aplicaría»
--  las migraciones históricas. Son idempotentes y no romperían nada, pero el
--  registro nacería mintiendo: diría que se aplicaron hoy, con este runner,
--  cuando llevan meses aplicadas a mano.
--
--  Un `.sql` no puede listar un directorio (`pg_ls_dir` es de superusuario y
--  además leería el disco del SERVIDOR de base de datos, donde `db/migrations`
--  no está). Así que la lista va aquí, literal. Y no envejece, que es la
--  objeción evidente: NO es «las migraciones que haya en el repo», es **las que
--  la flota tenía aplicadas al 2026-08-12**. Eso es un hecho histórico, y los
--  hechos históricos no cambian. Una migración escrita mañana no debe entrar en
--  esta lista jamás — debe aplicarse de verdad, y registrarla es trabajo del
--  runner.
--
--  Tres reglas fijan qué entra:
--
--    1. Corte en 2026-08-12. Entra lo anterior. `20260812_sin_default_tenant
--       .sql` NO entra: está escrita pero **no aplicada en producción** (F1.2 →
--       F1.5). Marcarla como hecha dejaría el DEFAULT de `tenant_id` vivo en el
--       droplet para siempre, con el registro jurando lo contrario.
--    2. Solo migraciones de ESQUEMA. `20260731_calendario_meses_cortos.sql`
--       lleva `-- @tipo: datos` y esas `deploy.yml` no las aplica nunca en un
--       despliegue normal: hay que pedirlas a mano. De ella no se puede afirmar
--       que corrió, así que no se afirma. Queda como pendiente, que es la
--       verdad, y el runner la seguirá omitiendo por defecto.
--    3. Esta migración NO se registra a sí misma. La registra quien la aplique
--       —el runner— y así queda con su checksum real en vez de `'backfill'`.
--
--  `checksum = 'backfill'`: las anteriores al 2026-08-12 se aplicaron a mano,
--  sin que nadie guardara el hash del archivo de origen. No hay checksum que
--  poner, y inventarlo (calcularlo hoy sobre el archivo del repo) sería peor:
--  afirmaría que lo aplicado coincide con lo que hoy hay en disco, que es
--  precisamente lo que no sabemos. La marca las distingue para que la
--  comprobación de integridad de F3.3 se las salte a conciencia.
--
--  `aplicada_en` de las filas del backfill es CUÁNDO SE RELLENÓ, no cuándo se
--  aplicó cada migración. Ese dato no existe en ningún sitio. La marca de
--  checksum es también lo que avisa de eso.
--
--  ── Heurística de «base con historia» ─────────────────────────────────────
--  Existe `tenants` y tiene filas. Nótese que la tabla debe EXISTIR: en una base
--  recién creada, donde ni siquiera corrió `schema.sql`, no hay nada que
--  respetar y la tabla queda vacía para que el runner lo aplique todo. En
--  cambio, en cuanto `schema.sql` ha corrido siempre hay al menos un tenant
--  (`db/schema.sql:598` siembra 'rgb'), y en ese punto de la secuencia las 65
--  anteriores o llevan meses aplicadas (droplet) o acaban de aplicarse en esta
--  misma pasada (instalación nueva) — en los dos casos darlas por aplicadas es
--  lo correcto.
--
--  Transaccional e idempotente: correrla dos veces no cambia una sola fila.
-- ============================================================================

begin;

-- ─── 1. La tabla ───────────────────────────────────────────────────────────
create table if not exists schema_migrations (
  archivo     text primary key,                       -- nombre del .sql, tal cual
  checksum    text not null,                          -- sha256, o 'backfill'
  aplicada_en timestamptz not null default now(),
  tipo        text not null default 'esquema'
    check (tipo in ('esquema', 'datos'))
);

comment on table schema_migrations is
  'Migraciones ya aplicadas en ESTA instancia. Sin RLS a proposito: es infraestructura de la instancia, no dato de negocio (igual que folios_consecutivos).';
comment on column schema_migrations.checksum is
  'sha256 del archivo aplicado. El valor ''backfill'' marca las anteriores al 2026-08-12, aplicadas a mano y sin checksum de origen.';
comment on column schema_migrations.aplicada_en is
  'En las filas de backfill es cuando se relleno el registro, no cuando se aplico la migracion: ese dato no existe.';

-- ─── 2. Backfill ───────────────────────────────────────────────────────────
-- Va dentro de un bloque plpgsql por una razón concreta: en una base virgen la
-- tabla `tenants` NO existe, y una sentencia SQL suelta que la nombrara fallaría
-- al ANALIZARSE, aunque su `where` nunca se cumpliera. plpgsql no analiza las
-- ramas que no ejecuta, así que el `return` de arriba protege de verdad al
-- `insert` de abajo.
do $$
declare n int;
begin
  if to_regclass('public.tenants') is null then
    raise notice 'Base sin `tenants`: instalacion nueva. schema_migrations queda vacia y el runner aplicara todo.';
    return;
  end if;

  if not exists (select 1 from tenants) then
    raise notice 'Base con esquema pero sin organizaciones: no hay historia que respetar.';
    return;
  end if;

  insert into schema_migrations (archivo, checksum, tipo)
  select archivo, 'backfill', 'esquema'
    from unnest(array[
      '20260625_agencia_en_propuesta.sql',
      '20260625_negociacion_agencia.sql',
      '20260625_validacion_publicacion.sql',
      '20260626_config_ajustes.sql',
      '20260629_bitacora_append_only.sql',
      '20260706_cobranza_recordatorios.sql',
      '20260706_propuesta_aceptacion.sql',
      '20260706_propuesta_descuento_version.sql',
      '20260706_reserva_ttl.sql',
      '20260708_g500_estaticas.sql',
      '20260708_oc_numero.sql',
      '20260708_propuesta_token_publico.sql',
      '20260708_snapshot_economico.sql',
      '20260715_arr_m1_columnas.sql',
      '20260715_arr_m2_tablas.sql',
      '20260715_arr_m3_periodicidad.sql',
      '20260715_arr_m4_backfill.sql',
      '20260715_arr_m5_rls_failclosed.sql',
      '20260715_arr_m6_rol_restringido.sql',
      '20260715_arr_m7_pago_periodo_unico.sql',
      '20260715_sitio_arrendador.sql',
      '20260715_sitio_renta.sql',
      '20260716_arr_m8_contrato_activo_unico.sql',
      '20260716_control_cambios.sql',
      '20260716_doohmain_playlogs.sql',
      '20260717_config_razon_social_comercial.sql',
      '20260717_tenant_razon_social_comercial.sql',
      '20260720_hard1_rls_todas_tablas.sql',
      '20260720_hard1_usuarios_rls.sql',
      '20260721_campana_contrato.sql',
      '20260721_propuesta_unidad_spots.sql',
      '20260723_almacen.sql',
      '20260723_password_resets.sql',
      '20260723_sitio_pausa_legal.sql',
      '20260724_a1_carreras_endurecer.sql',
      '20260724_a3_moneda_default_mxn.sql',
      '20260724_moneda_por_tenant.sql',
      '20260724_n6_config_negocio_moneda_mxn.sql',
      '20260724_n7_recalc_estatus_sitios.sql',
      '20260724_unicidad_carreras.sql',
      '20260727_contrato_incompleto.sql',
      '20260727_contrato_incompleto_cancelable.sql',
      '20260727_contrato_incompleto_cubre_campana.sql',
      '20260727_contrato_incompleto_enum.sql',
      '20260728_calendario_contratos_existentes.sql',
      '20260728_cobro_parcialidades.sql',
      '20260728_contrato_integridad_ck.sql',
      '20260728_contrato_pantalla_activo_uq.sql',
      '20260728_propuesta_renta.sql',
      '20260729_datos_contrato_documento.sql',
      '20260729_firma_contrato.sql',
      '20260729_licencias_permisos.sql',
      '20260729_periodicidad_diaria.sql',
      -- 20260731_calendario_meses_cortos.sql va FUERA: es `@tipo: datos`.
      '20260804_cupo_clientes_pantalla.sql',
      '20260804_folios_consecutivos.sql',
      '20260804_modulo_inventario.sql',
      '20260804_reautenticacion_individual.sql',
      '20260805_config_negocio_por_tenant.sql',
      '20260805_correo_remitente_por_tenant.sql',
      '20260805_logo_publico.sql',
      '20260805_objetos_solo_en_prod.sql',
      '20260806_identidades_externas.sql',
      '20260807_password_resets_rls.sql',
      '20260810_arrendadores_rfc_unico.sql',
      '20260810_notificaciones_archivada_en.sql'
    ]) as archivo
  -- Lo que hace idempotente al backfill. En la segunda corrida no inserta nada,
  -- y sobre todo no PISA el checksum real que el runner haya escrito ya.
  on conflict (archivo) do nothing;

  get diagnostics n = row_count;
  raise notice 'Backfill: % migraciones historicas registradas como aplicadas.', n;
end $$;

-- ─── 3. ASSERT ─────────────────────────────────────────────────────────────
-- El arnés de integración aplica todas las migraciones desde cero en cada
-- corrida, así que esto se comprueba en CI y no solo el día del despliegue.
do $$
declare faltan text;
begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'schema_migrations no quedo creada';
  end if;

  select string_agg(c, ', ') into faltan
    from unnest(array['archivo','checksum','aplicada_en','tipo']) as c
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'schema_migrations'
        and column_name = c
   );
  if faltan is not null then
    raise exception 'schema_migrations existe pero le faltan columnas: %', faltan;
  end if;

  if not exists (
    select 1 from pg_index i
      join pg_class c on c.oid = i.indrelid
      join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
     where c.relname = 'schema_migrations' and i.indisprimary and a.attname = 'archivo'
  ) then
    raise exception 'schema_migrations no tiene a `archivo` como clave primaria';
  end if;

  -- El registro no puede afirmar nada de una migración que aún no se aplicó.
  if exists (select 1 from schema_migrations where archivo >= '20260812') then
    raise exception 'El backfill registro migraciones posteriores al corte del 2026-08-12';
  end if;
end $$;

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
-- En el droplet debe devolver 65 y la más reciente ha de ser la del 10/08.
--   select count(*) as registradas, max(archivo) as ultima from schema_migrations;
--
-- ─── ROLLBACK ──────────────────────────────────────────────────────────────
-- Limpio: la tabla es nueva y nada más la referencia.
--   drop table if exists schema_migrations;
