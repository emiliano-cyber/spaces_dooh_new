-- @tipo: esquema
-- ============================================================================
--  IDIOMA-USUARIO · EL IDIOMA DE LA INTERFAZ, POR PERSONA.
-- ----------------------------------------------------------------------------
--  Decisión del dueño (03/11): «el idioma de papeles y contratos es fijo al
--  crearse la app en cada server, pero el idioma de lo demás se debe poder
--  configurar por usuario y navegador». Esta columna es la mitad «por usuario».
--  La de «por navegador» ya existía: la cookie `spaces_idioma`.
--
--  `null` = la persona NO eligió: sigue a su navegador (cookie y después
--  `Accept-Language`). Es el valor de todas las filas que ya existen, así que
--  sin que nadie toque «Mi cuenta» el comportamiento es EXACTAMENTE el de antes.
--
--  ═══ POR QUÉ UN CHECK Y NO UN ENUM ═══════════════════════════════════════
--  Un cuarto idioma tiene que poder añadirse con otra migración de una línea
--  (soltar y volver a crear el CHECK). Con un enum, `alter type … add value` no
--  corre dentro de una transacción en todas las versiones que soportamos.
--
--  ═══ QUÉ NO HACE ═════════════════════════════════════════════════════════
--  · No guarda si el idioma está ENCENDIDO en la instancia: eso es del entorno
--    (`IDIOMA_INGLES`, `IDIOMA_ITALIANO`) y cambia sin migración. Una
--    preferencia en un idioma apagado se IGNORA al resolver
--    (`lib/i18n/idiomas.ts`, `resolverIdioma`), no se borra: si el idioma se
--    vuelve a encender, la persona lo recupera sin tocar nada.
--  · No toca el idioma de los documentos (contratos, propuestas impresas):
--    ese es de la instancia y es otra tarea.
--  · No toca la RLS: `usuarios` ya es fail-closed + FORCE por fila, y una
--    columna nueva hereda esas políticas. Se lee con `qConTenant` en el login
--    y se escribe con `q` (tenant de la sesión) + `and tenant_id = $n`.
--  · No toca `auth_usuario_por_sesion()` ni `auth_usuario_por_email()`:
--    cambiar su `returns table` rompe la reaplicación de
--    `20260720_hard1_usuarios_rls.sql` (ver la cabecera de
--    `20260907_solo_google.sql`).
--
--  Transaccional. Idempotente: se puede correr dos veces.
-- ============================================================================
begin;

alter table usuarios
  add column if not exists idioma_preferido text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'usuarios_idioma_preferido_valido'
       and conrelid = 'usuarios'::regclass
  ) then
    alter table usuarios
      add constraint usuarios_idioma_preferido_valido
      check (idioma_preferido is null or idioma_preferido in ('es', 'en', 'it'));
  end if;
end $$;

comment on column usuarios.idioma_preferido is
  'Idioma de la INTERFAZ elegido por la persona en Mi cuenta (es/en/it). '
  'null = seguir al navegador (cookie spaces_idioma y Accept-Language). Si el '
  'idioma esta apagado en la instancia se ignora sin error. No afecta a los '
  'documentos (contratos, propuestas impresas), que son de la instancia.';

-- Sin DEFAULT a propósito: al añadirse, TODAS las filas quedan en null («sigue
-- al navegador»). Un default cambiaría el idioma de toda la flota al aplicar la
-- migración, que es justo lo que la regla «sin preferencia, como hoy» prohíbe.
-- No lleva un assert de «todas en null» porque la reaplicación de la cadena
-- (`deploy.yml`) corre esto sobre bases donde la gente YA eligió.

commit;
