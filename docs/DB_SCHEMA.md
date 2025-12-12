# DreamX v2 — Database Schema (PostgreSQL)

Це фінальна базова схема БД для DreamX v2.  
Вона покриває:

- гравців і організаторів
- турніри та їх раунди / групи
- матчі (у т.ч. швидкі ігри vs бот і 1vs1)
- статистику гравців
- онлайн-статус гравців у турнірі
- глобальні налаштування платформи
- оголошення (які показуються у грі)

---

## 1. Огляд таблиць

### Основні

1. `players` — усі гравці DreamX (на основі Telegram користувача)
2. `organizers` — користувачі, яким дозволено створювати турніри
3. `tournaments` — турніри (назва, організатор, статус, налаштування)
4. `tournament_players` — гравці, які зареєстровані в конкретному турнірі

### Структура турніру

5. `tournament_rounds` — раунди турніру (1, 2, 3, …)
6. `tournament_groups` — групи в рамках конкретного раунду
7. `tournament_group_players` — гравці, закріплені за групою в раунді

### Матчі та ходи

8. `matches` — матчі RPS (турнірні, vs бот, онлайн 1vs1)
9. `rps_rounds` — окремі ходи (камінь/ножиці/папір) у матчі

### Сервісні таблиці

10. `online_tournament_players` — хто зараз реально "в лоббі" турніру
11. `platform_settings` — глобальні налаштування платформи
12. `announcements` — оголошення, які можна показувати у WebApp / ботах

---

## 2. Таблиця `players`

**Призначення:** усі гравці DreamX (один запис = один Telegram користувач).

```sql
CREATE TABLE IF NOT EXISTS players (
    id                  BIGSERIAL PRIMARY KEY,
    telegram_id         BIGINT UNIQUE NOT NULL,          -- id з Telegram
    username            TEXT,                            -- @username (може бути NULL)
    display_name        TEXT NOT NULL,                   -- ім'я для відображення у грі
    avatar_file_id      TEXT,                            -- file_id аватарки (якщо зберігаємо)

    -- Базова статистика
    computer_wins           INTEGER NOT NULL DEFAULT 0,  -- перемоги проти бота
    computer_rounds_played  INTEGER NOT NULL DEFAULT 0,  -- зіграні раунди vs бот

    tournament_rounds_won   INTEGER NOT NULL DEFAULT 0,  -- сумарно виграні раунди в турнірах
    tournaments_won         INTEGER NOT NULL DEFAULT 0,  -- скільки турнірів виграв
    matches_played          INTEGER NOT NULL DEFAULT 0,  -- усі матчі (турнірні + 1vs1 + бот)
    matches_won             INTEGER NOT NULL DEFAULT 0,  -- усі переможні матчі

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_telegram_id ON players(telegram_id);

