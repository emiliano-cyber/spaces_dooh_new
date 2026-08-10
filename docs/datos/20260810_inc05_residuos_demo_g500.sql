-- ===========================================================================
--  INC-05 (plan de incidencias) — residuos de prueba visibles en la demo.
--
--  Tenant g500: 4cdba4aa-444d-4238-a983-959d18b1a2bf (el mismo del A9 y M13b).
--
--  ── Lo que YA NO hace falta, comprobado el 10/08 ──────────────────────────
--  El plan pedia tambien recalcular el importe negativo de la campana
--  «EdgeCase Fechas» y limpiar los creativos «WhatsApp Image…». Las dos cosas
--  estan hechas: cero campanas con fecha_fin < fecha_inicio (se corrigio en el
--  A9 del 04/08, y con ello el importe, que es DERIVADO) y cero creativos con
--  ese nombre. Se dice aqui para que nadie los busque otra vez.
--
--  ── Lo que este script NO toca, y por que ─────────────────────────────────
--  Las DOS ordenes de trabajo sin responsable. El plan pedia asignarles «el
--  primer usuario con rol OPERACIONES». No se hace: son las UNICAS dos OT que
--  existen en g500, o sea que el campo nunca se uso — no es un registro suelto
--  que se quedo atras. Escribir ahi el nombre de una persona seria afirmar que
--  hizo un trabajo de campo que nadie sabe si hizo, en un sistema cuya bitacora
--  se usa como prueba. Eso es una decision del negocio, no una limpieza.
--  Pendiente de que una persona diga a quien corresponden, o de dejarlas asi.
--
--  Nada aqui cambia importes, facturas ni cobranza: son rotulos.
--
--  Idempotente: cada UPDATE lleva en el WHERE el valor VIEJO, asi que una
--  segunda pasada toca 0 filas en vez de volver a escribir.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  PASO 0 · Capturar el estado previo. La convencion de docs/datos/README.md
--  exige que el rollback se lea de la base, no se escriba de memoria.
--  Corre esto ANTES y contrasta con el _rollback.sql.
-- ---------------------------------------------------------------------------
--
--   select id, slug, nombre, nombre_comercial from tenants where slug = 'g500';
--
--   select set_config('app.tenant_id','4cdba4aa-444d-4238-a983-959d18b1a2bf',false);
--   select id, nombre from creatividades
--    where id = 'c8765a73-9391-4fad-80b7-9399db80a413';
--   select id, nombre, email from usuarios
--    where id = '86174026-3701-4c64-8000-08d53037d5df';
--
-- ---------------------------------------------------------------------------
--  PASO 1 · Ensayo. El mismo archivo con `commit` cambiado por `rollback`,
--  comprobando que toca 3 filas y ni una mas.
-- ---------------------------------------------------------------------------

begin;

-- `tenants` esta exenta de RLS (es pre-sesion), pero el resto no: se fija el
-- contexto para los UPDATE de `creatividades` y `usuarios`.
select set_config('app.tenant_id', '4cdba4aa-444d-4238-a983-959d18b1a2bf', false);

-- ─── 1. El nombre comercial que se ve en la aplicacion ─────────────────────
-- Vive en `tenants.nombre_comercial`, NO en `config_negocio` como decia el
-- plan: esa columna se retiro en el ADR 0011, cuando la configuracion paso a
-- ser una fila por organizacion.
update tenants
   set nombre_comercial = 'PIXELED'
 where id = '4cdba4aa-444d-4238-a983-959d18b1a2bf'
   and nombre_comercial = 'DEMO PIXELED.';

-- ─── 2. El nombre del archivo de un creativo ───────────────────────────────
-- Solo el ROTULO. `archivo_url` no se toca, asi que la imagen sigue siendo
-- exactamente la misma. La campana es KFC (folio G50020260720787), verificado.
update creatividades
   set nombre = 'creativo-kfc.jpg'
 where id = 'c8765a73-9391-4fad-80b7-9399db80a413'
   and nombre = 'upsivale 1920.jpg';

-- ─── 3. El usuario que se llama «DEMO» ─────────────────────────────────────
-- Se renombra el nombre visible y NADA MAS: no se borra —tiene historial en la
-- bitacora y borrarlo dejaria referencias huerfanas— ni se toca su contrasena,
-- su rol ni su correo. Las entradas de bitacora YA ESCRITAS conservan «DEMO»
-- porque guardan el nombre del momento; eso es correcto y no se reescribe.
update usuarios
   set nombre = 'Operador Demo'
 where id = '86174026-3701-4c64-8000-08d53037d5df'
   and nombre = 'DEMO';

-- ─── 4. Bitacora ───────────────────────────────────────────────────────────
-- Un cambio de datos a mano no aparece en `git log` de ninguna otra forma.
insert into acciones (accion, entidad, usuario_nombre, tenant_id)
values ('Limpieza de residuos de demo (INC-05)',
        'nombre comercial, creativo de KFC y usuario DEMO',
        'Sistema',
        '4cdba4aa-444d-4238-a983-959d18b1a2bf');

-- ─── 5. Comprobacion dentro de la misma transaccion ────────────────────────
do $$
declare v text;
begin
  select nombre_comercial into v from tenants where id='4cdba4aa-444d-4238-a983-959d18b1a2bf';
  if v is distinct from 'PIXELED' then
    raise exception 'El nombre comercial quedo en «%», no en PIXELED.', v;
  end if;
  if exists (select 1 from creatividades where nombre ilike '%upsivale%') then
    raise exception 'Sigue habiendo un creativo «upsivale».';
  end if;
  if exists (select 1 from usuarios where nombre = 'DEMO') then
    raise exception 'Sigue habiendo un usuario llamado «DEMO».';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
--  DESPUES DE APLICAR
--
--  · Dashboard y menu lateral: ya no debe leerse «DEMO PIXELED.».
--  · Creativos de la campana KFC: el archivo se llama «creativo-kfc.jpg» y la
--    imagen se sigue viendo (solo cambio el rotulo).
--  · Administracion -> Usuarios: «Operador Demo» en vez de «DEMO».
--  · Lo que SIGUE viendose y es de datos, no de codigo:
--      - 11 de 12 sitios sin fotografia (B5) — hay que subirlas;
--      - win rate 100% (B9) — hay que registrar las propuestas perdidas;
--      - 2 ordenes de trabajo sin responsable — ver la nota de la cabecera.
-- ---------------------------------------------------------------------------
