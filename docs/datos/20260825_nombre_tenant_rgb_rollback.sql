-- ============================================================================
--  ROLLBACK de `20260825_nombre_tenant_rgb.sql`
-- ----------------------------------------------------------------------------
--  Devuelve el nombre de la organización del PADRE a su valor previo.
--
--  El valor NO está escrito de memoria: se capturó antes de aplicar nada, con
--
--    $ psql -d spaces_prod -Atc \
--        "select slug, nombre, razon_social, nombre_comercial from tenants"
--      rgb|RGB Catorce||
--
--  Se acota por el valor NUEVO, no solo por el slug: si alguien renombró la
--  organización después, este rollback no la pisa. Deshacer un cambio no puede
--  llevarse por delante otro que vino después.
-- ============================================================================

begin;

update tenants
   set nombre = 'RGB Catorce'
 where slug = 'rgb'
   and nombre = 'RGB';

-- Esperado: UPDATE 1

commit;
