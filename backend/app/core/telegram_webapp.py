from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl


def _secret_key(bot_token: str) -> bytes:
    # Telegram WebApp: secret_key = HMAC_SHA256("WebAppData", bot_token)
    return hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()


def validate_init_data(init_data: str, bot_token: str, max_age_sec: int = 86400) -> bool:
    if not init_data or not bot_token:
        return False

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    recv_hash = (pairs.get("hash") or "").strip()
    if not recv_hash:
        return False

    # (optional) freshness check
    auth_date_raw = (pairs.get("auth_date") or "").strip()
    if auth_date_raw:
        try:
            auth_date = int(auth_date_raw)
            if max_age_sec > 0 and (time.time() - auth_date) > max_age_sec:
                return False
        except Exception:
            return False

    # remove hash and build data_check_string
    pairs.pop("hash", None)
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))

    sk = _secret_key(bot_token)
    calc_hash = hmac.new(sk, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    return hmac.compare_digest(calc_hash, recv_hash)


def extract_user_id_from_init_data(init_data: str, bot_token: str, max_age_sec: int = 86400) -> int | None:
    if not validate_init_data(init_data, bot_token, max_age_sec=max_age_sec):
        return None

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    user_raw = pairs.get("user")
    if not user_raw:
        return None

    try:
        user = json.loads(user_raw)
        uid = user.get("id")
        return int(uid) if uid is not None else None
    except Exception:
        return None
