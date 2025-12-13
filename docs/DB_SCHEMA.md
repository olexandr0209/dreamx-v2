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



# DreamX v2.0 — DB_SCHEMA (MVP)

Цей документ — єдине джерело правди про структуру БД.
Будь-які зміни робимо тільки через SQL-міграції (нові файли 00X_*.sql).

---

## Загальні принципи
- Primary keys: BIGSERIAL/BIGINT
- Час: created_at, updated_at (де потрібно)
- Унікальні обмеження: telegram_id, tournament_players (tournament_id + user_id)
- Міграції відстежуються в schema_migrations

---

## Таблиця: schema_migrations
Використовується migrate.py для того, щоб не запускати міграції повторно.

### Поля
- version TEXT PRIMARY KEY — назва файлу міграції (наприклад: "001_init.sql")
- applied_at TIMESTAMP NOT NULL DEFAULT NOW()

---

## Таблиця: users
Користувач Telegram, який відкрив WebApp або взаємодіяв з ботом.

### Поля
- id BIGSERIAL PRIMARY KEY
- telegram_id BIGINT NOT NULL UNIQUE
- username TEXT NULL
- first_name TEXT NULL
- last_name TEXT NULL
- language_code TEXT NULL
- created_at TIMESTAMP NOT NULL DEFAULT NOW()
- updated_at TIMESTAMP NULL

### Коментар
- user створюється/оновлюється через API upsert.
- telegram_id — головний ключ інтеграції з Telegram.

---

## Таблиця: tournaments
Турніри DreamX (MVP: зберігаємо назву, час, опис, статус, організатора).

### Поля
- id BIGSERIAL PRIMARY KEY
- title TEXT NOT NULL
- description TEXT NULL
- host_username TEXT NULL         — @Organizer (для показу в UI)
- status TEXT NOT NULL DEFAULT 'upcoming'
  Можливі значення MVP: 'upcoming' | 'live' | 'finished'
- start_at TIMESTAMP NULL
- end_at TIMESTAMP NULL
- created_at TIMESTAMP NOT NULL DEFAULT NOW()

### Коментар
- На MVP достатньо status + start_at.
- Пізніше додамо: правила, тип турніру, призи, приватність, параметри груп.

---

## Таблиця: tournament_players
Хто приєднався до конкретного турніру.

### Поля
- id BIGSERIAL PRIMARY KEY
- tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE
- user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE
- joined_at TIMESTAMP NOT NULL DEFAULT NOW()

### Обмеження
- UNIQUE (tournament_id, user_id)

### Коментар
- Забороняє подвійний join.
- Це основа для "✅ Ви приєднались!" у фронті.

---

## Таблиця: games
Записи матчів/боїв RPS (MVP: простий лог).

### Поля
- id BIGSERIAL PRIMARY KEY
- tournament_id BIGINT NULL REFERENCES tournaments(id) ON DELETE SET NULL
- user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE
- opponent_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL
- opponent_kind TEXT NOT NULL DEFAULT 'bot'
  Можливі значення MVP: 'bot' | 'user'
- round_no INT NULL                 — номер раунду (якщо є)
- move_user TEXT NULL               — 'rock'|'paper'|'scissors'
- move_opponent TEXT NULL           — 'rock'|'paper'|'scissors'
- result TEXT NULL                  — 'win'|'lose'|'draw'
- points_delta INT NOT NULL DEFAULT 0
- created_at TIMESTAMP NOT NULL DEFAULT NOW()

### Коментар
- На MVP це просто лог, щоб потім будувати статистику.
- Для PvP (user vs user) opponent_user_id буде заповнений і opponent_kind='user'.

---

## Зв’язки (коротко)
- users 1—M tournament_players
- tournaments 1—M tournament_players
- users 1—M games
- tournaments 1—M games

---

## MVP гарантії
1) Користувач може бути створений через telegram_id
2) Турнір можна показати списком
3) Користувач може приєднатись (без дубляжу)
4) Гра (RPS) може записуватись у games

---

## Плани на розширення (пізніше, не в MVP)
- tournament_groups (групи гравців)
- tournament_rounds (сітка/раунди)
- user_wallet / points_balance
- ads / promo / giveaways

