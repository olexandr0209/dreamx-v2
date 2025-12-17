# backend/app/api/pvp.py

from flask import Blueprint, request, jsonify
from app.db.connection import get_conn
from psycopg2.extras import RealDictCursor

bp_pvp = Blueprint("pvp", __name__, url_prefix="/pvp")

MOVES = ("rock", "paper", "scissors")

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
    if result == "draw":
        return (1, 1)
    if result == "p1":
        return (3, 0)
    return (0, 3)


def _match_round(match: dict) -> int:
    if "round_number" in match and match["round_number"] is not None:
        return int(match["round_number"])
    if "current_round" in match and match["current_round"] is not None:
        return int(match["current_round"])
    return 1


def _match_step(match: dict) -> int:
    if "step_in_round" in match and match["step_in_round"] is not None:
        return int(match["step_in_round"])
    if "current_step" in match and match["current_step"] is not None:
        return int(match["current_step"])
    return 0


def _update_match_round_step_sql(match: dict):
    if "round_number" in match and "step_in_round" in match:
        return ("round_number", "step_in_round")
    if "current_round" in match and "current_step" in match:
        return ("current_round", "current_step")
    return ("round_number", "step_in_round")


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


def _moves_step_col(cur) -> str:
    cols = _get_pvp_moves_cols(cur)
    if "step_in_round" in cols:
        return "step_in_round"
    return "step"


def _last_resolved_payload(cur, match: dict, me_id: int):
    """
    ✅ Повертає останній "закритий" крок (де є 2 ходи) як payload,
    щоб фронт міг домалювати кружечки через polling.
    """
    if not match.get("player1_id") or not match.get("player2_id"):
        return None

    step_col = _moves_step_col(cur)

    cur.execute(f"""
        SELECT round_number, {step_col} AS step
        FROM pvp_moves
        WHERE match_id=%s
        GROUP BY round_number, {step_col}
        HAVING COUNT(*) >= 2
        ORDER BY round_number DESC, step DESC
        LIMIT 1
    """, (match["id"],))
    last = cur.fetchone()
    if not last:
        return None

    rr = int(last["round_number"])
    ss = int(last["step"])

    cur.execute(f"""
        SELECT player_id, move
        FROM pvp_moves
        WHERE match_id=%s AND round_number=%s AND {step_col}=%s
    """, (match["id"], rr, ss))
    rows = cur.fetchall()
    moves = {r["player_id"]: r["move"] for r in rows}

    p1m = moves.get(match["player1_id"])
    p2m = moves.get(match["player2_id"])
    if not p1m or not p2m:
        return None

    r = _decide(p1m, p2m)  # draw | p1 | p2

    if r == "draw":
        rel = "draw"
    else:
        i_am_p1 = (me_id == match["player1_id"])
        rel = "win" if (r == ("p1" if i_am_p1 else "p2")) else "lose"

    return {
        "ok": True,
        "status": "resolved",
        "key": f"{rr}-{ss}",
        "p1_move": p1m,
        "p2_move": p2m,
        "result": rel,
        "game_over": (match.get("status") == "finished"),
        "match": match,
    }


@bp_pvp.post("/queue/join")
def join_queue():
    tg_user_id = _get_tg_user_id()
    if not tg_user_id:
        return jsonify({"ok": False, "error": "missing_tg_user_id"}), 400

    conn = get_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id FROM users WHERE tg_user_id=%s", (tg_user_id,))
                me = cur.fetchone()
                if not me:
                    return jsonify({"ok": False, "error": "user_not_found"}), 404
                me_id = me["id"]

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

                step_col = _moves_step_col(cur)

                cur.execute(f"""
                    SELECT move FROM pvp_moves
                    WHERE match_id=%s AND round_number=%s AND {step_col}=%s AND player_id=%s
                    LIMIT 1
                """, (match_id, rn, step, me_id))
                my_move = cur.fetchone()

                # ✅ NEW: останній resolved для домальовки UI
                last_resolved = _last_resolved_payload(cur, match, me_id)

                # ✅ NEW (мінімально): дані гравців для аватарів/нікнеймів
                players = {"p1": None, "p2": None}
                p1_id = match.get("player1_id")
                p2_id = match.get("player2_id")

                ids = [i for i in [p1_id, p2_id] if i]
                if ids:
                    cur.execute("""
                        SELECT id, username, first_name, photo_url
                        FROM users
                        WHERE id = ANY(%s)
                    """, (ids,))
                    rows = cur.fetchall() or []
                    by_id = {r["id"]: r for r in rows}

                    if p1_id and p1_id in by_id:
                        r = by_id[p1_id]
                        players["p1"] = {
                            "id": r["id"],
                            "username": r.get("username"),
                            "first_name": r.get("first_name"),
                            "photo_url": r.get("photo_url"),
                        }
                    if p2_id and p2_id in by_id:
                        r = by_id[p2_id]
                        players["p2"] = {
                            "id": r["id"],
                            "username": r.get("username"),
                            "first_name": r.get("first_name"),
                            "photo_url": r.get("photo_url"),
                        }

                return jsonify({
                    "ok": True,
                    "match": match,
                    "my_role": "p1" if me_id == match["player1_id"] else "p2",
                    "my_user_id": me_id,
                    "can_move": (
                        match["status"] == "playing"
                        and match["player2_id"] is not None
                        and my_move is None
                    ),
                    "last_resolved": last_resolved,
                    "players": players,  # ✅ NEW
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

                cols = _get_pvp_moves_cols(cur)
                has_step_in_round = ("step_in_round" in cols)
                has_step = ("step" in cols)

                step_col = "step_in_round" if has_step_in_round else "step"

                cur.execute(f"""
                    SELECT 1
                    FROM pvp_moves
                    WHERE match_id=%s AND round_number=%s AND {step_col}=%s AND player_id=%s
                    LIMIT 1
                """, (match_id, rn, step, me_id))
                if cur.fetchone():
                    return jsonify({"ok": True, "status": "already_moved", "match": match})

                if has_step_in_round and has_step:
                    cur.execute("""
                        INSERT INTO pvp_moves(match_id, round_number, step_in_round, step, player_id, move)
                        VALUES (%s,%s,%s,%s,%s,%s)
                        ON CONFLICT DO NOTHING
                    """, (match_id, rn, step, step, me_id, move))
                elif has_step_in_round:
                    cur.execute("""
                        INSERT INTO pvp_moves(match_id, round_number, step_in_round, player_id, move)
                        VALUES (%s,%s,%s,%s,%s)
                        ON CONFLICT DO NOTHING
                    """, (match_id, rn, step, me_id, move))
                elif has_step:
                    cur.execute("""
                        INSERT INTO pvp_moves(match_id, round_number, step, player_id, move)
                        VALUES (%s,%s,%s,%s,%s)
                        ON CONFLICT DO NOTHING
                    """, (match_id, rn, step, me_id, move))
                else:
                    return jsonify({"ok": False, "error": "pvp_moves_schema_invalid"}), 500

                cur.execute(f"""
                    SELECT player_id, move
                    FROM pvp_moves
                    WHERE match_id=%s AND round_number=%s AND {step_col}=%s
                """, (match_id, rn, step))
                rows = cur.fetchall()

                if len(rows) < 2:
                    return jsonify({"ok": True, "status": "waiting_other", "match": match})

                moves = {r["player_id"]: r["move"] for r in rows}
                p1m = moves.get(match["player1_id"])
                p2m = moves.get(match["player2_id"])

                result = _decide(p1m, p2m)
                add_p1, add_p2 = _points_for(result)

                next_step = step + 1
                next_round = rn
                if next_step >= 3:
                    next_step = 0
                    next_round = rn + 1

                round_col, step_match_col = _update_match_round_step_sql(match)

                is_last_step = (rn == MAX_ROUNDS and step == 2)

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
                        winner_id = None

                new_status = "finished" if is_last_step else "playing"
                upd_step = step if is_last_step else next_step
                upd_round = rn if is_last_step else next_round

                cur.execute(f"""
                    UPDATE pvp_matches
                    SET score_p1 = COALESCE(score_p1, 0) + %s,
                        score_p2 = COALESCE(score_p2, 0) + %s,
                        {step_match_col} = %s,
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
                    "key": f"{rn}-{step}",  # ✅ щоб фронт не домальовував двічі
                    "game_over": (new_match.get("status") == "finished"),
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
