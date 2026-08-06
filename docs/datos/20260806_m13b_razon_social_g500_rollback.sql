-- ===========================================================================
--  ROLLBACK de 20260806_m13b_razon_social_g500.sql
--
--  Devuelve la razon social de g500 al valor que tenia antes del cambio.
--
--  Este rollback es EXACTO y no una reconstruccion de memoria: el script solo
--  recorta el prefijo «DEMO » de un valor que su propio guard exige encontrar
--  antes de tocar nada, asi que si el script corrio, esto es literalmente lo
--  que habia. Aun asi, contrastar con la salida del PASO 0 antes de usarlo.
-- ===========================================================================

begin;

update tenants
   set razon_social = 'DEMO RGB CATORCE S DE RL DE CV'
 where id = '4cdba4aa-444d-4238-a983-959d18b1a2bf';

commit;

-- Nota: volver atras NO rompe nada del codigo. `razon_social` es un texto que
-- se imprime (Administracion → Configuracion y la parte arrendataria del
-- contrato); ninguna ruta lo valida ni lo usa como llave. El unico efecto de
-- revertir es que el contrato vuelve a salir a firma con «DEMO» en el nombre
-- de la empresa que se obliga.
