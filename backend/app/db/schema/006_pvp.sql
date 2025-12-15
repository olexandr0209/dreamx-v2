-- 006_pvp.sql
-- PvP (1 vs 1) matches + moves

CREATE TABLE IF NOT EXISTS pvp_matches (
    id BIGSERIAL PRIMARY KEY,

    status TEXT NOT NULL DEFAULT 'waiting',
    -- waiting | playing | finished | canceled

    player1_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player2_id BIGINT REFERENCES users(id) ON DELETE CASCADE,

    current_round INTEGER NOT NULL DEFAULT 1,
    current_step INTEGER NOT NULL DEFAULT 0, -- 0..2

    winner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_pvp_matches_updated_at ON pvp_matches;
CREATE TRIGGER trg_pvp_matches_updated_at
BEFORE UPDATE ON pvp_matches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS pvp_moves (
    id BIGSERIAL PRIMARY KEY,

    match_id BIGINT NOT NULL REFERENCES pvp_matches(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    step INTEGER NOT NULL, -- 0..2

    player_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    move TEXT NOT NULL, -- rock | paper | scissors

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE (match_id, round_number, step, player_id)
);

CREATE INDEX IF NOT EXISTS idx_pvp_matches_status ON pvp_matches(status);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_players ON pvp_matches(player1_id, player2_id);

CREATE INDEX IF NOT EXISTS idx_pvp_moves_match ON pvp_moves(match_id);
CREATE INDEX IF NOT EXISTS idx_pvp_moves_round_step ON pvp_moves(match_id, round_number, step);
