-- ============================================================================
--  El nombre de la organización del PADRE: «RGB Catorce» → «RGB»
-- ----------------------------------------------------------------------------
--  Pedido por Emiliano el 2026-08-25: la página del PADRE encabeza con «RGB
--  CATORCE» y debe decir solo «RGB». En pantalla sale en mayúsculas por estilo;
--  en la base el valor es `RGB Catorce`.
--
--  ─── Por qué esto NO es una migración ─────────────────────────────────────
--
--  Toca UNA fila de UN tenant concreto de `spaces_prod`. Aplicarlo en otro
--  entorno no haría nada útil: `db/schema.sql:598-600` dejó de sembrar ningún
--  tenant a propósito, así que una instancia nueva no tiene `rgb` que renombrar.
--
--  ─── Estado previo, capturado ANTES (no escrito de memoria) ───────────────
--
--    $ psql -d spaces_prod -Atc \
--        "select slug, nombre, razon_social, nombre_comercial from tenants"
--      rgb|RGB Catorce||
--
--  Los dos últimos campos salen VACÍOS, y eso importa: significa que **no hay
--  razón social ni nombre comercial** guardados. Si `razon_social` tuviera
--  valor, este cambio tocaría un dato FISCAL —el que sale en las facturas— y no
--  sería un retoque de presentación. No es el caso: solo se cambia el rótulo.
--
--  ─── Alcance ──────────────────────────────────────────────────────────────
--
--  Una fila. Se acota por `slug = 'rgb'` **y** por el valor previo exacto: si
--  alguien ya lo cambió, este script no toca nada en vez de pisar su cambio.
--
--  Antes de aplicar, pasada en seco: cambiar `commit` por `rollback` al final y
--  comprobar que dice `UPDATE 1`.
-- ============================================================================

begin;

update tenants
   set nombre = 'RGB'
 where slug = 'rgb'
   and nombre = 'RGB Catorce';

-- Esperado: UPDATE 1
--
-- UPDATE 0 significa que el nombre ya no era `RGB Catorce`. NO fuerces el
-- cambio quitando la segunda condición: mira antes qué hay, porque alguien lo
-- habrá tocado y este script se escribió contra otro estado.

commit;
