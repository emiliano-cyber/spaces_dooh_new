-- ============================================================================
--  Tablas de seguimiento de la integración con DOOHmain.
-- ----------------------------------------------------------------------------
--  Por qué existen: sostienen la IDEMPOTENCIA de las publicaciones. Registran
--  qué campaña, qué arte y qué sublista ya se crearon en DOOHmain, para que
--  reintentar una campaña no la publique dos veces. Sin ellas, cada reintento
--  duplica lo que el anunciante ve en pantalla.
--
--  De dónde sale este DDL: de `doohmain_sdk/schema.sql`, que hasta hoy había que
--  aplicar A MANO («aplicar una vez sobre la BD local»). La auditoría del
--  2026-09-01 encontró que NADIE lo aplicaba en una instancia nueva:
--  `provision-instancia.sh` corre `db/schema.sql` y `db/migrations/`, y ese
--  archivo no está en ninguno de los dos. Una instancia aprovisionada habría
--  publicado sin memoria de lo ya publicado.
--
--  ─── DOS COPIAS, y cuál manda ──────────────────────────────────────────────
--  `doohmain_sdk/schema.sql` se conserva porque el SDK también se usa suelto
--  desde la raíz del repo. **La copia que manda en una instancia es ESTA**, y
--  aquel archivo lleva ahora una cabecera que lo dice. Si divergen, gana la
--  migración: es la que tiene registro de aplicación.
--
--  ─── LO QUE ESTAS TABLAS NO TIENEN, y es una decisión ──────────────────────
--  **No llevan `tenant_id`, y por tanto no llevan RLS.** El resto del esquema sí.
--  Se acepta a sabiendas (Jochelo, 2026-09-01) porque en el modelo de instancias
--  soberanas cada instancia es de UN owner y su base no ve a nadie más.
--
--  El riesgo, escrito para que nadie lo redescubra: **si una instancia llegara a
--  alojar dos organizaciones**, el `unique (version)` de `doohmain_remote_campaigns`
--  las haría chocar — dos organizaciones con el mismo identificador de versión de
--  creativo pelearían por una sola fila, y la segunda vería la campaña de la
--  primera como «ya publicada». Hoy no ocurre: el PADRE es el único con dos
--  organizaciones y el PADRE no publica.
--
--  Cerrar esto de verdad es añadir `tenant_id` + RLS **y tocar el SDK de Python**
--  para que filtre. Se aplazó a propósito para no bloquear la primera venta.
--
--  Nombres en inglés y sin prefijo: son del SDK, no nuestros. Renombrarlos aquí
--  obligaría a tocar `doohmain_sdk/db.py`, que es exactamente lo que esta
--  migración evita.
-- ============================================================================

begin;

create table if not exists doohmain_remote_campaigns (
    id             bigint generated always as identity primary key,
    version        text        not null,
    auth           text,
    name           text,
    anunciante     text,
    created_at     timestamptz not null default now(),
    last_synced_at timestamptz not null default now(),
    constraint uniq_version unique (version)   -- una campaña por versión de creativo
);

create table if not exists doohmain_remote_lists (
    id             bigint generated always as identity primary key,
    screen_name    text        not null,
    list_name      text        not null,
    campaign_auth  text,
    media_id       bigint      not null,
    created_at     timestamptz not null default now(),
    last_synced_at timestamptz not null default now(),
    constraint uniq_screen_list_media unique (screen_name, list_name, media_id)
);

create table if not exists media_uploads (
    id           bigint generated always as identity primary key,
    version      text        not null,
    media_id     bigint      not null,
    file_hash    text,
    filename     text,
    local_path   text,
    ancho        integer,
    alto         integer,
    extension    text,
    source_mtime bigint,
    source_size  bigint,
    uploaded_at  timestamptz not null default now(),
    constraint uniq_media_version unique (version)
);

-- ─── Los permisos, EXPLÍCITOS y no por omisión ──────────────────────────────
--  No se confía en `alter default privileges` de `20260820_grants_rol_app.sql`:
--  esa cláusula se escribió **sin `for role`**, y en PostgreSQL eso significa
--  «para los objetos que cree el ROL ACTUAL». Es el hallazgo H1 de la auditoría
--  del 2026-08-24, y tiene su propia prueba en
--  `apps/web/lib/test/grants-tablas-futuras.e2e.test.ts`: basta con que esta
--  migración la aplique otro rol para que estas tres tablas nazcan **sin
--  permisos para la aplicación**, en silencio y sin error.
--
--  El SDK conecta como el rol de la aplicación (`DB_USER`), así que sin esto
--  publicaría bien y no podría registrar que publicó — que es el peor de los
--  dos fallos posibles: el reintento duplicaría.
do $$
declare
  candidatos text[] := array['spaces_app', 'spaces_user'];
  r           text;
  encontrados int := 0;
begin
  foreach r in array candidatos loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format(
        'grant select, insert, update, delete on doohmain_remote_campaigns, doohmain_remote_lists, media_uploads to %I', r);
      execute format(
        'grant usage, select on all sequences in schema public to %I', r);
      encontrados := encontrados + 1;
    end if;
  end loop;

  -- Fail-closed, igual que `20260820_grants_rol_app.sql`: conceder a un rol
  -- ausente no es un error de Postgres, es una migración que no hizo nada y lo
  -- dio por bueno.
  if encontrados = 0 then
    raise exception 'No existe ninguno de los roles de aplicacion (spaces_app, spaces_user): las tablas de DOOHmain quedarian sin permisos y el SDK no podria registrar lo publicado.';
  end if;
end $$;

commit;
