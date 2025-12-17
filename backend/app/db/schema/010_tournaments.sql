-- 010_tournaments.sql (SAFE)

-- 1) create base table if missing
CREATE TABLE IF NOT EXISTS tournaments (
  id BIGSERIAL PRIMARY KEY
);

-- 2) add columns if missing (safe for already existing table)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS created_by_tg BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT NULL,
  ADD COLUMN IF NOT EXISTS prize TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS join_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS start_mode TEXT NOT NULL DEFAULT 'delay',
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS start_delay_sec INT NULL,
  ADD COLUMN IF NOT EXISTS max_participants INT NOT NULL DEFAULT 64,
  ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3) indexes (now column exists)
CREATE INDEX IF NOT EXISTS idx_tournaments_creator ON tournaments(created_by_tg);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

-- 4) players table
CREATE TABLE IF NOT EXISTS tournament_players (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  tg_user_id BIGINT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, tg_user_id)
);
