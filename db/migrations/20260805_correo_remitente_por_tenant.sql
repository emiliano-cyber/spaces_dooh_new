-- ============================================================================
-- El correo de la ORGANIZACIÓN, para los avisos de operación.
--
-- Hasta hoy había UN solo remitente (`EMAIL_FROM`, variable de entorno) para
-- las dos únicas salidas de correo que existen: el restablecimiento de
-- contraseña y el resumen diario de contratos. Con cinco organizaciones sobre
-- el mismo despliegue, eso significa que los avisos de negocio de todas ellas
-- salen con la misma identidad — el mismo problema de fondo que `config_negocio`
-- tenía antes del ADR 0011, solo que en el correo.
--
-- Se parte en DOS canales:
--   · SISTEMA (contraseñas, invitaciones): sigue en `EMAIL_FROM`. Es la
--     plataforma hablando, no la organización, y ocurre PRE-sesión — no hay
--     ninguna organización de la que hablar todavía (mismo razonamiento que el
--     ADR 0011 aplicó al login).
--   · OPERACIÓN (contratos, y lo que venga): lleva la identidad del tenant.
--     Esta columna es esa identidad.
--
-- POR QUÉ ES `reply_to` Y NO EL REMITENTE DE VERDAD, que es lo que uno espera:
-- el proveedor de envío (Resend) verifica DOMINIOS por DNS, no direcciones. Un
-- `From:` con el dominio del cliente exige que ESE cliente publique SPF y DKIM,
-- y son cinco organizaciones distintas con cinco dominios que no controlamos.
-- Mientras eso no exista, poner su dirección en `From:` no manda «desde» su
-- dominio: manda un correo que los filtros marcan como suplantación y acaba en
-- spam. El correo sale del dominio verificado de la plataforma, a nombre de la
-- organización, y las RESPUESTAS van a esta dirección. Se ve igual para quien
-- lo recibe y llega. El día que un cliente verifique su dominio, lo único que
-- cambia es de qué cabecera se lee esta misma columna.
--
-- CHECK DE FORMA: sin espacios ni saltos de línea, y con arroba. La validación
-- de verdad está en la app (`lib/email-remitente.ts`), pero un CR/LF que llegue
-- a una cabecera de correo es inyección de cabeceras, y esa clase de dato no se
-- deja pasar en una sola capa. Es la misma regla de validación en capas que el
-- repo ya aplica al RFC y al teléfono.
--
-- Transaccional. Idempotente.
-- ============================================================================
begin;

alter table config_negocio add column if not exists email_remitente text;

-- `null` = sin configurar, que es como nace toda organización: hasta que el
-- Dueño ponga uno, los avisos salen solo con la identidad de la plataforma.
alter table config_negocio drop constraint if exists config_negocio_email_remitente_ck;
alter table config_negocio add constraint config_negocio_email_remitente_ck
  check (
    email_remitente is null
    or (
      email_remitente ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and length(email_remitente) <= 254
    )
  );

comment on column config_negocio.email_remitente is
  'Correo de la organización para los avisos de OPERACIÓN. Viaja como Reply-To; '
  'el From es el dominio verificado de la plataforma (EMAIL_FROM). null = sin configurar.';

commit;

-- ─── Verificación ───────────────────────────────────────────────────────────
select 'columna existe', count(*)::text
  from information_schema.columns
 where table_name = 'config_negocio' and column_name = 'email_remitente'
union all
select 'filas con remitente', count(*)::text
  from config_negocio where email_remitente is not null;

-- ─── ROLLBACK ───────────────────────────────────────────────────────────────
-- begin;
--   alter table config_negocio drop constraint if exists config_negocio_email_remitente_ck;
--   alter table config_negocio drop column if exists email_remitente;
-- commit;
