-- ============================================================================
-- `usuarios.solo_google` — la contraseña deja de ser una puerta.
-- (ADR 0028 · B3 del Plan_Acceso_Duenos)
--
-- ── Qué cierra ─────────────────────────────────────────────────────────────
-- El ADR 0028 decide que las cuentas del PADRE y el Dueño de cada instancia
-- entran SOLO con Google. Hasta hoy eso era una intención: no existía ningún
-- candado —cero coincidencias en el repositorio— así que una cuenta con Google
-- vinculado podía entrar igual con su contraseña.
--
-- Y esa contraseña es justo el problema que el ADR retira: la genera el
-- operador del alta, la ve en su pantalla y se queda en su historial. ROJO-1 y
-- el defecto 22 la atacaron dos veces sin llegar a quitarla.
--
-- ── Por qué la contraseña SIGUE existiendo aunque no abra ──────────────────
-- Porque el punto 4 del ADR la necesita: para CAMBIAR cosas hace falta
-- teclearla, aunque se haya entrado con Google. Este candado no borra el hash ni
-- lo invalida: solo dice que con él no se ENTRA. Son dos preguntas distintas y
-- se responden por separado.
--
-- ── Y por qué nace en `false` para todos ──────────────────────────────────
-- Poner `true` a las cuentas de máximo privilegio de golpe dejaría fuera a
-- cualquiera que no tenga Google vinculado — incluido quien esté leyendo esto.
-- El candado se pone cuenta por cuenta y a propósito, y quien lo ponga tiene que
-- haberse asegurado antes de que esa persona puede entrar de otra forma: con
-- Google, o con sus códigos de recuperación (B1/B2).
--
-- Transaccional. Idempotente.
-- ============================================================================
begin;

alter table usuarios
  add column if not exists solo_google boolean not null default false;

comment on column usuarios.solo_google is
  'ADR 0028: si es true, esta cuenta NO entra con contrasena -- solo con Google '
  'o con un codigo de recuperacion. La contrasena sigue existiendo y sigue '
  'haciendo falta para los CAMBIOS (punto 4 del ADR): son dos preguntas '
  'distintas.';

-- ─── ASSERT: nace apagado, y para todos ────────────────────────────────────
-- Si alguien la creara con `default true`, esta migración dejaría fuera a todo
-- el que no tenga Google vinculado — y se descubriría al intentar entrar.
do $$
declare encendidos int;
begin
  select count(*) into encendidos from usuarios where solo_google;
  if encendidos > 0 then
    raise exception
      'solo_google nace encendido en % usuarios: dejaria fuera a quien no tenga Google', encendidos;
  end if;
end $$;

-- ─── Por qué NO se toca `auth_usuario_por_email()` ────────────────────────
-- El primer intento fue añadirle `solo_google` al `returns table`, como hizo
-- `20260825_sesion_metodo.sql` con la de sesión. **Y rompió `reaplicacion`**:
-- `20260720_hard1_usuarios_rls.sql:40` la crea con `create or replace` y sin
-- guarda, así que al reaplicar la cadena entera intentaba devolverla a su forma
-- anterior y abortaba con «cannot change return type of existing function».
-- Reaplicar no es hipotético: `deploy.yml:141-148` lo hace en cada despliegue.
--
-- La salida documentada sería ponerle a esa migración la guarda de
-- `to_regprocedure` que ya lleva su otra función (`:68-79`). Se descarta: eso es
-- EDITAR UNA MIGRACIÓN YA APLICADA EN PRODUCCIÓN (R3), rompe el guard de
-- checksums de F3.3 y obliga a `--forzar-checksum` en cada instancia de la
-- flota. Un precio alto para ahorrarse una consulta.
--
-- Así que la bandera se lee aparte, en `/api/auth/login`: cuando hace falta ya
-- se conoce el tenant —lo devuelve la propia función— así que va por
-- `qConTenant`, con la RLS puesta, y después de verificar la contraseña. Para
-- un intento fallido no cuesta ni una consulta.

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
select column_name, data_type, column_default, is_nullable
  from information_schema.columns
 where table_name = 'usuarios' and column_name = 'solo_google';
