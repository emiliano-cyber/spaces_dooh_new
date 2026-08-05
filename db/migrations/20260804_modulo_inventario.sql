-- ============================================================================
-- ADR 0010 · El catálogo de pantallas deja de ir bajo `comercial`.
--
-- `comercial.crear` concedía a la vez armar propuestas, crear clientes, generar
-- campañas Y editar el catálogo de inventario (app/api/sitios). Vender no
-- debería implicar poder reestructurar el activo que se vende: es la única
-- separación de funciones del conjunto con justificación real, así que se parte
-- `inventario` como módulo propio.
--
-- Reparto de permisos, pensado para que NADIE pierda lectura:
--   · DUENO      → ver, crear, aprobar   (como tenía en comercial)
--   · COMERCIAL  → ver                   (pierde SOLO la escritura del catálogo)
--   · OPERACIONES→ ver                   (ya veía el inventario vía comercial.ver)
--
-- La renta al arrendador NO entra aquí: sigue bajo `arrendadores.crear`, que es
-- donde ya estaba a propósito (dinero que sale hacia el propietario).
--
-- Aditivo e idempotente: solo inserta filas en rol_permisos.
-- ============================================================================
begin;

insert into rol_permisos (rol, modulo, accion)
values
  ('DUENO',       'inventario', 'ver'),
  ('DUENO',       'inventario', 'crear'),
  ('DUENO',       'inventario', 'aprobar'),
  ('COMERCIAL',   'inventario', 'ver'),
  ('OPERACIONES', 'inventario', 'ver')
on conflict (rol, modulo, accion) do nothing;

commit;

-- Verificación: se esperan 5 filas, y COMERCIAL sin 'crear'.
select 'filas de inventario' k, count(*)::text v from rol_permisos where modulo = 'inventario'
union all
select 'COMERCIAL puede escribir el catalogo (debe ser 0)', count(*)::text
  from rol_permisos where modulo = 'inventario' and rol = 'COMERCIAL' and accion = 'crear'
union all
select 'DUENO puede escribir el catalogo (debe ser 1)', count(*)::text
  from rol_permisos where modulo = 'inventario' and rol = 'DUENO' and accion = 'crear';
