-- @tipo: esquema
-- ============================================================================
--  RAZÓN SOCIAL PRINCIPAL · la de «Identidad de la empresa» sale de la lista.
-- ----------------------------------------------------------------------------
--  Hasta hoy la razón social de la organización vivía DOS veces sin conexión:
--  como texto libre en `tenants.razon_social` (Administración → Identidad) y
--  como fila en `entidades_fiscales` (el menú «Razones sociales»). Agregar una
--  en la lista no la ofrecía en Identidad, y renombrarla en un lado dejaba el
--  otro con el nombre viejo. El dueño pidió el 12/10 que estén «espejeadas».
--
--  La forma elegida: `tenants.entidad_principal_id` apunta a UNA de las filas
--  de `entidades_fiscales`, y la razón social y el RFC de la organización se
--  LEEN de esa fila. No se copian: una copia vuelve a divergir en cuanto
--  alguien renombra la entidad, que es justo el defecto que se quita.
--
--  `tenants.razon_social` y `tenants.rfc` NO se borran (expandir y luego
--  contraer): quedan como respaldo de lectura para una organización sin
--  principal y como vuelta atrás de esta versión. La aplicación deja de
--  escribir `razon_social`.
--
--  ─── La FK es compuesta, con `id` del tenant ─────────────────────────────
--  `(entidad_principal_id, id) → entidades_fiscales (id, tenant_id)`, igual que
--  `20260918_entidad_tenant_compuesto.sql`: una organización no puede apuntar a
--  la razón social de otra ni con un `update` a mano. Sin `on delete`: las
--  entidades se dan de baja lógica, nunca se borran, y un borrado físico de la
--  principal tiene que fallar en vez de dejar la organización sin identidad.
--
--  ─── El traslado, y por qué va con `set_config` por organización ─────────
--  `entidades_fiscales` tiene RLS con FORCE (`20260917_entidades_fiscales.sql`
--  §5). Si el rol que migra es el dueño de la tabla y no un superusuario, sin
--  `app.tenant_id` el `select` devuelve CERO filas y el `insert` falla. Por eso
--  el bucle fija el tenant de cada organización antes de tocarla.
--
--  Por cada organización sin principal:
--    1. Si tiene razón social escrita, se busca en su lista una con el mismo
--       nombre (sin distinguir mayúsculas ni espacios de los extremos). Si no
--       está, se agrega a la lista con el RFC de la organización.
--    2. Si no tiene razón social escrita pero tiene UNA sola activa en la
--       lista, ésa es la principal. Con dos o más no se adivina: la elige el
--       dueño en Identidad.
--    3. La elegida queda activa, y si le faltaba el RFC hereda el de la
--       organización: si no, el contrato perdería un RFC que hoy imprime.
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente: la segunda
--  corrida no encuentra organizaciones sin principal que tengan algo que
--  trasladar.
-- ============================================================================

begin;

alter table tenants add column if not exists entidad_principal_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'tenants_entidad_principal_fkey'
       and conrelid = 'tenants'::regclass
  ) then
    alter table tenants
      add constraint tenants_entidad_principal_fkey
      foreign key (entidad_principal_id, id)
      references entidades_fiscales (id, tenant_id);
  end if;
end $$;

comment on column tenants.entidad_principal_id is
  'La razon social con la que se presenta la organizacion (Identidad, contrato, '
  'firma). Es UNA de entidades_fiscales: razon_social y rfc se leen de ahi. '
  'tenants.razon_social queda solo como respaldo para una organizacion sin principal.';

do $$
declare
  t   record;
  ent   uuid;
  v_rfc text;
begin
  for t in
    select id, razon_social, rfc as rfc_tenant
      from tenants
     where entidad_principal_id is null
  loop
    perform set_config('app.tenant_id', t.id::text, true);
    ent := null;
    -- Mismo saneo que `rfcTenant` (lib/server/config-fiscal.ts).
    v_rfc := nullif(upper(regexp_replace(coalesce(t.rfc_tenant, ''), '[\s-]+', '', 'g')), '');

    if nullif(btrim(t.razon_social), '') is not null then
      select e.id into ent
        from entidades_fiscales e
       where e.tenant_id = t.id
         and lower(btrim(e.razon_social)) = lower(btrim(t.razon_social))
       order by e.activo desc, e.creado_en asc
       limit 1;

      if ent is null then
        insert into entidades_fiscales (razon_social, rfc, tenant_id)
        values (btrim(t.razon_social), v_rfc, t.id)
        returning id into ent;
      end if;
    elsif (select count(*) from entidades_fiscales e
            where e.tenant_id = t.id and e.activo) = 1 then
      select e.id into ent
        from entidades_fiscales e
       where e.tenant_id = t.id and e.activo;
    end if;

    if ent is not null then
      update entidades_fiscales e
         set activo = true,
             rfc = coalesce(e.rfc, v_rfc)
       where e.id = ent and e.tenant_id = t.id;
      update tenants set entidad_principal_id = ent where id = t.id;
    end if;
  end loop;

  perform set_config('app.tenant_id', '', true);
end $$;

commit;
