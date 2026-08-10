-- ===========================================================================
--  Alta de «yahel» y asignacion de las DOS ordenes de trabajo sin responsable.
--
--  Tenant g500: 4cdba4aa-444d-4238-a983-959d18b1a2bf (el mismo del A9, M13b e
--  INC-05).
--
--  ── POR QUE ESTO ES UN SCRIPT Y NO SE HACE POR LA APLICACION ──────────────
--  No hay forma de reasignar una OT ya creada. Las rutas son
--  `GET·POST /api/ot`, `GET /api/ot/:id` y `POST /api/ot/:id/cerrar`: NO existe
--  un `PATCH`. `asignado_a` solo se escribe en dos momentos — al CREAR la OT
--  (`crearOTCtrl`, campo `asignadoA`) y al CERRARLA, donde `ot-repo.ts:193`
--  hace `asignado_a = coalesce(asignado_a, $3)` para estampar a quien cierra.
--
--  Esas dos OT son residuo ANTERIOR a esa guarda (hallazgo A-3 de la auditoria
--  QA): se cerraron cuando cerrar todavia no dejaba responsable.
--
--  ── DECISION DEL NEGOCIO, TOMADA EL 10/08 ─────────────────────────────────
--  El script de INC-05 dejo esto expresamente sin hacer, porque escribir el
--  nombre de una persona es afirmar que hizo un trabajo de campo. El usuario
--  decidio el 10/08 que las dos son de yahel (eyro0303@gmail.com). Queda dicho
--  aqui de donde sale el nombre: de una decision, no de un dato del sistema.
--
--  ANTES DE APLICAR, mira el PASO 0.3: si `evidencias_ot.uploaded_by` dice
--  quien las cerro de verdad, ESE es el responsable real y esta decision
--  deberia revisarse. Cuesta una consulta y evita firmar un trabajo ajeno.
--
--  ── COMO ENTRA YAHEL ──────────────────────────────────────────────────────
--  Con GOOGLE. `eyro0303@gmail.com` es una cuenta de Google, y el ADR 0012
--  (enmendado el 07/08) vincula por correo VERIFICADO la primera vez y por
--  `sub` despues. No hace falta comunicarle ninguna contrasena.
--
--  Aun asi la fila NACE CON `password_hash`, y no es un descuido: sin hash, esa
--  persona no podria desbloquear operaciones de dinero (`cambios.ts:168-170`)
--  ni cambiar su perfil (`perfil-controller.ts:37-43`), y un restablecimiento
--  la dejaria ENCERRADA. Es el invariante que sostiene el alta «entra con
--  Google» del propio producto. Se genera con `crypt(gen_random_uuid(), bf)`:
--  un bcrypt de un valor aleatorio que NADIE conoce ni queda escrito en ningun
--  sitio, asi que la unica puerta real es Google.
--
--  Idempotente: el alta va con `on conflict do nothing` sobre el indice unico
--  de correo, y el UPDATE lleva `asignado_a is null` en el WHERE.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  PASO 0 · Capturar el estado previo. La convencion de docs/datos/README.md
--  exige que el rollback se lea de la base, no se escriba de memoria.
-- ---------------------------------------------------------------------------
--
--  0.1 · Que el correo no exista ya (el indice es GLOBAL, no por tenant):
--   select id, nombre, email, rol, tenant_id from usuarios
--    where lower(email) = 'eyro0303@gmail.com';
--
--  0.2 · Las OT que se van a tocar — APUNTA SUS IDS, el rollback los necesita:
--   select set_config('app.tenant_id','4cdba4aa-444d-4238-a983-959d18b1a2bf',false);
--   select id, folio, tipo, estatus, fecha_completada, asignado_a
--     from ordenes_trabajo where asignado_a is null order by folio;
--
--  0.3 · ¿SABEMOS YA QUIEN LAS CERRO? Si esto devuelve un nombre, ese es el
--        responsable real y hay que replantear la decision antes de seguir:
--   select o.folio, u.nombre as subio_evidencia, e.tomada_en, e.timestamp
--     from ordenes_trabajo o
--     join evidencias_ot e on e.ot_id = o.id
--     left join usuarios u on u.id = e.uploaded_by
--    where o.asignado_a is null
--    order by o.folio, e.timestamp;
--
--   select accion, entidad, usuario_nombre, timestamp from acciones
--    where entidad ilike '%OT-%' order by timestamp desc limit 20;
--
-- ---------------------------------------------------------------------------
--  PASO 1 · Ensayo. El mismo archivo con `commit` cambiado por `rollback`.
--  Debe tocar 1 usuario y 2 OT, y ni una mas.
-- ---------------------------------------------------------------------------

begin;

select set_config('app.tenant_id', '4cdba4aa-444d-4238-a983-959d18b1a2bf', false);

-- ─── 1. El usuario ─────────────────────────────────────────────────────────
-- `rol = 'OPERACIONES'`: es quien atiende ordenes de trabajo en campo, y es el
-- permiso que necesita para verlas. NO se le da `DUENO` ni `administracion`.
--
-- El correo se guarda en minusculas porque el indice unico es
-- `lower(email)` y el login normaliza asi (`usuarios-repo.ts:52`).
insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
select 'yahel',
       'eyro0303@gmail.com',
       'Operaciones',
       'OPERACIONES',
       crypt(gen_random_uuid()::text, gen_salt('bf', 10)),
       true,
       '4cdba4aa-444d-4238-a983-959d18b1a2bf'
 where not exists (
   select 1 from usuarios where lower(email) = 'eyro0303@gmail.com'
 );

-- ─── 2. Las dos ordenes de trabajo ─────────────────────────────────────────
-- Se acotan por `asignado_a is null` y NO por id: asi el script dice lo que
-- hace («las que no tienen responsable») en vez de depender de dos uuid
-- copiados a mano, y una segunda pasada toca cero filas. La comprobacion del
-- paso 4 se encarga de que sean exactamente dos.
update ordenes_trabajo
   set asignado_a = (select id from usuarios where lower(email) = 'eyro0303@gmail.com')
 where tenant_id = '4cdba4aa-444d-4238-a983-959d18b1a2bf'
   and asignado_a is null;

-- ─── 3. Bitacora ───────────────────────────────────────────────────────────
-- Un cambio de datos a mano no aparece en `git log` de ninguna otra forma. Y
-- aqui importa mas que de costumbre: se esta atribuyendo trabajo de campo a una
-- persona por decision, no por evidencia. Que quede escrito quien lo decidio.
insert into acciones (accion, entidad, usuario_nombre, tenant_id)
values ('Alta de yahel y asignacion de las 2 OT sin responsable',
        'Decision del usuario del 10/08; no se dedujo de evidencias',
        'Sistema',
        '4cdba4aa-444d-4238-a983-959d18b1a2bf');

-- ─── 4. Comprobacion dentro de la misma transaccion ────────────────────────
do $$
declare
  v_id uuid;
  v_n  int;
begin
  select id into v_id from usuarios where lower(email) = 'eyro0303@gmail.com';
  if v_id is null then
    raise exception 'No se creo el usuario yahel.';
  end if;

  -- Que este en g500 y no en otra organizacion: si el correo YA existia en otro
  -- tenant, el `where not exists` no habria insertado nada y el UPDATE de
  -- arriba habria asignado las OT de g500 a una persona de otra empresa.
  if (select tenant_id from usuarios where id = v_id)
     is distinct from '4cdba4aa-444d-4238-a983-959d18b1a2bf'::uuid then
    raise exception 'El correo eyro0303@gmail.com ya pertenece a OTRA organizacion. Aborta.';
  end if;

  select count(*) into v_n
    from ordenes_trabajo
   where tenant_id = '4cdba4aa-444d-4238-a983-959d18b1a2bf'
     and asignado_a = v_id;
  if v_n <> 2 then
    raise exception 'Se esperaban 2 OT asignadas a yahel y hay %. Revisa el PASO 0.2.', v_n;
  end if;

  if exists (
    select 1 from ordenes_trabajo
     where tenant_id = '4cdba4aa-444d-4238-a983-959d18b1a2bf' and asignado_a is null
  ) then
    raise exception 'Quedan OT sin responsable en g500.';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
--  DESPUES DE APLICAR
--
--  · Administracion -> Usuarios: aparece «yahel» con rol OPERACIONES.
--  · Operaciones: las dos OT dejan de decir «Sin asignar».
--  · Yahel entra por «Continuar con Google» con eyro0303@gmail.com. NO tiene
--    contrasena que nadie conozca: si alguna vez necesita una, se le
--    restablece desde Administracion.
--  · Comprobar el vinculo despues de su primer acceso:
--      select proveedor, email_externo, ultimo_uso_en from identidades_externas;
-- ---------------------------------------------------------------------------
