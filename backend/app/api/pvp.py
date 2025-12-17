# backend/app/api/pvp.py

from flask import Blueprint, request, jsonify
from app.db.connection import get_conn
from psycopg2.extras import RealDictCursor

bp_pvp = Blueprint("pvp", __name__, url_prefix="/pvp")

MOVES = ("rock", "paper", "scissors")

# ✅ NEW: фіксована довжина матчу
MAX_ROUNDS = 5  # 5 раундів * 3 ходи = 15 ходів


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
    # fallback
    return ("round_number", "step_in_round")


# ✅ кеш колонок pvp_moves (щоб не бити information_schema кожен раз)
_PVP_MOVES_COLS = None


def _get_pvp_moves_cols(cur):
    global _PVP_MOVES_COLS
    if _PVP_MOVES_COLS is not None:
        return _PVP_MOVES_COLS

    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pvp_moves'
    """)
    cols = {r["column_name"] for r in cur.fetchall()}
    _PVP_MOVES_COLS = cols
    return cols


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
                    "my_user_id": me_id,  # ✅ NEW: щоб фронт точно знав Winner/Defeated
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

                # якщо в pvp_moves є NOT NULL колонка step — заповнюємо її також
                cols = _get_pvp_moves_cols(cur)
                has_step_col = ("step" in cols)

                if has_step_col:
                    cur.execute("""
                        INSERT INTO pvp_moves(match_id, round_number, step_in_round, step, player_id, move)
                        VALUES (%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (match_id, round_number, step_in_round, player_id)
                        DO NOTHING
                    """, (match_id, rn, step, step, me_id, move))
                else:
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

                # next step/round (твоя логіка як була)
                next_step = step + 1
                next_round = rn
                if next_step >= 3:
                    next_step = 0
                    next_round = rn + 1

                round_col, step_col = _update_match_round_step_sql(match)

                # ✅ NEW: фініш після 5-го раунду на 3-му кроці (step==2)
                is_last_step = (rn == MAX_ROUNDS and step == 2)

                # рахуємо фінальні очки, щоб визначити winner_id
                cur_score_p1 = int(match.get("score_p1") or 0)
                cur_score_p2 = int(match.get("score_p2") or 0)
                final_score_p1 = cur_score_p1 + add_p1
                final_score_p2 = cur_score_p2 + add_p2

                winner_id = None
                if is_last_step:
                    if final_score_p1 > final_score_p2:
                        winner_id = match["player1_id"]
                    elif final_score_p2 > final_score_p1:
                        winner_id = match["player2_id"]
                    else:
                        winner_id = None  # draw

                new_status = "finished" if is_last_step else "playing"
                upd_step = step if is_last_step else next_step
                upd_round = rn if is_last_step else next_round

                cur.execute(f"""
                    UPDATE pvp_matches
                    SET score_p1 = COALESCE(score_p1, 0) + %s,
                        score_p2 = COALESCE(score_p2, 0) + %s,
                        {step_col} = %s,
                        {round_col} = %s,
                        status = %s,
                        winner_id = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING *
                """, (add_p1, add_p2, upd_step, upd_round, new_status, winner_id, match_id))
                new_match = cur.fetchone()

                return jsonify({
                    "ok": True,
                    "status": "resolved",
                    "game_over": (new_match.get("status") == "finished"),  # ✅ NEW
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
