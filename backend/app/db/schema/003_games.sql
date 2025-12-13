-- 003_games.sql
-- Одна гра RPS (камінь-ножиці-папір) як матч в турнірі

CREATE TABLE IF NOT EXISTS games (
    id BIGSERIAL PRIMARY KEY,

    tournament_id BIGINT REFERENCES tournaments(id) ON DELETE SET NULL,
    round_number INTEGER NOT NULL DEFAULT 1,

    player1_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player2_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    player1_move TEXT,  -- rock | paper | scissors
    player2_move TEXT,  -- rock | paper | scissors

    winner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'created', -- created | playing | finished

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_games_updated_at ON games;
CREATE TRIGGER trg_games_updated_at
BEFORE UPDATE ON games
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_id);
CREATE INDEX IF NOT EXISTS idx_games_players ON games(player1_id, player2_id);
