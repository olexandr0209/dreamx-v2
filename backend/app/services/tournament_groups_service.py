# backend/app/services/tournament_groups_service.py

from __future__ import annotations

from datetime import datetime, timezone, timedelta

from psycopg2.extras import RealDictCursor  # ✅ NEW (мінімально необхідно)

from app.db import tournament_groups_db as db
from app.engine.tournament_groups.grouping import make_groups
from app.engine.tournament_groups.state_machine import total_rounds_for_group, round_robin_rounds
from app.engine.tournament_groups.rules import MOVES, SERIES_GAMES_TOTAL
from app.engine.tournament_groups.scoring import decide, points_for

JOIN_OPEN_BEFORE_SEC = 300   # 5 хв
JOIN_GRACE_AFTER_START_SEC = 30  # 30 сек після старту


def _parse_start_at(v) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)
    # якщо раптом текст
    try:
        return datetime.fromisoformat(str(v)).astimezone(timezone.utc)
    except Exception:
        return None


def join_tournament(tournament_id: int, tg_user_id: int, join_code: str | None = None) -> dict:
    # ✅ щоб авто-open/locking/forming працювали навіть якщо юзер тисне Join першим
    tick_tournament(tournament_id)

    t = db.get_tournament(tournament_id)
    if not t:
        return {"ok": False, "error": "tournament_not_found"}

    start_at = _parse_start_at(t.get("start_at"))
    now_utc = datetime.now(timezone.utc)

    # ✅ таймінги (5 хв до старту + 30 сек після)
    if start_at:
        open_at = start_at - timedelta(seconds=JOIN_OPEN_BEFORE_SEC)
        lock_at = start_at + timedelta(seconds=JOIN_GRACE_AFTER_START_SEC)

        if now_utc < open_at:
            return {"ok": False, "error": "too_early"}

        if now_utc >= lock_at:
            return {"ok": False, "error": "join_closed"}

    # ✅ реєстрація має бути відкрита
    if t.get("status") != "open":
        return {"ok": False, "error": "registration_closed"}

    # ✅ приватний код
    if t.get("access_type") == "private":
        real = (t.get("join_code") or "").strip()
        if not join_code or join_code.strip() != real:
            return {"ok": False, "error": "bad_join_code"}

    stage = db.ensure_stage(tournament_id, 1, status="pending")
    stage_id = int(stage["id"])

    # ✅ заборона join після старту stage / після створення груп
    st_now = db.get_stage(tournament_id, 1)
    if st_now and st_now.get("status") != "pending":
        return {"ok": False, "error": "already_started"}
    if st_now and db.stage_has_groups(int(st_now["id"])):
        return {"ok": False, "error": "already_started"}

    maxp = int(t.get("max_participants") or 64)
    cur = db.count_stage_players(stage_id)

    if cur >= maxp:
        # idempotent join: якщо юзер вже є — ок
        players = db.list_stage_players(stage_id)
        if tg_user_id in players:
            return {"ok": True, "stage_id": stage_id}
        return {"ok": False, "error": "tournament_full"}

    db.add_stage_player(stage_id, tg_user_id)
    return {"ok": True, "stage_id": stage_id}


def leave_tournament(tournament_id: int, tg_user_id: int) -> dict:
    stage = db.get_stage(tournament_id, 1)
    if not stage:
        return {"ok": True}
    if stage["status"] != "pending":
        return {"ok": False, "error": "already_started"}
    db.remove_stage_player(int(stage["id"]), tg_user_id)
    return {"ok": True}


def tick_tournament(tournament_id: int, now_utc: datetime | None = None) -> dict:
    now_utc = now_utc or datetime.now(timezone.utc)

    t = db.get_tournament(tournament_id)
    if not t:
        return {"ok": False, "error": "tournament_not_found"}

    start_at = _parse_start_at(t.get("start_at"))
    if not start_at:
        return {"ok": True, "status": "waiting_start_time"}

    open_at = start_at - timedelta(seconds=JOIN_OPEN_BEFORE_SEC)
    lock_at = start_at + timedelta(seconds=JOIN_GRACE_AFTER_START_SEC)

    # ✅ авто-відкриття реєстрації за 5 хв (як ти хочеш)
    if (t.get("status") == "draft") and (now_utc >= open_at) and (now_utc < lock_at):
        db.set_tournament_status(tournament_id, "open")

    st1 = db.get_stage(tournament_id, 1)
    if not st1:
        return {"ok": True, "status": "no_stage_yet"}

    stage_id = int(st1["id"])
    stage_status = st1["status"]

    # ✅ В момент lock_at: закриваємо набір (forming), але НЕ створюємо групи в цій же відповіді
    if stage_status == "pending" and now_utc >= lock_at:
        db.set_stage_status(stage_id, "forming")
        return {"ok": True, "status": "forming"}

    # ✅ На наступних тиках: вже реально стартуємо й формуємо групи
    if stage_status == "forming":
        _start_stage(tournament_id, stage_id)

    _progress_all_running_stages(tournament_id)
    return {"ok": True, "status": "ticked"}


def _start_stage(tournament_id: int, stage_id: int) -> None:
    # захист: якщо вже є групи — значить старт робили
    if db.stage_has_groups(stage_id):
        db.set_stage_status(stage_id, "running")
        return

    players = db.list_stage_players(stage_id)
    # якщо 0/1 — одразу фінал
    if len(players) <= 1:
        db.set_stage_status(stage_id, "finished")
        return

    db.set_stage_status(stage_id, "running")

    groups = make_groups(players, base_size=4)
    for idx, g_players in enumerate(groups, start=1):
        gsize = len(g_players)
        rounds_total = total_rounds_for_group(gsize)
        gid = db.create_group(stage_id, idx, gsize, rounds_total)

        # members
        for seat, tg in enumerate(g_players, start=1):
            db.add_group_member(gid, int(tg), int(seat))

        # matches schedule (round robin)
        rounds = round_robin_rounds(g_players)
        for round_no, pairs in enumerate(rounds, start=1):
            for (p1, p2) in pairs:
                db.create_group_match(
                    group_id=gid,
                    match_kind="group",
                    tiebreak_no=0,
                    round_no=round_no,
                    p1_tg_user_id=int(p1),
                    p2_tg_user_id=int(p2),
                    series_total=SERIES_GAMES_TOTAL,
                )

        db.set_group_status(gid, "running")


def _progress_all_running_stages(tournament_id: int) -> None:
    # беремо всі stages, які running
    # простий цикл: якщо stage finished -> створюємо наступний stage і стартуємо
    stage_no = 1
    while True:
        st = db.get_stage(tournament_id, stage_no)
        if not st:
            break

        if st["status"] == "running":
            _progress_stage(int(st["id"]), tournament_id, stage_no)

        # якщо цей stage finished, і треба наступний — створимо
        st2 = db.get_stage(tournament_id, stage_no)
        if st2 and st2["status"] == "finished":
            adv = db.get_advanced_players(int(st2["id"]))
            if len(adv) <= 1:
                # турнір завершено
                break

            next_no = stage_no + 1
            nxt = db.ensure_stage(tournament_id, next_no, status="pending")
            nxt_id = int(nxt["id"])

            # якщо вже є гравці — не дублюємо
            if db.count_stage_players(nxt_id) == 0:
                for tg in adv:
                    db.add_stage_player(nxt_id, int(tg))

            # стартуємо одразу
            db.set_stage_status(nxt_id, "running")
            if not db.stage_has_groups(nxt_id):
                _start_stage(tournament_id, nxt_id)

        stage_no += 1


def _progress_stage(stage_id: int, tournament_id: int, stage_no: int) -> None:
    groups = db.list_stage_groups(stage_id)
    if not groups:
        # нема груп -> нема що робити
        return

    # якщо всі групи finished -> stage finished
    if all(g["status"] == "finished" for g in groups):
        db.set_stage_status(stage_id, "finished")
        return

    # прогрес кожної групи: якщо раунд завершений -> next round / finish group
    for g in groups:
        _progress_group(int(g["id"]))


def _progress_group(group_id: int) -> None:
    # ✅ ВАЖЛИВО: тут НЕ робимо фонове "сканування" і НЕ ліземо в БД зайвий раз.
    # Просування round/group робиться після кожного завершеного матчу у _maybe_advance_group_after_match().
    return


def get_state_for_user(tournament_id: int, tg_user_id: int) -> dict:
    # tick на кожний state (як у PvP polling)
    tick_tournament(tournament_id)

    t = db.get_tournament(tournament_id)
    now_utc = datetime.now(timezone.utc)

    start_at = _parse_start_at(t.get("start_at")) if t else None
    start_total_sec = int((t.get("start_delay_sec") or 60)) if t else 60

    tournament_name = (t.get("name") or t.get("title") or f"#{tournament_id}") if t else f"#{tournament_id}"
    organizer = (t.get("organizer") or t.get("owner_name") or "—") if t else "—"

    # ---- таймінги (5 хв до старту + 30 сек після) ----
    join_open_before_sec = int(globals().get("JOIN_OPEN_BEFORE_SEC", 300))
    join_grace_after_start_sec = int(globals().get("JOIN_GRACE_AFTER_START_SEC", 30))

    seconds_to_start = None
    seconds_to_lock = None
    phase_time = "waiting_start_time"
    join_allowed_by_time = False

    if start_at:
        open_at = start_at - timedelta(seconds=join_open_before_sec)
        lock_at = start_at + timedelta(seconds=join_grace_after_start_sec)

        seconds_to_start = max(0, int((start_at - now_utc).total_seconds()))
        seconds_to_lock = max(0, int((lock_at - now_utc).total_seconds()))

        if now_utc < open_at:
            phase_time = "countdown"          # ще рано
            join_allowed_by_time = False
        elif now_utc < start_at:
            phase_time = "registration"       # до старту (в межах 5 хв)
            join_allowed_by_time = True
        elif now_utc < lock_at:
            phase_time = "late_join"          # 30 сек після старту
            join_allowed_by_time = True
        else:
            phase_time = "forming_groups"     # після 30 сек (набір закритий)
            join_allowed_by_time = False

    # ✅ NEW: намагаємось взяти "останній stage" для цього юзера
    st = None
    fn_latest = getattr(db, "get_user_latest_stage", None)
    if callable(fn_latest):
        st = fn_latest(tournament_id, tg_user_id)
    if not st:
        st = db.get_stage(tournament_id, 1)

    # якщо stage ще нема — все одно віддаємо корисні таймери/фази для лоббі
    if not st:
        return {
            "ok": True,
            "phase": phase_time if phase_time != "waiting_start_time" else "no_stage",
            "tournament_name": tournament_name,
            "organizer": organizer,
            "seconds_to_start": seconds_to_start,
            "seconds_to_lock": seconds_to_lock,
            "start_total_sec": start_total_sec,
            "players_count": 0,
            "joined": False,
            "join_allowed": False,
        }

    stage_id = int(st["id"])
    stage_no = int(st.get("stage_no") or 1)
    stage_status = st["status"]

    # players_count + joined
    players_count = db.count_stage_players(stage_id)
    try:
        stage_players = db.list_stage_players(stage_id)
        joined = (tg_user_id in stage_players)
    except Exception:
        stage_players = []
        joined = False

    # ✅ STEP2 (мінімально): підтягнути users для lobby/registration (коли ще нема group)
    stage_players_ui = []
    try:
        fn_pub = getattr(db, "get_users_public", None)
        if callable(fn_pub) and stage_players:
            users_map_stage = fn_pub(stage_players) or {}
        else:
            users_map_stage = {}
        # зберігаємо порядок як в stage_players
        for tg in (stage_players or []):
            u = users_map_stage.get(int(tg), {}) or {}
            stage_players_ui.append(
                {
                    "tg_user_id": int(tg),
                    "username": u.get("username"),
                    "first_name": u.get("first_name"),
                    "last_name": u.get("last_name"),
                    "photo_url": u.get("photo_url"),
                }
            )
    except Exception:
        stage_players_ui = []

    # чи взагалі показувати кнопку JOIN
    # (узгоджуємо з join_tournament: там зараз треба t.status == 'open')
    t_status = (t.get("status") if t else None)
    join_allowed = (
        (t_status == "open") and
        (stage_status == "pending") and
        join_allowed_by_time and
        (not joined)
    )

    g = db.get_group_by_user(stage_id, tg_user_id)

    if not g:
        # якщо груп ще немає
        if stage_status in ("forming",):
            phase = "forming_groups"
        elif stage_status == "pending":
            # показуємо точну фазу по часу
            phase = phase_time if phase_time != "waiting_start_time" else "registration"
            # якщо час lock вже пройшов, але stage ще pending (на випадок затримки tick) — все одно "формуються"
            if phase_time == "forming_groups":
                phase = "forming_groups"
        else:
            # running, але групи ще не видно (рідкісний стан) — теж "формуються"
            phase = "forming_groups"

        return {
            "ok": True,
            "phase": phase,
            "stage_no": stage_no,
            "stage_status": stage_status,
            "tournament_name": tournament_name,
            "organizer": organizer,
            "seconds_to_start": seconds_to_start,
            "seconds_to_lock": seconds_to_lock,
            "start_total_sec": start_total_sec,
            "players_count": players_count,
            "joined": joined,
            "join_allowed": join_allowed,
            # ✅ STEP2 (мінімально): список учасників у lobby (не ламає старий фронт)
            "players": stage_players_ui,
        }

    # ---- група вже є ----
    group_id = int(g["id"])
    members = db.list_group_members(group_id)

    # ✅ STEP2: підтягнути users (username/first/last/photo) одним запитом
    users_map = {}
    try:
        tg_ids = [int(x["tg_user_id"]) for x in (members or [])]
        fn = getattr(db, "get_users_public", None)
        if callable(fn):
            users_map = fn(tg_ids) or {}
    except Exception:
        users_map = {}

    group_members = sorted(members, key=lambda x: int(x["seat"]))

    # ✅ STEP2: додаємо user fields у group_members
    group_members_ui = []
    for x in group_members:
        tg = int(x["tg_user_id"])
        u = users_map.get(tg, {})
        group_members_ui.append(
            {
                "tg_user_id": tg,
                "seat": int(x["seat"]),
                "username": u.get("username"),
                "first_name": u.get("first_name"),
                "last_name": u.get("last_name"),
                "photo_url": u.get("photo_url"),
            }
        )

    standings = sorted(
        members,
        key=lambda x: (-int(x["points"]), -int(x["wins"]), -int(x["draws"]), int(x["losses"]), int(x["seat"])),
    )

    current_round = int(g["current_round"])
    match = db.find_user_match_in_round(group_id, "group", 0, current_round, tg_user_id)

    active_match = None
    if match:
        if match["status"] == "waiting":
            db.set_match_status(int(match["id"]), "active")
            match = db.get_match(int(match["id"]))
        active_match = _build_match_state(match, tg_user_id)

    return {
        "ok": True,
        "phase": "group",
        "stage_no": stage_no,
        "stage_status": stage_status,
        "tournament_name": tournament_name,
        "organizer": organizer,
        "seconds_to_start": seconds_to_start,
        "seconds_to_lock": seconds_to_lock,
        "start_total_sec": start_total_sec,
        "players_count": players_count,
        "joined": joined,
        "join_allowed": False,  # у групі кнопка join не потрібна
        "group": {
            "id": group_id,
            "status": g["status"],
            "group_no": g["group_no"],
            "group_size": g["group_size"],
            "current_round": current_round,
            "total_rounds": g["total_rounds"],
        },
        "group_members": group_members_ui,
        "standings": [
            {
                "tg_user_id": int(x["tg_user_id"]),
                "seat": int(x["seat"]),
                "points": int(x["points"]),
                "matches_played": int(x["matches_played"]),
                "wins": int(x["wins"]),
                "draws": int(x["draws"]),
                "losses": int(x["losses"]),
                # ✅ STEP2: додали user fields (не ламає старий фронт)
                "username": (users_map.get(int(x["tg_user_id"]), {}) or {}).get("username"),
                "first_name": (users_map.get(int(x["tg_user_id"]), {}) or {}).get("first_name"),
                "last_name": (users_map.get(int(x["tg_user_id"]), {}) or {}).get("last_name"),
                "photo_url": (users_map.get(int(x["tg_user_id"]), {}) or {}).get("photo_url"),
            }
            for x in standings
        ],
        "match": active_match,
    }


def _build_match_state(match: dict, tg_user_id: int) -> dict:
    mid = int(match["id"])
    p1 = int(match["p1_tg_user_id"])
    p2 = int(match["p2_tg_user_id"])
    you_are_p1 = (tg_user_id == p1)
    opp = p2 if you_are_p1 else p1

    latest = db.get_latest_game(mid)

    # визначимо "поточну гру" в серії
    if not latest:
        game_no = 1
        p1_move = None
        p2_move = None
        result = None
    else:
        if latest.get("result") is None:
            game_no = int(latest["game_no"])
            p1_move = latest.get("p1_move")
            p2_move = latest.get("p2_move")
            result = None
        else:
            game_no = int(latest["game_no"]) + 1
            p1_move = None
            p2_move = None
            result = None

    # чи потрібно робити хід саме цьому гравцю
    need_move = True
    if latest and latest.get("result") is None:
        if you_are_p1 and latest.get("p1_move") is not None:
            need_move = False
        if (not you_are_p1) and latest.get("p2_move") is not None:
            need_move = False

    # ✅ NEW: my_move / opponent_move для кружечків у WebApp
    my_move = None
    opponent_move = None
    if latest and latest.get("result") is None:
        if you_are_p1:
            my_move = latest.get("p1_move")
            opponent_move = latest.get("p2_move")
        else:
            my_move = latest.get("p2_move")
            opponent_move = latest.get("p1_move")

    return {
        "id": mid,
        "status": match["status"],
        "you_are_p1": you_are_p1,
        "opponent_tg_user_id": opp,
        "games_played": int(match["games_played"]),
        "series_total": int(match["series_games_total"]),
        "p1_series_points": int(match["p1_series_points"]),
        "p2_series_points": int(match["p2_series_points"]),
        "next_game_no": game_no,
        "need_move": need_move,
        "my_move": my_move,
        "opponent_move": opponent_move,
    }


def _set_game_result_if_empty(match_id: int, game_no: int, result: str, p1_points: int, p2_points: int) -> bool:
    # ✅ атомарно: тільки якщо result IS NULL (захист від double-scoring)
    from app.db.connection import get_conn
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tournament_match_games
                SET result=%s, p1_points=%s, p2_points=%s
                WHERE match_id=%s AND game_no=%s AND result IS NULL
                """,
                (result, p1_points, p2_points, match_id, game_no),
            )
            changed = (cur.rowcount == 1)
        conn.commit()
    return changed


def _finish_match_if_not_finished(match_id: int, winner_tg_user_id: int | None) -> bool:
    # ✅ ідемпотентно: тільки якщо ще не finished
    from app.db.connection import get_conn
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tournament_group_matches
                SET status='finished', winner_tg_user_id=%s, updated_at=NOW()
                WHERE id=%s AND status!='finished'
                """,
                (winner_tg_user_id, match_id),
            )
            changed = (cur.rowcount == 1)
        conn.commit()
    return changed


def submit_move(tournament_id: int, tg_user_id: int, match_id: int, move: str) -> dict:
    move = (move or "").strip()
    if move not in MOVES:
        return {"ok": False, "error": "bad_move"}

    m = db.get_match(match_id)
    if not m:
        return {"ok": False, "error": "match_not_found"}

    p1 = int(m["p1_tg_user_id"])
    p2 = int(m["p2_tg_user_id"])
    if tg_user_id not in (p1, p2):
        return {"ok": False, "error": "not_your_match"}

    if m["status"] == "finished":
        return {"ok": False, "error": "match_finished"}

    if m["status"] == "waiting":
        db.set_match_status(match_id, "active")
        m = db.get_match(match_id)

    you_are_p1 = tg_user_id == p1

    latest = db.get_latest_game(match_id)

    if not latest:
        game_no = 1
    else:
        if latest.get("result") is None:
            game_no = int(latest["game_no"])
        else:
            game_no = int(latest["game_no"]) + 1

    if game_no > int(m["series_games_total"]):
        return {"ok": False, "error": "series_done"}

    # пишемо хід
    db.upsert_game_move(match_id, game_no, you_are_p1, move)

    # читаємо гру, якщо обидва зробили хід — рахуємо результат
    g = db.get_game(match_id, game_no)
    if not g:
        return {"ok": True}

    if g.get("result") is None and g.get("p1_move") and g.get("p2_move"):
        res = decide(g["p1_move"], g["p2_move"])
        p1_pts, p2_pts = points_for(res)

        # ✅ NEW: рахуємо тільки 1 раз (якщо result був NULL)
        changed = _set_game_result_if_empty(match_id, game_no, res, p1_pts, p2_pts)
        if not changed:
            return {"ok": True}

        db.apply_match_progress(match_id, 1, p1_pts, p2_pts)

        # якщо серія завершилась — фініш матчу + апдейт members
        m2 = db.get_match(match_id)
        if int(m2["games_played"]) >= int(m2["series_games_total"]):
            w = None
            if int(m2["p1_series_points"]) > int(m2["p2_series_points"]):
                w = p1
            elif int(m2["p2_series_points"]) > int(m2["p1_series_points"]):
                w = p2

            # ✅ NEW: finish тільки 1 раз
            finished_now = _finish_match_if_not_finished(match_id, w)
            if finished_now:
                db.apply_member_match_result(
                    group_id=int(m2["group_id"]),
                    p1=p1,
                    p2=p2,
                    p1_series_points=int(m2["p1_series_points"]),
                    p2_series_points=int(m2["p2_series_points"]),
                    winner=w,
                )

                # після кожного завершеного матчу — пробуємо просунути round/group
                _maybe_advance_group_after_match(int(m2["group_id"]))

    return {"ok": True}


def _maybe_advance_group_after_match(group_id: int) -> None:
    # якщо всі матчі поточного round finished -> наступний round
    groups = None  # не треба

    from app.db.connection import get_conn

    # дістанемо group через list_stage_groups — нам треба stage_id, але простіше:
    # зробимо невеликий select тут (не чіпаючи інші файли)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, current_round, total_rounds, status FROM tournament_groups WHERE id=%s",
                (group_id,),
            )
            g = cur.fetchone()
            if not g:
                return
            current_round = int(g["current_round"])
            total_rounds = int(g["total_rounds"])
            status = g["status"]

    if status not in ("running", "tiebreak"):
        return

    # чи всі матчі цього round вже finished?
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS c
                FROM tournament_group_matches
                WHERE group_id=%s AND match_kind='group' AND tiebreak_no=0
                  AND round_no=%s AND status!='finished'
                """,
                (group_id, current_round),
            )
            left = int(cur.fetchone()["c"])

    if left > 0:
        return

    if current_round < total_rounds:
        db.set_group_current_round(group_id, current_round + 1)
        return

    # всі раунди завершені -> фініш групи + ranks/top2
    members = db.list_group_members(group_id)
    ordered = sorted(
        members,
        key=lambda x: (-int(x["points"]), -int(x["wins"]), -int(x["draws"]), int(x["losses"]), int(x["seat"])),
    )
    ordered_ids = [int(x["tg_user_id"]) for x in ordered]
    db.set_member_ranks(group_id, ordered_ids, advanced_top=2)
    db.set_group_status(group_id, "finished")
