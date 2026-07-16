-- Propietario/arrendador directo de la pantalla (independiente del contrato).
-- Permite asignar el dueño del inmueble desde el inventario sin crear un contrato.
-- El propietario mostrado en el inventario usa esta columna con prioridad; si es
-- NULL, cae al arrendador del contrato vigente (comportamiento previo).
alter table sitios
  add column if not exists arrendador_id uuid references arrendadores(id) on delete set null;
