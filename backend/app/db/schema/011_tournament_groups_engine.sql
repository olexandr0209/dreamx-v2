-- 011_tournament_groups_engine.sql (SAFE)
-- Додає таблиці для групового турніру (stage -> groups -> round-robin matches -> games)

-- 1) stages
CREATE TABLE IF NOT EXISTS tournament_stages (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  stage_no INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/running/finished
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  UNIQUE (tournament_id, stage_no)
);

CREATE INDEX IF NOT EXISTS idx_tournament_stages_tournament
  ON tournament_stages(tournament_id);

-- 2) stage players (учасники конкретного етапу)
CREATE TABLE IF NOT EXISTS tournament_stage_players (
  id BIGSERIAL PRIMARY KEY,
  stage_id BIGINT NOT NULL REFERENCES tournament_stages(id) ON DELETE CASCADE,
  tg_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stage_id, tg_user_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_players_stage
  ON tournament_stage_players(stage_id);

-- 3) groups
CREATE TABLE IF NOT EXISTS tournament_groups (
  id BIGSERIAL PRIMARY KEY,
  stage_id BIGINT NOT NULL REFERENCES tournament_stages(id) ON DELETE CASCADE,
  group_no INT NOT NULL,
  group_size INT NOT NULL,              -- 3/4/5/6
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting/running/finished/tiebreak
  current_round INT NOT NULL DEFAULT 1, -- "тур" всередині групи
  total_rounds INT NOT NULL DEFAULT 1,  -- 3 для 4 людей, 5 для 5/6, 3 для 3 (ми виставимо логікою)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stage_id, group_no)
);

CREATE INDEX IF NOT EXISTS idx_groups_stage
  ON tournament_groups(stage_id);

-- 4) group members + stats
CREATE TABLE IF NOT EXISTS tournament_group_members (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES tournament_groups(id) ON DELETE CASCADE,
  tg_user_id BIGINT NOT NULL,
  seat INT NOT NULL,                    -- 1..6 (для красивої таблиці зверху)
  points INT NOT NULL DEFAULT 0,
  matches_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  rank INT NULL,                        -- підсумкове місце в групі
  advanced BOOLEAN NOT NULL DEFAULT FALSE,
  eliminated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, tg_user_id),
  UNIQUE(group_id, seat)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group
  ON tournament_group_members(group_id);

-- 5) matches inside group (one match = series of 9 games)
CREATE TABLE IF NOT EXISTS tournament_group_matches (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES tournament_groups(id) ON DELETE CASCADE,
  match_kind TEXT NOT NULL DEFAULT 'group', -- group/tiebreak
  tiebreak_no INT NOT NULL DEFAULT 0,       -- 0 для звичайного, 1..N для тай-брейків
  round_no INT NOT NULL DEFAULT 1,          -- "тур" (хто грає паралельно)
  p1_tg_user_id BIGINT NOT NULL,
  p2_tg_user_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',   -- waiting/active/finished
  series_games_total INT NOT NULL DEFAULT 9,
  games_played INT NOT NULL DEFAULT 0,
  p1_series_points INT NOT NULL DEFAULT 0,
  p2_series_points INT NOT NULL DEFAULT 0,
  winner_tg_user_id BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- один матч на пару (але дозволяємо повтори для tiebreak через tiebreak_no)
CREATE UNIQUE INDEX IF NOT EXISTS ux_group_match_pair
  ON tournament_group_matches(
    group_id,
    match_kind,
    tiebreak_no,
    LEAST(p1_tg_user_id, p2_tg_user_id),
    GREATEST(p1_tg_user_id, p2_tg_user_id)
  );

CREATE INDEX IF NOT EXISTS idx_group_matches_group_status
  ON tournament_group_matches(group_id, status);

-- 6) games inside a match (1..9)
CREATE TABLE IF NOT EXISTS tournament_match_games (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES tournament_group_matches(id) ON DELETE CASCADE,
  game_no INT NOT NULL, -- 1..9
  p1_move TEXT NULL,    -- rock/paper/scissors
  p2_move TEXT NULL,
  result TEXT NULL,     -- p1/p2/draw
  p1_points INT NOT NULL DEFAULT 0,
  p2_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, game_no)
);

CREATE INDEX IF NOT EXISTS idx_match_games_match
  ON tournament_match_games(match_id);

-- 7) chat in webapp (optional but recommended)
CREATE TABLE IF NOT EXISTS tournament_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  room_kind TEXT NOT NULL DEFAULT 'tournament', -- tournament/group/match
  room_id BIGINT NOT NULL,
  tg_user_id BIGINT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_room
  ON tournament_chat_messages(tournament_id, room_kind, room_id, created_at);
