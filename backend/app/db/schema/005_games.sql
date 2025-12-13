-- 005_games.sql
-- Ігри проти бота (RPS). НЕ чіпаємо tournament games таблицю `games`.

CREATE TABLE IF NOT EXISTS bot_games (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  mode TEXT NOT NULL DEFAULT 'bot_rps',
  user_move TEXT,     -- rock | paper | scissors
  bot_move TEXT,      -- rock | paper | scissors
  result TEXT,        -- win | lose | draw

  points_delta INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_games_user_id ON bot_games(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_games_created_at ON bot_games(created_at);
