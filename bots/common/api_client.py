import requests
from .config import API_BASE

def upsert_user_on_start(tg_user) -> dict:
    payload = {
        "tg_user_id": tg_user.id,
        "username": tg_user.username,
        "first_name": tg_user.first_name,
        "last_name": tg_user.last_name,
        "language_code": getattr(tg_user, "language_code", None),
        "photo_url": None,
    }

    r = requests.post(f"{API_BASE}/users/start", json=payload, timeout=10)
    return r.json()
