-- ========================================================================
--  VUELTA ATRÁS de `20260828_reautenticacion_encendida.sql`
-- ------------------------------------------------------------------------
--  Devuelve el candado a `false` en las organizaciones que lo tenían así
--  ANTES de aplicar.
--
--  ── CAPTURA PREVIA, leída el 2026-08-28 ANTES de aplicar ──────────────
--  El README de este directorio lo exige: «el rollback se captura ANTES de
--  aplicar, leyendo los valores previos reales — no se escribe de memoria».
--
--      select slug, exigir_reautenticacion from tenants order by slug;
--
--      spaces_prod  ->  rgb    f
--      spaces_demo  ->  demo   f
--
--  UNA organización por base, las dos con el candado abierto. El traspaso
--  hablaba de «los cinco tenants de producción»: **esos vivían en el droplet
--  viejo**, que el ADR 0023 sacó del modelo. En el PADRE hay una y una.
--
--  Por eso este rollback SÍ va por slug explícito, como manda el README —al
--  revés que el `update` de al lado, cuya cabecera explica por qué él no puede.
--  Aquí se sabe exactamente qué había, porque se leyó.
--
--  Los dos slugs van juntos a propósito: correrlo contra `spaces_prod` alcanza
--  a `rgb` y no encuentra `demo`; contra `spaces_demo`, al revés. Un solo
--  archivo sirve para las dos bases sin condicionales.
-- ========================================================================
begin;

-- Solo los que estaban en `f`. Los que ya estuvieran en `t` no los tocó el
-- update, y devolverlos sería un cambio nuevo en vez de una vuelta atrás.
update tenants
   set exigir_reautenticacion = false
 where slug in ('rgb', 'demo');

select slug, exigir_reautenticacion from tenants order by slug;

commit;
