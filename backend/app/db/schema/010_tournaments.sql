-- 010_tournaments.sql

CREATE TABLE IF NOT EXISTS tournaments (
  id BIGSERIAL PRIMARY KEY,
  created_by_tg BIGINT NOT NULL,

  title TEXT NOT NULL,
  description TEXT NULL,
  prize TEXT NOT NULL,

  access_type TEXT NOT NULL DEFAULT 'public', -- public/private
  join_code TEXT NULL,

  start_mode TEXT NOT NULL, -- datetime/delay
  start_at TIMESTAMPTZ NULL, -- зберігаємо в UTC
  start_delay_sec INT NULL,  -- якщо delay

  max_participants INT NOT NULL DEFAULT 64,   -- snapshot з app_settings
  chat_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- snapshot з app_settings

  status TEXT NOT NULL DEFAULT 'draft', -- draft/open/running/finished

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_creator
  ON tournaments(created_by_tg);

CREATE INDEX IF NOT EXISTS idx_tournaments_status
  ON tournaments(status);

-- (опційно на майбутнє) таблиця учасників
CREATE TABLE IF NOT EXISTS tournament_players (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  tg_user_id BIGINT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, tg_user_id)
);
