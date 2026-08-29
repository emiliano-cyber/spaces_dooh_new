-- ========================================================================
--  VUELTA ATRÁS de `20260828_reautenticacion_encendida.sql`
-- ------------------------------------------------------------------------
--  Devuelve el candado a `false` en las organizaciones que lo tenían así
--  ANTES de aplicar.
--
--  ── ⚠️ ESTE ARCHIVO HAY QUE COMPLETARLO ANTES DE APLICAR NADA ──────────
--  El README de este directorio lo pide con todas las letras: «el rollback se
--  captura ANTES de aplicar, leyendo los valores previos reales — no se
--  escribe de memoria».
--
--  Aquí no se puede escribir por adelantado, y por eso queda con un hueco en
--  vez de con una lista inventada: **nadie ha leído todavía qué organizaciones
--  hay ni cuáles tienen el candado abierto**. Rellenarlo «con las cinco de
--  siempre» sería exactamente el tipo de suposición que el README prohíbe.
--
--  PASO 1 — capturar, en la misma sesión, ANTES del update:
--
--      select slug, exigir_reautenticacion from tenants order by slug;
--
--  PASO 2 — copiar aquí abajo los slugs que salieron en `f` (falso). Esos son
--  los únicos que hay que devolver: los que ya estaban en `t` no los tocó el
--  update y devolverlos sería un cambio nuevo, no una vuelta atrás.
--
--  Si el paso 1 devuelve que TODAS estaban en `f`, la lista es todas.
-- ========================================================================
begin;

-- ⬇️ SUSTITUIR por los slugs capturados en el PASO 1. Se deja fallando a
--    propósito: un rollback que corre sin haberse completado no devuelve nada
--    y hace creer que sí.
update tenants
   set exigir_reautenticacion = false
 where slug in ('PEGAR_AQUI_LOS_SLUGS_QUE_ESTABAN_EN_FALSO');

select slug, exigir_reautenticacion from tenants order by slug;

commit;
