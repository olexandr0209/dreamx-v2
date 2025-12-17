-- 009_admin_settings.sql

-- 1) creators flag in users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_creator BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) app settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- defaults
INSERT INTO app_settings(key, value)
VALUES
  ('giveaways_enabled', 'true'),
  ('giveaway_max_participants', '64')
ON CONFLICT (key) DO NOTHING;
