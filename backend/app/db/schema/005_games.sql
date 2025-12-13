CREATE TABLE IF NOT EXISTS games (
  id BIGSERIAL PRIMARY KEY,
  tg_user_id BIGINT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'bot_rps',
  user_move TEXT,
  bot_move TEXT,
  result TEXT,
  points_delta INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_tg_user_id ON games(tg_user_id);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
