-- migrations/006_network_diag.sql
-- Diagnostico de red por dispositivo.
--
-- 1) device_status.source_ip: la IP publica desde la que el equipo habla con el
--    backend. OJO: si el operador usa traduccion (464XLAT/NAT64), aqui siempre
--    se vera una IPv4 aunque el equipo este en una red IPv6 pura. Sirve para ver
--    cambios de red/operador en el tiempo, no para detectar IPv6-only.
--
-- 2) devices.last_ice_*: resumen de los candidatos ICE del ultimo intento de
--    transmision. Esto SI detecta el caso que dejo ciego a Interlomas: un equipo
--    en red IPv6 pura no genera ningun candidato IPv4 (ni srflx ni relay) y la
--    vista en vivo nunca puede conectar, aunque fotos y telemetria funcionen.
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS add_network_diag;
DELIMITER $$
CREATE PROCEDURE add_network_diag()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='device_status' AND column_name='source_ip') THEN
    ALTER TABLE device_status ADD COLUMN source_ip VARCHAR(45) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='last_ice_at') THEN
    ALTER TABLE devices ADD COLUMN last_ice_at TIMESTAMP NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='last_ice_summary') THEN
    -- { ipv4: {host,srflx,relay}, ipv6: {host,srflx,relay}, total, verdict }
    ALTER TABLE devices ADD COLUMN last_ice_summary JSON NULL;
  END IF;
END$$
DELIMITER ;
CALL add_network_diag();
DROP PROCEDURE IF EXISTS add_network_diag;
