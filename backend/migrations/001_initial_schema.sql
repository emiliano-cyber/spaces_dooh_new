-- migrations/001_initial_schema.sql
-- SPACE EYE — schema inicial

SET FOREIGN_KEY_CHECKS = 0;

-- USERS Y AUTH
CREATE TABLE IF NOT EXISTS roles (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(50) NOT NULL UNIQUE,
  permissions     JSON NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (name, permissions) VALUES
  ('admin', JSON_ARRAY('*')),
  ('operator', JSON_ARRAY('device.read','device.command','photo.read','schedule.write')),
  ('viewer', JSON_ARRAY('device.read','photo.read'));

CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  role_id         INT UNSIGNED NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_users_email (email),
  INDEX idx_users_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  token_hash      VARCHAR(255) NOT NULL,
  expires_at      TIMESTAMP NOT NULL,
  revoked         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id, revoked),
  INDEX idx_refresh_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- DEVICES
CREATE TABLE IF NOT EXISTS device_groups (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS devices (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  device_uid      VARCHAR(64) NOT NULL UNIQUE COMMENT 'UUID generado por la app',
  name            VARCHAR(150) NOT NULL,
  billboard_code  VARCHAR(50) COMMENT 'Codigo interno del espectacular',
  group_id        INT UNSIGNED NULL,

  auth_token_hash VARCHAR(255) NOT NULL,
  token_issued_at TIMESTAMP NULL,

  address         TEXT,
  city            VARCHAR(100),
  state           VARCHAR(100),
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7),

  android_version VARCHAR(20),
  app_version     VARCHAR(20),
  model           VARCHAR(100),
  manufacturer    VARCHAR(100),

  status          ENUM('active','inactive','maintenance','provisioning') DEFAULT 'provisioning',
  online          BOOLEAN DEFAULT FALSE,
  last_seen_at    TIMESTAMP NULL,

  stream_quality  ENUM('low','medium','high') DEFAULT 'medium',
  capture_quality ENUM('low','medium','high') DEFAULT 'high',

  registered_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE SET NULL,
  INDEX idx_devices_status (status, online),
  INDEX idx_devices_last_seen (last_seen_at),
  INDEX idx_devices_group (group_id),
  INDEX idx_devices_location (lat, lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TELEMETRIA — alta volumetria, particionada por fecha
CREATE TABLE IF NOT EXISTS device_status (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id       BIGINT UNSIGNED NOT NULL,

  battery_pct     TINYINT UNSIGNED,
  battery_temp    DECIMAL(4,1),
  battery_charging BOOLEAN,

  signal_dbm      SMALLINT,
  network_type    VARCHAR(20),
  network_operator VARCHAR(50),

  gps_lat         DECIMAL(10,7),
  gps_lng         DECIMAL(10,7),
  gps_accuracy_m  DECIMAL(6,1),

  storage_free_mb INT UNSIGNED,
  ram_free_mb     INT UNSIGNED,
  cpu_temp        DECIMAL(4,1),
  uptime_seconds  INT UNSIGNED,

  reported_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id, reported_at),
  INDEX idx_status_device_time (device_id, reported_at DESC),
  INDEX idx_status_time (reported_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  PARTITION BY RANGE (UNIX_TIMESTAMP(reported_at)) (
    PARTITION p_2026_01 VALUES LESS THAN (UNIX_TIMESTAMP('2026-02-01')),
    PARTITION p_2026_02 VALUES LESS THAN (UNIX_TIMESTAMP('2026-03-01')),
    PARTITION p_2026_03 VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-01')),
    PARTITION p_2026_04 VALUES LESS THAN (UNIX_TIMESTAMP('2026-05-01')),
    PARTITION p_2026_05 VALUES LESS THAN (UNIX_TIMESTAMP('2026-06-01')),
    PARTITION p_2026_06 VALUES LESS THAN (UNIX_TIMESTAMP('2026-07-01')),
    PARTITION p_2026_07 VALUES LESS THAN (UNIX_TIMESTAMP('2026-08-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
  );

-- COMMANDS
CREATE TABLE IF NOT EXISTS commands (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  device_id       BIGINT UNSIGNED NOT NULL,
  command_type    ENUM(
    'TAKE_PHOTO',
    'START_STREAM',
    'STOP_STREAM',
    'UPDATE_CONFIG',
    'REBOOT_APP',
    'SYNC_SCHEDULE',
    'CHANGE_QUALITY'
  ) NOT NULL,
  payload         JSON,

  status          ENUM('pending','sent','executing','done','failed','expired') DEFAULT 'pending',
  priority        TINYINT DEFAULT 5 COMMENT '1=highest, 9=lowest',

  created_by      BIGINT UNSIGNED NULL,
  schedule_id     BIGINT UNSIGNED NULL,

  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at         TIMESTAMP NULL,
  executed_at     TIMESTAMP NULL,
  expires_at      TIMESTAMP NULL,

  result          JSON,
  error_message   TEXT,

  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_commands_device_status (device_id, status, priority, created_at),
  INDEX idx_commands_status (status, created_at),
  INDEX idx_commands_schedule (schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CAMPAIGNS & PHOTOS
CREATE TABLE IF NOT EXISTS campaigns (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(200) NOT NULL,
  advertiser      VARCHAR(200),
  creative_path   VARCHAR(500),
  expected_text   TEXT,
  verification_enabled BOOLEAN DEFAULT FALSE,
  min_ssim_score  DECIMAL(4,3) DEFAULT 0.700,
  max_phash_distance INT DEFAULT 10,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  active          BOOLEAN DEFAULT TRUE,
  created_by      BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_campaigns_dates (start_date, end_date, active),
  INDEX idx_campaigns_advertiser (advertiser)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS campaign_devices (
  campaign_id     BIGINT UNSIGNED NOT NULL,
  device_id       BIGINT UNSIGNED NOT NULL,
  assigned_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (campaign_id, device_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS photos (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  device_id       BIGINT UNSIGNED NOT NULL,
  campaign_id     BIGINT UNSIGNED NULL,
  command_id      BIGINT UNSIGNED NULL,
  schedule_id     BIGINT UNSIGNED NULL,
  storage_path    VARCHAR(500) NOT NULL,
  thumbnail_path  VARCHAR(500),
  file_size_bytes INT UNSIGNED,
  width           SMALLINT UNSIGNED,
  height          SMALLINT UNSIGNED,
  taken_at        TIMESTAMP NOT NULL,
  uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  gps_lat         DECIMAL(10,7),
  gps_lng         DECIMAL(10,7),
  source          ENUM('manual','scheduled','on_demand','boot') DEFAULT 'manual',
  verification_status ENUM('pending','queued','running','verified','failed','skipped') DEFAULT 'pending',
  is_correct      BOOLEAN NULL,
  verification_score DECIMAL(5,4) NULL,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (command_id) REFERENCES commands(id) ON DELETE SET NULL,
  INDEX idx_photos_device_time (device_id, taken_at DESC),
  INDEX idx_photos_campaign (campaign_id, taken_at DESC),
  INDEX idx_photos_verification (verification_status, taken_at),
  INDEX idx_photos_correct (is_correct, taken_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SCHEDULES & VERIFICATIONS
CREATE TABLE IF NOT EXISTS schedules (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(150) NOT NULL,
  description     TEXT,
  device_id       BIGINT UNSIGNED NULL,
  group_id        INT UNSIGNED NULL,
  campaign_id     BIGINT UNSIGNED NULL,
  action          ENUM('TAKE_PHOTO') NOT NULL DEFAULT 'TAKE_PHOTO',
  frequency_type  ENUM('interval','cron','specific_times') NOT NULL,
  interval_minutes INT UNSIGNED NULL,
  cron_expression VARCHAR(100) NULL,
  specific_times  JSON NULL,
  timezone        VARCHAR(50) DEFAULT 'America/Mexico_City',
  active          BOOLEAN DEFAULT TRUE,
  valid_from      DATE NULL,
  valid_until     DATE NULL,
  last_fired_at   TIMESTAMP NULL,
  next_fire_at    TIMESTAMP NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_schedules_next_fire (active, next_fire_at),
  INDEX idx_schedules_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS verifications (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  photo_id        BIGINT UNSIGNED NOT NULL UNIQUE,
  campaign_id     BIGINT UNSIGNED NOT NULL,
  ssim_score      DECIMAL(5,4),
  phash_distance  TINYINT,
  histogram_score DECIMAL(5,4),
  ocr_text        TEXT,
  ocr_match       BOOLEAN,
  ocr_confidence  DECIMAL(4,3),
  is_correct      BOOLEAN NOT NULL,
  confidence      DECIMAL(4,3) NOT NULL,
  reason          VARCHAR(500),
  aligned_path    VARCHAR(500),
  diff_path       VARCHAR(500),
  evidence_pdf    VARCHAR(500),
  processed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_ms   INT UNSIGNED,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  INDEX idx_verifications_campaign (campaign_id, processed_at),
  INDEX idx_verifications_correct (is_correct, processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS device_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id       BIGINT UNSIGNED NOT NULL,
  level           ENUM('debug','info','warning','error','critical') NOT NULL,
  category        VARCHAR(50),
  message         TEXT NOT NULL,
  metadata        JSON,
  logged_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, logged_at),
  INDEX idx_logs_device_time (device_id, logged_at DESC),
  INDEX idx_logs_level (level, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  PARTITION BY RANGE (UNIX_TIMESTAMP(logged_at)) (
    PARTITION p_2026_01 VALUES LESS THAN (UNIX_TIMESTAMP('2026-02-01')),
    PARTITION p_2026_02 VALUES LESS THAN (UNIX_TIMESTAMP('2026-03-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
  );

CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED,
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50),
  resource_id     VARCHAR(100),
  metadata        JSON,
  ip_address      VARCHAR(45),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_user_time (user_id, created_at DESC),
  INDEX idx_audit_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
