-- migrations/009_os_version_largo.sql
-- La columna android_version aguantaba 20 caracteres porque solo guardaba "15",
-- "16"... Con el agente de PC llega el sistema operativo completo
-- ("Windows_NT 10.0.26200" = 21) y el INSERT reventaba. Peor: ese error mataba
-- el proceso del backend, asi que un agente reintentando cada 30 s tumbaba el
-- servidor de TODA la flota una y otra vez.
--
-- Se amplia (el campo ya no es solo de Android) y de paso app_version, que con
-- "pc-agent 1.0.0" quedaba al limite.
--
-- Aditiva e idempotente.
ALTER TABLE devices MODIFY COLUMN android_version VARCHAR(64) NULL;
ALTER TABLE devices MODIFY COLUMN app_version VARCHAR(64) NULL;
