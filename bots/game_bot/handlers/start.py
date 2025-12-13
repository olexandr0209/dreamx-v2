from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command
import requests
import os

router = Router()

API_BASE = os.getenv("API_BASE_URL", "https://dreamx-v2.onrender.com")
BOT_TOKEN = os.getenv("BOT_TOKEN")  # має бути в Render env


def _tg_file_url(file_path: str) -> str:
    return f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"


def get_latest_profile_photo_url(tg_user_id: int) -> str | None:
    """
    Бере тільки ОСТАННЄ фото профілю (найновіше),
    і всередині нього — найбільший size.
    Якщо фото нема (або токен не заданий) -> None.
    """
    if not BOT_TOKEN:
        return None

    try:
        # 1) беремо 1 останнє фото (limit=1). Відповідь: photos: [[PhotoSize, PhotoSize...]]
        resp = requests.get(
            f"https://api.telegram.org/bot{BOT_TOKEN}/getUserProfilePhotos",
            params={"user_id": tg_user_id, "limit": 1},
            timeout=5,
        )
        data = resp.json()
        if not data.get("ok") or data.get("total_count", 0) == 0:
            return None

        photos = data["result"]["photos"]
        if not photos or not photos[0]:
            return None

        # найбільший розмір — останній елемент
        file_id = photos[0][-1]["file_id"]

        # 2) getFile -> file_path
        resp2 = requests.get(
            f"https://api.telegram.org/bot{BOT_TOKEN}/getFile",
            params={"file_id": file_id},
            timeout=5,
        )
        data2 = resp2.json()
        if not data2.get("ok"):
            return None

        file_path = data2["result"]["file_path"]
        return _tg_file_url(file_path)

    except Exception:
        return None


@router.message(Command("start"))
async def start_handler(message: Message):
    user = message.from_user

    photo_url = get_latest_profile_photo_url(user.id)

    payload = {
        "tg_user_id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "language_code": user.language_code,
        "photo_url": photo_url,  # ✅ збережемо в БД
    }

    r = requests.post(f"{API_BASE}/players/upsert", json=payload, timeout=10)

    if r.status_code != 200:
        await message.answer("⚠️ Помилка створення профілю")
        return

    await message.answer(
        "👋 Вітаю у DreamX\n\n"
        "Твій профіль створено. Скоро почнемо гру."
    )
