# DreamX v2.0 — MASTER PLAN (єдиний план розробки)

## Принципи (НЕ порушуємо)
1) Працюємо тільки по цьому плану. Якщо щось нове — додається як "Backlog", але не ламає етапи.
2) Спочатку фундамент: структура → схема → міграції → API → WebApp → боти.
3) Один сервіс = одна відповідальність.
4) Будь-які зміни в БД тільки через міграції (SQL файли), а не “вручну в консолі”.
5) Спочатку робимо MVP стабільний, потім красота/оптимізації.

---

## Етап A — Репозиторій і структура (✅ вже зроблено)
Ціль: мати стабільну структуру, де легко орієнтуватись.

Папки:
- docs/      — документація (план, схема БД, правила)
- webapp/    — фронт (Telegram WebApp)
- backend/   — API (Python)
- bots/      — Telegram bots
- scripts/   — одноразові утиліти (за потреби)

Критерій готовності:
- структура є
- README мінімальний є
- розуміємо де що лежить

---

## Етап B — Дані та база (✅ B2 зроблено, B3 зараз робимо)
### B1. Підготовка під Postgres (✅)
- Є підключення через DATABASE_URL
- Є місце для міграцій і їх запуск

### B2. Міграції (✅)
- 001_init.sql
- 002_tournaments.sql
- 003_games.sql
- migrate.py запускає їх по черзі і записує у schema_migrations

Пояснення:
Render показує "Application exited early" — це нормально для разового скрипта міграцій.
Міграції — НЕ сервіс.

### B3. DB_SCHEMA.md (⏳ зараз)
Ціль: зафіксувати структуру таблиць і зв’язки.
Критерій готовності:
- docs/DB_SCHEMA.md описує всі таблиці + поля + ключі + логіку.

---

## Етап C — Backend API (MVP)
Ціль: API, яке WebApp і боти можуть викликати.

### C1. Мінімальні ендпоінти (MVP)
1) Healthcheck
- GET /health → { ok: true }

2) Users
- POST /api/users/upsert (або /api/users/ensure)
  Вхід: telegram_id, username, first_name
  Вихід: user (id, telegram_id, username, ...)

3) Tournaments (список + деталі)
- GET /api/tournaments?status=live|upcoming|finished
- GET /api/tournaments/{id}

4) Join tournament
- POST /api/tournaments/{id}/join
  Вхід: user_id
  Логіка:
    - не дублювати участь
    - запис у tournament_players

5) Games (RPS записи боїв)
- POST /api/games
  Вхід: tournament_id, user_id, opponent_user_id (може бути null для бота), moves/score/result
  Вихід: game_id

Критерій готовності:
- Postman/curl показує що ендпоінти працюють
- WebApp може читати турніри і join

### C2. Валідації (мінімум)
- tournament_id існує
- user_id існує
- join не повторюється

---

## Етап D — WebApp (MVP UI)
Ціль: щоб у Telegram WebApp людина могла:
- відкрити
- створитись як user
- побачити список турнірів
- зайти в турнір
- грати RPS базово

### D1. Екрани (за твоєю фігмою)
1) Home
2) Tournaments list
3) Tournament waiting
4) Tournament game screen
5) Winner/Finish screen

Критерій готовності:
- всі екрани відкриваються
- дані підтягнуті з API
- join працює

---

## Етап E — Bots (MVP)
Ціль: мінімально мати 1–2 боти, які запускають юзерів у WebApp.

### E1. Game bot (мінімум)
- /start → кнопка “Відкрити DreamX”
- bot лише віддає WebApp URL

### E2. Admin bot (пізніше)
- створення турнірів/розіграшів через діалоги

Критерій готовності:
- користувач натискає кнопку і потрапляє в WebApp

---

## Етап F — Прод/Дев середовища (після MVP)
Ціль: не ламати прод під час розробки.
- separate env vars
- dev webapp badge
- dev api endpoints

---

## Backlog (не чіпаємо до MVP)
- рейтинги
- групи і автозбір гравців
- відеореклама під час формування груп
- кастомні картинки/скіни
- Twitch інтеграція

---

## Поточний статус
✅ A — структура
✅ B2 — міграції
⏳ B3 — DB_SCHEMA.md (робимо зараз)
➡️ Далі: C1 — мінімальний API
