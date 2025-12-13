#

from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
import requests
import os

router = Router()

API_BASE = os.getenv("API_BASE_URL", "https://dreamx-v2.onrender.com")
WEBAPP_URL = os.getenv(
    "WEBAPP_URL",
    "https://dreamx-v2-webapp.onrender.com"
)


@router.message(Command("start"))
async def start_handler(message: Message):
    user = message.from_user

    payload = {
        "tg_user_id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "language_code": user.language_code,
        "photo_url": None,  # поки тільки збереження посилання -> але ми його не тягнемо зараз
    }

    try:
        r = requests.post(f"{API_BASE}/players/upsert", json=payload, timeout=8)
        data = r.json()
    except Exception:
        await message.answer("⚠️ Сервер тимчасово недоступний. Спробуй ще раз.")
        return

    if r.status_code != 200 or not data.get("ok"):
        await message.answer("⚠️ Помилка створення профілю")
        return

    kb = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🚀 Відкрити DreamX", web_app=WebAppInfo(url=WEBAPP_URL))]
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="Натисни кнопку нижче",
    )

    await message.answer(
        "👋 Вітаю у DreamX!\n\nНатисни кнопку нижче, щоб відкрити гру.",
        reply_markup=kb
    )
