-- Rollback de 20260804_a9_limpieza_datos_prueba_g500.sql — devuelve las 13
-- filas a su valor EXACTO previo al 2026-08-04. Generado leyendo la base antes
-- de aplicar, no escrito a mano.
--
-- Uso: envolver en begin/commit y precederlo, en el MISMO archivo, de
--   select set_config('app.tenant_id','4cdba4aa-444d-4238-a983-959d18b1a2bf',false);
-- porque `spaces_user` tiene RLS fail-closed y sin ese GUC no ve ninguna fila
-- (los UPDATE no fallarían: afectarían 0 filas en silencio).

update clientes set nombre='TEST_Cliente Ficticio SA', razon_social='TEST_Cliente Ficticio S de RL de CV' where id='88a877bd-13e5-4fb9-a805-c5b3d4b2ac9d';
update campanas set nombre='TEST_Propuesta Auditoria', fecha_inicio='2026-08-01', fecha_fin='2026-08-31' where id='5f4c8a49-b63e-4c17-933f-004bca9e5394';
update campanas set nombre='TEST_EdgeCase Fechas', fecha_inicio='2026-08-31', fecha_fin='2026-08-01' where id='a7f5ebe5-7a68-44be-ad7b-cf832527b52b';
update propuestas set nombre='TEST_Propuesta Auditoria' where id='e24578f0-17de-4371-89a0-02f5caa67c51';
update propuestas set nombre='TEST_EdgeCase Fechas' where id='b9c15e6b-1772-41df-80ed-c6bbf88895e7';
update reservas set fecha_inicio='2026-08-31', fecha_fin='2026-08-01' where id='f4d4710c-3bc5-467e-99b1-004814b78f6a';
update reservas set fecha_inicio='2026-08-31', fecha_fin='2026-08-01' where id='46571cc7-f6f0-4ec1-8781-97258c01415b';
update propuesta_items set fecha_inicio='2026-08-31', fecha_fin='2026-08-01' where id='4ce3f364-f831-4fb7-adaf-3f95cc1040a4';
update propuesta_items set fecha_inicio='2026-08-31', fecha_fin='2026-08-01' where id='889100cf-806c-4541-b3c5-1c3e831b0311';
update creatividades set nombre='TEST_creativo.png' where id='f4cce8ad-139d-494e-a4e1-fb45d9de513b';
update creatividades set nombre='WhatsApp Image 2026-07-13 at 17.06.24.jpeg' where id='615f91cb-8e83-44f6-9e00-590cd6f020e8';
update creatividades set nombre='WhatsApp Image 2026-07-13 at 17.06.24.jpeg' where id='bca3022e-90ff-408f-beba-e123628e4a37';
