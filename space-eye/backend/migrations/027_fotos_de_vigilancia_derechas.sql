-- migrations/027_fotos_de_vigilancia_derechas.sql
-- Las fotos de la VIGILANCIA (evidencia de falla, creativo nuevo, prueba de
-- campaña) las entrega el equipo YA giradas con la orientacion del vivo. El
-- servidor les sumaba el giro de fotos del equipo (photo_rotation) al
-- mostrarlas y salian de lado (Magnocentro, 12/10/2026). Desde ahora el
-- servidor no las gira; esto endereza las que ya se guardaron.
-- Solo cambia como se MUESTRAN: el archivo no se toca. Idempotente.
UPDATE photos SET display_rotation = 0
 WHERE source IN ('falla', 'creative_change', 'campana') AND display_rotation <> 0;
