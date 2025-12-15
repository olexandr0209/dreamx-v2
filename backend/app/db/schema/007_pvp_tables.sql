-- 007_pvp_tables.sql

CREATE TABLE IF NOT EXISTS pvp_matches (
  id BIGSERIAL PRIMARY KEY,

  player1_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player2_id BIGINT REFERENCES users(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'waiting', -- waiting | playing | finished | canceled

  round_number INT NOT NULL DEFAULT 1,
  step_in_round INT NOT NULL DEFAULT 0, -- 0..2 (3 кроки)

  score_p1 INT NOT NULL DEFAULT 0,
  score_p2 INT NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_pvp_matches_updated_at ON pvp_matches;
CREATE TRIGGER trg_pvp_matches_updated_at
BEFORE UPDATE ON pvp_matches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pvp_matches_status ON pvp_matches(status);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_p1 ON pvp_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_p2 ON pvp_matches(player2_id);


CREATE TABLE IF NOT EXISTS pvp_moves (
  id BIGSERIAL PRIMARY KEY,

  match_id BIGINT NOT NULL REFERENCES pvp_matches(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  step_in_round INT NOT NULL, -- 0..2

  player_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  move TEXT NOT NULL, -- rock | paper | scissors

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (match_id, round_number, step_in_round, player_id)
);

CREATE INDEX IF NOT EXISTS idx_pvp_moves_match_step ON pvp_moves(match_id, round_number, step_in_round);
CREATE INDEX IF NOT EXISTS idx_pvp_moves_player ON pvp_moves(player_id);
