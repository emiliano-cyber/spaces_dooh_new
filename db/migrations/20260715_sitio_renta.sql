-- Renta directa de la pantalla: lo que la empresa dueña de la cuenta le paga al
-- arrendador (dueño del inmueble) por ese espacio, y cada cuándo. Va junto a
-- sitios.arrendador_id (propietario directo). Independiente del contrato: si
-- están en NULL, el modal/tabla caen al contrato de arrendamiento vigente.
alter table sitios
  add column if not exists renta_arrendador   numeric(14,2);
alter table sitios
  add column if not exists periodicidad_renta text;
