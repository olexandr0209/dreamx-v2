-- 004_players_points.sql
-- Додаємо фінансово-рейтингові поля гравця (players), базова валюта/очки

ALTER TABLE users
ADD COLUMN IF NOT EXISTS points BIGINT NOT NULL DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS points_tour BIGINT NOT NULL DEFAULT 0;
