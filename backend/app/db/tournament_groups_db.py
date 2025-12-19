# backend/app/db/tournament_groups_db.py

from __future__ import annotations

from typing import Any, Iterable
from datetime import datetime, timezone

from psycopg2.extras import RealDictCursor

from app.db.connection import get_conn


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------
# Tournament
# ---------------------------

def get_tournament(tournament_id: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, status, access_type, join_code,
                       start_mode, start_at, start_delay_sec,
                       max_participants, chat_enabled
                FROM tournaments
                WHERE id=%s
                """,
                (tournament_id,),
            )
            return cur.fetchone()


# ---------------------------
# Stage
# ---------------------------
def is_stage_player(stage_id: int, tg_user_id: int) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM tournament_stage_players WHERE stage_id=%s AND tg_user_id=%s LIMIT 1",
                (stage_id, tg_user_id),
            )
            return cur.fetchone() is not None

def get_stage(tournament_id: int, stage_no: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT *
                FROM tournament_stages
                WHERE tournament_id=%s AND stage_no=%s
                """,
                (tournament_id, stage_no),
            )
            return cur.fetchone()


def ensure_stage(tournament_id: int, stage_no: int, status: str = "pending") -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tournament_stages(tournament_id, stage_no, status)
                VALUES (%s, %s, %s)
                ON CONFLICT (tournament_id, stage_no) DO NOTHING
                """,
                (tournament_id, stage_no, status),
            )
            conn.commit()

    st = get_stage(tournament_id, stage_no)
    if not st:
        raise RuntimeError("stage_create_failed")
    return st


def set_stage_status(stage_id: int, status: str) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            if status == "running":
                cur.execute(
                    """
                    UPDATE tournament_stages
                    SET status=%s, started_at=COALESCE(started_at, NOW())
                    WHERE id=%s
                    """,
                    (status, stage_id),
                )
            elif status == "finished":
                cur.execute(
                    """
                    UPDATE tournament_stages
                    SET status=%s, finished_at=COALESCE(finished_at, NOW())
                    WHERE id=%s
                    """,
                    (status, stage_id),
                )
            else:
                cur.execute(
                    "UPDATE tournament_stages SET status=%s WHERE id=%s",
                    (status, stage_id),
                )
        conn.commit()


# ---------------------------
# Stage players
# ---------------------------

def count_stage_players(stage_id: int) -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM tournament_stage_players WHERE stage_id=%s",
                (stage_id,),
            )
            row = cur.fetchone()
            return int(row["c"])


def list_stage_players(stage_id: int) -> list[int]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT tg_user_id
                FROM tournament_stage_players
                WHERE stage_id=%s
                ORDER BY created_at ASC
                """,
                (stage_id,),
            )
            rows = cur.fetchall() or []
            return [int(r["tg_user_id"]) for r in rows]


def add_stage_player(stage_id: int, tg_user_id: int) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tournament_stage_players(stage_id, tg_user_id)
                VALUES (%s, %s)
                ON CONFLICT (stage_id, tg_user_id) DO NOTHING
                """,
                (stage_id, tg_user_id),
            )
        conn.commit()


def remove_stage_player(stage_id: int, tg_user_id: int) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM tournament_stage_players WHERE stage_id=%s AND tg_user_id=%s",
                (stage_id, tg_user_id),
            )
        conn.commit()


# ---------------------------
# Groups + members
# ---------------------------

def stage_has_groups(stage_id: int) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM tournament_groups WHERE stage_id=%s LIMIT 1",
                (stage_id,),
            )
            return cur.fetchone() is not None


def create_group(stage_id: int, group_no: int, group_size: int, total_rounds: int) -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tournament_groups(stage_id, group_no, group_size, total_rounds, status, current_round, updated_at)
                VALUES (%s, %s, %s, %s, 'waiting', 1, NOW())
                RETURNING id
                """,
                (stage_id, group_no, group_size, total_rounds),
            )
            gid = int(cur.fetchone()["id"])
        conn.commit()
    return gid


def set_group_status(group_id: int, status: str) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE tournament_groups SET status=%s, updated_at=NOW() WHERE id=%s",
                (status, group_id),
            )
        conn.commit()


def set_group_current_round(group_id: int, current_round: int) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE tournament_groups SET current_round=%s, updated_at=NOW() WHERE id=%s",
                (current_round, group_id),
            )
        conn.commit()


def add_group_member(group_id: int, tg_user_id: int, seat: int) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tournament_group_members(group_id, tg_user_id, seat)
                VALUES (%s, %s, %s)
                ON CONFLICT (group_id, tg_user_id) DO NOTHING
                """,
                (group_id, tg_user_id, seat),
            )
        conn.commit()


def list_group_members(group_id: int) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT tg_user_id, seat, points, matches_played, wins, draws, losses, rank, advanced, eliminated
                FROM tournament_group_members
                WHERE group_id=%s
                ORDER BY seat ASC
                """,
                (group_id,),
            )
            return cur.fetchall() or []


def get_group_by_user(stage_id: int, tg_user_id: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT g.*
                FROM tournament_groups g
                JOIN tournament_group_members m ON m.group_id = g.id
                WHERE g.stage_id=%s AND m.tg_user_id=%s
                """,
                (stage_id, tg_user_id),
            )
            return cur.fetchone()


def list_stage_groups(stage_id: int) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT *
                FROM tournament_groups
                WHERE stage_id=%s
                ORDER BY group_no ASC
                """,
                (stage_id,),
            )
            return cur.fetchall() or []


# ---------------------------
# Matches + games
# ---------------------------

def create_group_match(
    group_id: int,
    match_kind: str,
    tiebreak_no: int,
    round_no: int,
    p1_tg_user_id: int,
    p2_tg_user_id: int,
    series_total: int,
) -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tournament_group_matches(
                  group_id, match_kind, tiebreak_no, round_no,
                  p1_tg_user_id, p2_tg_user_id,
                  status, series_games_total, updated_at
                )
                VALUES (%s,%s,%s,%s,%s,%s,'waiting',%s,NOW())
                RETURNING id
                """,
                (group_id, match_kind, tiebreak_no, round_no, p1_tg_user_id, p2_tg_user_id, series_total),
            )
            mid = int(cur.fetchone()["id"])
        conn.commit()
    return mid


def list_round_matches(group_id: int, match_kind: str, tiebreak_no: int, round_no: int) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT *
                FROM tournament_group_matches
                WHERE group_id=%s AND match_kind=%s AND tiebreak_no=%s AND round_no=%s
                ORDER BY id ASC
                """,
                (group_id, match_kind, tiebreak_no, round_no),
            )
            return cur.fetchall() or []


def find_user_match_in_round(group_id: int, match_kind: str, tiebreak_no: int, round_no: int, tg_user_id: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT *
                FROM tournament_group_matches
                WHERE group_id=%s AND match_kind=%s AND tiebreak_no=%s AND round_no=%s
                  AND (p1_tg_user_id=%s OR p2_tg_user_id=%s)
                LIMIT 1
                """,
                (group_id, match_kind, tiebreak_no, round_no, tg_user_id, tg_user_id),
            )
            return cur.fetchone()


def count_unfinished_matches(group_id: int, match_kind: str, tiebreak_no: int) -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS c
                FROM tournament_group_matches
                WHERE group_id=%s AND match_kind=%s AND tiebreak_no=%s AND status!='finished'
                """,
                (group_id, match_kind, tiebreak_no),
            )
            return int(cur.fetchone()["c"])


def set_match_status(match_id: int, status: str) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE tournament_group_matches SET status=%s, updated_at=NOW() WHERE id=%s",
                (status, match_id),
            )
        conn.commit()


def get_match(match_id: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM tournament_group_matches WHERE id=%s", (match_id,))
            return cur.fetchone()


def get_latest_game(match_id: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT *
                FROM tournament_match_games
                WHERE match_id=%s
                ORDER BY game_no DESC
                LIMIT 1
                """,
                (match_id,),
            )
            return cur.fetchone()


def get_game(match_id: int, game_no: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM tournament_match_games WHERE match_id=%s AND game_no=%s",
                (match_id, game_no),
            )
            return cur.fetchone()


def upsert_game_move(match_id: int, game_no: int, as_p1: bool, move: str) -> None:
    col = "p1_move" if as_p1 else "p2_move"
    with get_conn() as conn:
        with conn.cursor() as cur:
            # створимо рядок якщо його нема
            cur.execute(
                """
                INSERT INTO tournament_match_games(match_id, game_no)
                VALUES (%s, %s)
                ON CONFLICT (match_id, game_no) DO NOTHING
                """,
                (match_id, game_no),
            )
            # виставимо хід якщо ще не виставлений
            cur.execute(
                f"""
                UPDATE tournament_match_games
                SET {col}=%s
                WHERE match_id=%s AND game_no=%s AND {col} IS NULL
                """,
                (move, match_id, game_no),
            )
        conn.commit()


def set_game_result(match_id: int, game_no: int, result: str, p1_points: int, p2_points: int) -> bool:
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


def apply_match_progress(
    match_id: int,
    add_games_played: int,
    add_p1_points: int,
    add_p2_points: int,
) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tournament_group_matches
                SET games_played = games_played + %s,
                    p1_series_points = p1_series_points + %s,
                    p2_series_points = p2_series_points + %s,
                    updated_at = NOW()
                WHERE id=%s
                """,
                (add_games_played, add_p1_points, add_p2_points, match_id),
            )
        conn.commit()


def finish_match(match_id: int, winner_tg_user_id: int | None) -> bool:
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


def apply_member_match_result(
    group_id: int,
    p1: int,
    p2: int,
    p1_series_points: int,
    p2_series_points: int,
    winner: int | None,
) -> None:
    # апдейт points + W/D/L + matches_played
    def upd(tg_user_id: int, add_points: int, w: int, d: int, l: int):
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE tournament_group_members
                    SET points = points + %s,
                        matches_played = matches_played + 1,
                        wins = wins + %s,
                        draws = draws + %s,
                        losses = losses + %s
                    WHERE group_id=%s AND tg_user_id=%s
                    """,
                    (add_points, w, d, l, group_id, tg_user_id),
                )
            conn.commit()

    if winner is None:
        upd(p1, p1_series_points, 0, 1, 0)
        upd(p2, p2_series_points, 0, 1, 0)
    elif winner == p1:
        upd(p1, p1_series_points, 1, 0, 0)
        upd(p2, p2_series_points, 0, 0, 1)
    else:
        upd(p1, p1_series_points, 0, 0, 1)
        upd(p2, p2_series_points, 1, 0, 0)

def get_user_latest_stage(tournament_id: int, tg_user_id: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.*
                FROM tournament_stages s
                WHERE s.tournament_id=%s
                  AND (
                    EXISTS (
                      SELECT 1 FROM tournament_stage_players sp
                      WHERE sp.stage_id=s.id AND sp.tg_user_id=%s
                    )
                    OR EXISTS (
                      SELECT 1
                      FROM tournament_groups g
                      JOIN tournament_group_members m ON m.group_id=g.id
                      WHERE g.stage_id=s.id AND m.tg_user_id=%s
                    )
                  )
                ORDER BY s.stage_no DESC
                LIMIT 1
                """,
                (tournament_id, tg_user_id, tg_user_id),
            )
            return cur.fetchone()


def set_member_ranks(group_id: int, ordered_tg_ids: list[int], advanced_top: int = 2) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            for idx, tg in enumerate(ordered_tg_ids, start=1):
                adv = idx <= advanced_top
                elim = not adv
                cur.execute(
                    """
                    UPDATE tournament_group_members
                    SET rank=%s, advanced=%s, eliminated=%s
                    WHERE group_id=%s AND tg_user_id=%s
                    """,
                    (idx, adv, elim, group_id, tg),
                )
        conn.commit()


def get_advanced_players(stage_id: int) -> list[int]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT m.tg_user_id
                FROM tournament_groups g
                JOIN tournament_group_members m ON m.group_id = g.id
                WHERE g.stage_id=%s AND m.advanced = TRUE
                ORDER BY m.tg_user_id ASC
                """,
                (stage_id,),
            )
            rows = cur.fetchall() or []
            return [int(r["tg_user_id"]) for r in rows]
