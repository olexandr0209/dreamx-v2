# bots/game_bot/handlers/start.py

from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
import asyncio
import requests
import os
from urllib.parse import urlencode

router = Router()

API_BASE = os.getenv("API_BASE_URL", "https://dreamx-v2.onrender.com").rstrip("/")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://dreamx-v2-webapp.onrender.com").rstrip("/")

BOT_TOKEN = os.getenv("BOT_TOKEN")  # потрібен, щоб зібрати пряме посилання на фото


async def _get_last_profile_photo_url(message: Message) -> str | None:
    """
    Повертає посилання на ОСТАННЮ профільну ФОТО (найбільший розмір) або None.
    Відео-аватар тут не тягнемо (і не завантажуємо).
    """
    if not BOT_TOKEN:
        return None

    bot = message.bot
    user_id = message.from_user.id

    photos = await bot.get_user_profile_photos(user_id=user_id, limit=1, offset=0)
    if not photos or photos.total_count == 0:
        return None

    last_photo_sizes = photos.photos[0]
    if not last_photo_sizes:
        return None

    biggest = last_photo_sizes[-1]
    file = await bot.get_file(biggest.file_id)

    if not file or not file.file_path:
        return None

    return f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file.file_path}"


async def _post_json(url: str, payload: dict, timeout: int = 8):
    """
    requests блокує event loop, тому шлемо в окремому потоці.
    """
    def _do():
        return requests.post(url, json=payload, timeout=timeout)

    return await asyncio.to_thread(_do)


@router.message(Command("start"))
async def start_handler(message: Message):
    user = message.from_user

    # 1) пробуємо отримати photo_url (тільки URL)
    try:
        photo_url = await _get_last_profile_photo_url(message)
    except Exception:
        photo_url = None

    payload = {
        "tg_user_id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "language_code": user.language_code,
        "photo_url": photo_url,
    }

    # 2) upsert в бекенд
    try:
        r = await _post_json(f"{API_BASE}/players/upsert", payload, timeout=10)
        try:
            data = r.json()
        except Exception:
            data = {}
    except Exception:
        await message.answer("⚠️ Сервер тимчасово недоступний. Спробуй ще раз.")
        return

    if r.status_code != 200 or not data.get("ok"):
        err = data.get("error") or f"HTTP {r.status_code}"
        await message.answer(f"⚠️ Помилка створення профілю: {err}")
        return

    # ✅ ГОЛОВНЕ: передаємо tg_user_id у WebApp URL (fallback для фронту)
    qs = urlencode({"tg_user_id": user.id})
    webapp_url = f"{WEBAPP_URL}/?{qs}"

    kb = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🚀 Відкрити DreamX", web_app=WebAppInfo(url=webapp_url))]
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="Натисни кнопку нижче",
    )

    await message.answer(
        "👋 Вітаю у DreamX!\n\nНатисни кнопку нижче, щоб відкрити гру.",
        reply_markup=kb
    )
