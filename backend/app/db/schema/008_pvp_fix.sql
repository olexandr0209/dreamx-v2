-- 008_pvp_fix.sql
-- SAFE: додає відсутні колонки для сумісності 006/007 + winner_id + score_p1/score_p2
-- і робить м’який backfill (щоб старі матчі не збивались)

-- 0) safety: тригер-функція (якщо вже є — просто перезапише без шкоди)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1) pvp_matches: гарантуємо критичні колонки
ALTER TABLE pvp_matches
  ADD COLUMN IF NOT EXISTS winner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS score_p1 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_p2 INT NOT NULL DEFAULT 0;

-- 2) Гарантуємо, що є "007-колонки" (бо твій pvp.py при їх наявності буде використовувати саме їх)
ALTER TABLE pvp_matches
  ADD COLUMN IF NOT EXISTS round_number INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS step_in_round INT NOT NULL DEFAULT 0;

-- 3) На випадок якщо в базі тільки "006-колонки" (залишаємо їх, але робимо backfill у 007)
ALTER TABLE pvp_matches
  ADD COLUMN IF NOT EXISTS current_round INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_step INT NOT NULL DEFAULT 0;

-- 4) Backfill: якщо раніше жили на current_round/current_step, а round_number/step_in_round були дефолтні
UPDATE pvp_matches
SET round_number = current_round
WHERE current_round IS NOT NULL
  AND (round_number IS NULL OR (round_number = 1 AND current_round <> 1));

UPDATE pvp_matches
SET step_in_round = current_step
WHERE current_step IS NOT NULL
  AND (step_in_round IS NULL OR (step_in_round = 0 AND current_step <> 0));

-- 5) trigger updated_at (пересоздати безпечно)
DROP TRIGGER IF EXISTS trg_pvp_matches_updated_at ON pvp_matches;
CREATE TRIGGER trg_pvp_matches_updated_at
BEFORE UPDATE ON pvp_matches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6) індекси (безпечно)
CREATE INDEX IF NOT EXISTS idx_pvp_matches_status ON pvp_matches(status);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_p1 ON pvp_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_p2 ON pvp_matches(player2_id);

-- =========================
-- pvp_moves: сумісність step / step_in_round
-- =========================

ALTER TABLE pvp_moves
  ADD COLUMN IF NOT EXISTS step_in_round INT NOT NULL DEFAULT 0;

-- якщо є стара колонка step (006), перенесемо в step_in_round, коли step_in_round ще "порожній" (0)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pvp_moves' AND column_name='step'
  ) THEN
    UPDATE pvp_moves
    SET step_in_round = step
    WHERE (step_in_round IS NULL OR step_in_round = 0)
      AND step IS NOT NULL
      AND step <> 0;
  END IF;
END $$;

-- UNIQUE для step_in_round (якщо ще нема)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_pvp_moves_match_round_stepin_player'
  ) THEN
    ALTER TABLE pvp_moves
      ADD CONSTRAINT uq_pvp_moves_match_round_stepin_player
      UNIQUE (match_id, round_number, step_in_round, player_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_moves_match_stepin
  ON pvp_moves(match_id, round_number, step_in_round);
