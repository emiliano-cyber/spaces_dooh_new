-- ===========================================================================
--  A9 (auditoria QA 04/08/2026) — quitar los rastros de prueba visibles en la
--  demo del tenant G500, y de paso corregir la campana con fechas invertidas
--  que sostenia el importe negativo de C2.
--
--  Todo va por ID EXPLICITO: nada de WHERE nombre LIKE 'TEST%', que manana
--  podria alcanzar un registro nuevo del usuario. El estado previo esta
--  capturado en ~/a9/ROLLBACK.sql.
-- ===========================================================================
begin;
select set_config('app.tenant_id', '4cdba4aa-444d-4238-a983-959d18b1a2bf', false);

-- 1. Cliente unico de G500: de el cuelgan las 7 campanas.
update clientes set
  nombre       = 'Cliente Ficticio SA',
  razon_social = 'Cliente Ficticio S de RL de CV'
where id = '88a877bd-13e5-4fb9-a805-c5b3d4b2ac9d';

-- 2. Prefijo TEST_ fuera de campanas y propuestas (mismo nombre en espejo).
update campanas   set nombre = 'EdgeCase Fechas'      where id = 'a7f5ebe5-7a68-44be-ad7b-cf832527b52b';
update campanas   set nombre = 'Propuesta Auditoria'  where id = '5f4c8a49-b63e-4c17-933f-004bca9e5394';
update propuestas set nombre = 'EdgeCase Fechas'      where id = 'b9c15e6b-1772-41df-80ed-c6bbf88895e7';
update propuestas set nombre = 'Propuesta Auditoria'  where id = 'e24578f0-17de-4371-89a0-02f5caa67c51';

-- 3. Fechas invertidas (31/08 -> 01/08). El importe de campana es DERIVADO:
--    sum(precio * (fecha_fin - fecha_inicio + 1) / 30). Con el rango al reves
--    el factor de dias sale negativo (-29/30) y de ahi el monto en rojo. Se
--    voltean los tres sitios donde vive el rango, no solo la cabecera.
update campanas        set fecha_inicio = '2026-08-01', fecha_fin = '2026-08-31' where id = 'a7f5ebe5-7a68-44be-ad7b-cf832527b52b';
update reservas        set fecha_inicio = '2026-08-01', fecha_fin = '2026-08-31' where id in ('f4d4710c-3bc5-467e-99b1-004814b78f6a','46571cc7-f6f0-4ec1-8781-97258c01415b');
update propuesta_items set fecha_inicio = '2026-08-01', fecha_fin = '2026-08-31' where id in ('4ce3f364-f831-4fb7-adaf-3f95cc1040a4','889100cf-806c-4541-b3c5-1c3e831b0311');

-- 4. Nombres de archivo de creativos. Solo el rotulo (`nombre`); `archivo_url`
--    no se toca, asi que la imagen sigue siendo la misma.
update creatividades set nombre = 'creativo.png'                where id = 'f4cce8ad-139d-494e-a4e1-fb45d9de513b';
update creatividades set nombre = 'creativo-mastercard.jpg'     where id = '615f91cb-8e83-44f6-9e00-590cd6f020e8';
update creatividades set nombre = 'creativo-prueba-anual.jpg'   where id = 'bca3022e-90ff-408f-beba-e123628e4a37';

commit;
