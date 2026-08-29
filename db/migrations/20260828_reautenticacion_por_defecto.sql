-- ========================================================================
--  Una instancia nueva nace PIDIENDO la contraseña en los cambios sensibles.
-- ------------------------------------------------------------------------
--  `tenants.exigir_reautenticacion` decide si `exigirDesbloqueo()`
--  (`apps/web/lib/server/cambios.ts:199-210`) pide la contraseña o deja pasar.
--  Nació con `default false` en `20260804_reautenticacion_individual.sql:34`,
--  y **nada en las semillas ni en el aprovisionamiento lo toca**: cada
--  instancia nueva arrancaba con el candado abierto.
--
--  ── QUÉ QUEDABA SIN PEDIR NADA ─────────────────────────────────────────
--  OCHO rutas llaman a `exigirCambioSensible()`, y con el interruptor apagado
--  su segunda mitad no hace nada. Tres mueven dinero:
--
--      app/api/campanas/[id]/facturar/route.ts:15
--      app/api/cobranzas/[id]/pagar/route.ts:15
--      app/api/pagos-renta/[id]/pagar/route.ts:14
--
--  Las otras cinco son de contratos y arrendadores.
--
--  **El permiso del rol sigue aplicando**: no es que pudiera facturar
--  cualquiera. Lo que faltaba es comprobar que quien está al teclado es de
--  verdad esa persona, y no alguien que encontró una sesión abierta.
--
--  ── POR QUÉ EL DEFAULT Y NO UN `update` ────────────────────────────────
--  Encenderlo en las bases de hoy no sirve para la flota: una instancia nace
--  de `schema.sql` + migraciones, así que hereda el DEFAULT y no los datos de
--  nadie. Cambiar el default es lo único que hace que la decisión dure más
--  que el alta siguiente.
--
--  ── SIGUE SIENDO UN INTERRUPTOR ────────────────────────────────────────
--  El Dueño que no quiera la fricción lo apaga, y eso es deliberado (ADR
--  0009). Lo que cambia es la POLARIDAD: se apaga a propósito en vez de
--  encenderse a propósito. Un candado que hay que acordarse de cerrar está
--  abierto la mayor parte del tiempo.
--
--  Y la fricción es menor de lo que suena: el desbloqueo dura
--  `DESBLOQUEO_MINUTOS = 15` (`cambios.ts:49`), así que facturar diez
--  campañas seguidas pide la contraseña UNA vez.
--
--  ── LO QUE ESTA MIGRACIÓN **NO** HACE, Y ES DELIBERADO ─────────────────
--  **No toca ni una fila.** Cambia el default para las organizaciones que
--  nazcan de aquí en adelante; las que ya existen se quedan como estén.
--
--  Encenderlo en una base que ya opera es otra cosa: cambia el
--  comportamiento de gente que está trabajando ahora mismo, y eso se decide
--  por organización y se aplica como corrección de datos, con su rollback
--  capturado antes (`docs/datos/`). Mezclarlo aquí convertiría una migración
--  de esquema en una de datos sin avisar.
--
--  Transaccional e idempotente.
-- ========================================================================
begin;

alter table tenants
  alter column exigir_reautenticacion set default true;

-- ASSERT: si el default no quedó, aborta en vez de decir que sí.
do $$
declare d text;
begin
  select pg_get_expr(a.adbin, a.adrelid) into d
    from pg_attrdef a
    join pg_class c on c.oid = a.adrelid
    join pg_attribute t on t.attrelid = a.adrelid and t.attnum = a.adnum
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'tenants'
     and t.attname = 'exigir_reautenticacion';

  if d is null or d not like '%true%' then
    raise exception
      'El DEFAULT de tenants.exigir_reautenticacion no quedó en true (es: %). '
      'Sin él, cada instancia nueva nace sin pedir la contraseña en las ocho '
      'rutas sensibles, tres de ellas de dinero.', coalesce(d, '<ninguno>');
  end if;
end $$;

commit;

-- Verificación (debe devolver `true`):
--   select pg_get_expr(d.adbin, d.adrelid)
--     from pg_attrdef d
--     join pg_class c on c.oid = d.adrelid
--     join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
--    where c.relname = 'tenants' and a.attname = 'exigir_reautenticacion';
--
-- Vuelta atrás:
--   alter table tenants alter column exigir_reautenticacion set default false;
--
-- No hay datos que restaurar: esta migración no escribe en ninguna fila.
