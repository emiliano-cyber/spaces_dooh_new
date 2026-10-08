-- migrations/024_campanas_de_spaceos.sql
-- Las campanas que se venden en SPACE OS llegan solas a Space Eye (oct-2026).
--
--   campaigns.origen / origen_id: de donde viene la campana. SPACE OS manda su
--     lista completa cada pocos minutos; con esta llave la misma campana se
--     actualiza en vez de duplicarse, y la que ya no viene se apaga. Las que se
--     capturan a mano en el dashboard quedan con origen NULL y no se tocan.
--   campaigns.origen_sha: huella del arte en SPACE OS, para volver a subirlo
--     solo cuando cambia.
--   campaigns.creative_sha: huella de la referencia guardada aqui. El equipo la
--     baja una vez y la vuelve a pedir solo si cambia.
--   photos.source 'campana': la foto que toma el equipo cuando reconoce en su
--     pantalla el arte de una campana (una por campana al dia, como prueba).
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS campanas_de_spaceos;
DELIMITER $$
CREATE PROCEDURE campanas_de_spaceos()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='campaigns' AND column_name='origen') THEN
    ALTER TABLE campaigns
      ADD COLUMN origen VARCHAR(60) NULL,
      ADD COLUMN origen_id VARCHAR(160) NULL,
      ADD COLUMN origen_sha CHAR(64) NULL,
      ADD UNIQUE KEY uq_campaigns_origen (origen, origen_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='campaigns' AND column_name='creative_sha') THEN
    ALTER TABLE campaigns ADD COLUMN creative_sha CHAR(64) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='photos'
                   AND column_name='source' AND COLUMN_TYPE LIKE '%campana%') THEN
    ALTER TABLE photos MODIFY COLUMN source
      ENUM('manual','scheduled','on_demand','boot','creative_change','falla','campana') DEFAULT 'manual',
      -- Igual que en 018: agregar al final es instantaneo; si no se puede, que
      -- falle en vez de copiar la tabla de fotos bloqueando a la flota.
      ALGORITHM=INSTANT;
  END IF;
END$$
DELIMITER ;
CALL campanas_de_spaceos();
DROP PROCEDURE IF EXISTS campanas_de_spaceos;
