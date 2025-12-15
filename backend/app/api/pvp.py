# backend/app/api/pvp.py

from flask import Blueprint, request, jsonify
from app.db.connection import get_conn
from psycopg2.extras import RealDictCursor

bp_pvp = Blueprint("pvp", __name__, url_prefix="/pvp")

MOVES = ("rock", "paper", "scissors")


def _get_tg_user_id():
    tg = request.headers.get("X-Tg-User-Id") or request.args.get("tg_user_id")
    if not tg:
        return None
    try:
        return int(tg)
    except Exception:
        return None


def _as_int(v):
    try:
        return int(v)
    except Exception:
        return None


def _decide(p1_move: str, p2_move: str) -> str:
    if p1_move == p2_move:
        return "draw"
    if (
        (p1_move == "rock" and p2_move == "scissors") or
        (p1_move == "scissors" and p2_move == "paper") or
        (p1_move == "paper" and p2_move == "rock")
    ):
        return "p1"
    return "p2"


def _points_for(result: str):
    # win +3, draw +1/+1, lose +0
    if result == "draw":
        return (1, 1)
    if result == "p1":
        return (3, 0)
    return (0, 3)


def _match_round(match: dict) -> int:
    # ✅ підтримка двох схем: round_number або current_round
    if "round_number" in match and match["round_number"] is not None:
        return int(match["round_number"])
    if "current_round" in match and match["current_round"] is not None:
        return int(match["current_round"])
    return 1


def _match_step(match: dict) -> int:
    # ✅ підтримка двох схем: step_in_round або current_step
    if "step_in_round" in match and match["step_in_round"] is not None:
        return int(match["step_in_round"])
    if "current_step" in match and match["current_step"] is not None:
        return int(match["current_step"])
    return 0


def _update_match_round_step_sql(match: dict):
    """
    ✅ Повертає SQL-фрагмент для UPDATE правильних колонок
    залежно від того, які колонки реально є у match (dict з SELECT *).
    """
    if "round_number" in match and "step_in_round" in match:
        return ("round_number", "step_in_round")
    if "current_round" in match and "current_step" in match:
        return ("current_round", "current_step")
    # fallback: якщо раптом ні те ні те (малоймовірно)
    return ("round_number", "step_in_round")


@bp_pvp.post("/queue/join")
def join_queue():
    tg_user_id = _get_tg_user_id()
    if not tg_user_id:
        return jsonify({"ok": False, "error": "missing_tg_user_id"}), 400

    conn = get_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # 1) знаходимо юзера
                cur.execute("SELECT id FROM users WHERE tg_user_id=%s", (tg_user_id,))
                me = cur.fetchone()
                if not me:
                    return jsonify({"ok": False, "error": "user_not_found"}), 404
                me_id = me["id"]

                # 2) якщо я вже в матчі waiting/playing — повертаємо його
                cur.execute("""
                    SELECT * FROM pvp_matches
                    WHERE status IN ('waiting','playing')
                      AND (player1_id=%s OR player2_id=%s)
                    ORDER BY id DESC
                    LIMIT 1
                    FOR UPDATE
                """, (me_id, me_id))
                existing = cur.fetchone()
                if existing:
                    return jsonify({"ok": True, "match": existing})

                # 3) пробуємо підхопити waiting матч (атомарно)
                cur.execute("""
                    SELECT * FROM pvp_matches
                    WHERE status='waiting'
                      AND player1_id <> %s
                      AND player2_id IS NULL
                    ORDER BY id ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                """, (me_id,))
                waiting = cur.fetchone()

                if waiting:
                    cur.execute("""
                        UPDATE pvp_matches
                        SET player2_id=%s,
                            status='playing',
                            updated_at=NOW()
                        WHERE id=%s
                        RETURNING *
                    """, (me_id, waiting["id"]))
                    match = cur.fetchone()
                    return jsonify({"ok": True, "match": match})

                # 4) інакше створюємо новий waiting матч
                cur.execute("""
                    INSERT INTO pvp_matches(player1_id, status)
                    VALUES (%s, 'waiting')
                    RETURNING *
                """, (me_id,))
                match = cur.fetchone()
                return jsonify({"ok": True, "match": match})
    finally:
        conn.close()


@bp_pvp.get("/match/state")
def match_state():
    tg_user_id = _get_tg_user_id()
    match_id = _as_int(request.args.get("match_id"))
    if not tg_user_id or not match_id:
        return jsonify({"ok": False, "error": "missing_params"}), 400

    conn = get_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id FROM users WHERE tg_user_id=%s", (tg_user_id,))
                me = cur.fetchone()
                if not me:
                    return jsonify({"ok": False, "error": "user_not_found"}), 404
                me_id = me["id"]

                cur.execute("SELECT * FROM pvp_matches WHERE id=%s", (match_id,))
                match = cur.fetchone()
                if not match:
                    return jsonify({"ok": False, "error": "match_not_found"}), 404

                if me_id not in (match["player1_id"], match["player2_id"]):
                    return jsonify({"ok": False, "error": "not_your_match"}), 403

                rn = _match_round(match)
                step = _match_step(match)

                # чи я вже зробив хід на поточному кроці?
                cur.execute("""
                    SELECT move FROM pvp_moves
                    WHERE match_id=%s AND round_number=%s AND step_in_round=%s AND player_id=%s
                    LIMIT 1
                """, (match_id, rn, step, me_id))
                my_move = cur.fetchone()

                return jsonify({
                    "ok": True,
                    "match": match,
                    "my_role": "p1" if me_id == match["player1_id"] else "p2",
                    # ✅ не можна ходити якщо ще нема суперника
                    "can_move": (
                        match["status"] == "playing"
                        and match["player2_id"] is not None
                        and my_move is None
                    ),
                })
    finally:
        conn.close()


@bp_pvp.post("/match/move")
def match_move():
    tg_user_id = _get_tg_user_id()
    match_id = _as_int(request.args.get("match_id"))
    data = request.get_json(silent=True) or request.form or {}
    move = data.get("move")

    if not tg_user_id or not match_id:
        return jsonify({"ok": False, "error": "missing_params"}), 400
    if move not in MOVES:
        return jsonify({"ok": False, "error": "bad_move"}), 400

    conn = get_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id FROM users WHERE tg_user_id=%s", (tg_user_id,))
                me = cur.fetchone()
                if not me:
                    return jsonify({"ok": False, "error": "user_not_found"}), 404
                me_id = me["id"]

                # Лочимо матч
                cur.execute("SELECT * FROM pvp_matches WHERE id=%s FOR UPDATE", (match_id,))
                match = cur.fetchone()
                if not match:
                    return jsonify({"ok": False, "error": "match_not_found"}), 404
                if match["status"] != "playing":
                    return jsonify({"ok": False, "error": "match_not_playing"}), 400
                if me_id not in (match["player1_id"], match["player2_id"]):
                    return jsonify({"ok": False, "error": "not_your_match"}), 403
                if not match["player2_id"]:
                    return jsonify({"ok": False, "error": "no_opponent_yet"}), 400

                rn = _match_round(match)
                step = _match_step(match)

                # якщо я вже ходив на цьому step — не приймаємо повторно
                cur.execute("""
                    SELECT 1
                    FROM pvp_moves
                    WHERE match_id=%s AND round_number=%s AND step_in_round=%s AND player_id=%s
                    LIMIT 1
                """, (match_id, rn, step, me_id))
                if cur.fetchone():
                    return jsonify({"ok": True, "status": "already_moved", "match": match})

                # вставляємо мій хід (без дубля)
                cur.execute("""
                    INSERT INTO pvp_moves(match_id, round_number, step_in_round, player_id, move)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (match_id, round_number, step_in_round, player_id)
                    DO NOTHING
                """, (match_id, rn, step, me_id, move))

                # дістаємо обидва ходи
                cur.execute("""
                    SELECT player_id, move
                    FROM pvp_moves
                    WHERE match_id=%s AND round_number=%s AND step_in_round=%s
                """, (match_id, rn, step))
                rows = cur.fetchall()

                # якщо ще не двоє — просто повертаємо стан
                if len(rows) < 2:
                    return jsonify({"ok": True, "status": "waiting_other", "match": match})

                # визначаємо p1/p2 ходи
                moves = {r["player_id"]: r["move"] for r in rows}
                p1m = moves.get(match["player1_id"])
                p2m = moves.get(match["player2_id"])

                result = _decide(p1m, p2m)
                add_p1, add_p2 = _points_for(result)

                # next step/round
                next_step = step + 1
                next_round = rn
                if next_step >= 3:
                    next_step = 0
                    next_round = rn + 1

                round_col, step_col = _update_match_round_step_sql(match)

                cur.execute(f"""
                    UPDATE pvp_matches
                    SET score_p1 = score_p1 + %s,
                        score_p2 = score_p2 + %s,
                        {step_col} = %s,
                        {round_col} = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING *
                """, (add_p1, add_p2, next_step, next_round, match_id))
                new_match = cur.fetchone()

                return jsonify({
                    "ok": True,
                    "status": "resolved",
                    "p1_move": p1m,
                    "p2_move": p2m,
                    "result": "draw" if result == "draw" else (
                        "win" if result == ("p1" if me_id == match["player1_id"] else "p2") else "lose"
                    ),
                    "delta_me": add_p1 if me_id == match["player1_id"] else add_p2,
                    "match": new_match
                })
    finally:
        conn.close()
