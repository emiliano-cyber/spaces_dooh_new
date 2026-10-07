-- migrations/002_data_usage.sql
-- Consumo de datos por dispositivo (chip Telcel / WiFi). Una fila por dispositivo
-- con el ultimo snapshot reportado (hoy/semana/mes/total, movil y WiFi, en bytes).
-- Aditiva y compatible: los APK viejos no envian estos campos y simplemente no
-- tienen fila aqui; no rompe nada existente.
--
-- NOTA: en produccion las migraciones de docker-entrypoint-initdb.d solo corren
-- en la PRIMERA inicializacion. Para una BD ya existente, aplicar manualmente:
--   docker compose -f infra/docker-compose.ip.yml exec -T mysql \
--     mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < backend/migrations/002_data_usage.sql

CREATE TABLE IF NOT EXISTS device_data_usage (
  device_id     BIGINT UNSIGNED PRIMARY KEY,
  mobile_today  BIGINT UNSIGNED,
  mobile_week   BIGINT UNSIGNED,
  mobile_month  BIGINT UNSIGNED,
  mobile_total  BIGINT UNSIGNED,
  wifi_today    BIGINT UNSIGNED,
  wifi_week     BIGINT UNSIGNED,
  wifi_month    BIGINT UNSIGNED,
  wifi_total    BIGINT UNSIGNED,
  reported_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
