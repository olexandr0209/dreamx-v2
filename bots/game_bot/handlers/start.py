import os
import requests

API_BASE = os.getenv("API_BASE", "https://dreamx-v2.onrender.com")  # або твій URL

def sync_user_start(tg_user):
    payload = {
        "tg_user_id": tg_user.id,
        "username": tg_user.username,
        "first_name": tg_user.first_name,
        "last_name": tg_user.last_name,
        "language_code": getattr(tg_user, "language_code", None),
        "photo_url": None,
    }
    try:
        requests.post(f"{API_BASE}/users/start", json=payload, timeout=10)
    except Exception:
        pass  # /start не має падати через backend

