-- ============================================================================
--  Corrige el acento de dos etiquetas de `catalogo_roles_entidad`.
--  (D8 de docs/Supervision/ABIERTOS.md, autorizada por el dueño)
--
--  ── Que corrige ─────────────────────────────────────────────────────────────
--  `20260917_entidades_fiscales.sql:78-80` sembró las cinco etiquetas del
--  catálogo y dos quedaron sin acento por descuido: 'LICENCIAS' y 'OPERACION'.
--  Se vio el 2026-09-18 recorriendo el guion del Summit en el navegador — el
--  contraste con la prosa vecina, que sí lleva acentos, es lo que lo hizo
--  visible. No lo detectó ninguna prueba: es un dato, no código.
--
--  ── Por que una migración nueva y no se edita la del 17/09 ─────────────────
--  `20260917_entidades_fiscales.sql` ya está APLICADA. Editar una migración
--  aplicada le cambia el `sha256` y toda base que ya la tenga registrada
--  abortaría con salida 3 — ver [[06-Operacion/zonas-de-riesgo]]. Se corrige
--  con un `update`, como manda la convención del repositorio.
--
--  ── Las otras tres etiquetas ────────────────────────────────────────────────
--  'ARRENDAMIENTOS', 'ACTIVOS' y 'VENTAS' ya estaban bien y no se tocan.
--
--  Transaccional e idempotente: el `where` compara también la etiqueta VIEJA,
--  así que una segunda corrida no encuentra filas que actualizar y no falla.
-- ============================================================================
begin;

update catalogo_roles_entidad
   set etiqueta = 'Trámites y licencias con gobierno'
 where rol = 'LICENCIAS'
   and etiqueta = 'Tramites y licencias con gobierno';

update catalogo_roles_entidad
   set etiqueta = 'Operación y nómina'
 where rol = 'OPERACION'
   and etiqueta = 'Operacion y nomina';

-- Comprobación: las dos etiquetas quedaron como deben, y ninguna otra se movió.
do $$
declare
  etiqueta_licencias  text;
  etiqueta_operacion  text;
  total_filas         integer;
begin
  select etiqueta into etiqueta_licencias
    from catalogo_roles_entidad where rol = 'LICENCIAS';
  select etiqueta into etiqueta_operacion
    from catalogo_roles_entidad where rol = 'OPERACION';
  select count(*) into total_filas from catalogo_roles_entidad;

  if etiqueta_licencias is distinct from 'Trámites y licencias con gobierno' then
    raise exception 'LICENCIAS quedo con etiqueta inesperada: %', etiqueta_licencias;
  end if;
  if etiqueta_operacion is distinct from 'Operación y nómina' then
    raise exception 'OPERACION quedo con etiqueta inesperada: %', etiqueta_operacion;
  end if;
  if total_filas <> 5 then
    raise exception 'catalogo_roles_entidad deberia tener 5 filas y tiene %', total_filas;
  end if;

  raise notice 'catalogo_roles_entidad: LICENCIAS y OPERACION con acento, % filas en total.', total_filas;
end $$;

commit;

-- ── Vuelta atras, si hiciera falta ──────────────────────────────────────────
--   update catalogo_roles_entidad set etiqueta = 'Tramites y licencias con gobierno' where rol = 'LICENCIAS';
--   update catalogo_roles_entidad set etiqueta = 'Operacion y nomina' where rol = 'OPERACION';
