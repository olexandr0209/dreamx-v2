-- 007_pvp_tables.sql
-- SAFE migration: працює і якщо таблиці вже існують (додає відсутні колонки)

-- 1) pvp_matches (створити якщо нема)
CREATE TABLE IF NOT EXISTS pvp_matches (
  id BIGSERIAL PRIMARY KEY
);

-- 2) pvp_matches: додати потрібні колонки якщо їх не було
ALTER TABLE pvp_matches
  ADD COLUMN IF NOT EXISTS player1_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS player2_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS round_number INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS step_in_round INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_p1 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_p2 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- 3) trigger updated_at (пересоздати безпечно)
DROP TRIGGER IF EXISTS trg_pvp_matches_updated_at ON pvp_matches;
CREATE TRIGGER trg_pvp_matches_updated_at
BEFORE UPDATE ON pvp_matches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4) indexes (після того як колонки вже гарантовано є)
CREATE INDEX IF NOT EXISTS idx_pvp_matches_status ON pvp_matches(status);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_p1 ON pvp_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_p2 ON pvp_matches(player2_id);


-- =========================
-- pvp_moves
-- =========================

CREATE TABLE IF NOT EXISTS pvp_moves (
  id BIGSERIAL PRIMARY KEY
);

ALTER TABLE pvp_moves
  ADD COLUMN IF NOT EXISTS match_id BIGINT REFERENCES pvp_matches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS round_number INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS step_in_round INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS move TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- move робимо NOT NULL лише якщо колонки вже є і дані не суперечать
-- (обережно: якщо в таблиці вже є рядки з NULL move — це впаде)
-- тому тут НЕ ставимо NOT NULL примусово.

-- Унікальність (обережно: якщо вже є дублікати — впаде)
-- Якщо таблиця нова — ок, якщо стара — краще спочатку перевірити.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_pvp_moves_match_round_step_player'
  ) THEN
    ALTER TABLE pvp_moves
      ADD CONSTRAINT uq_pvp_moves_match_round_step_player
      UNIQUE (match_id, round_number, step_in_round, player_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_moves_match_step
  ON pvp_moves(match_id, round_number, step_in_round);

CREATE INDEX IF NOT EXISTS idx_pvp_moves_player
  ON pvp_moves(player_id);
