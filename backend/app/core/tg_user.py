# backend/app/core/tg_user.py
from __future__ import annotations

from flask import request


HEADER_TG_USER_ID = "X-Tg-User-Id"
QUERY_TG_USER_ID = "tg_user_id"


def get_tg_user_id() -> int | None:
    """
    ЄДИНЕ ДЖЕРЕЛО ПРАВДИ:
    беремо tg_user_id або з header, або з query
    """
    raw = request.headers.get(HEADER_TG_USER_ID) or request.args.get(QUERY_TG_USER_ID)
    if not raw:
        return None
    try:
        return int(raw)
    except Exception:
        return None
