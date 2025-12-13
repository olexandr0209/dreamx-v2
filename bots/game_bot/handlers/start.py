from aiogram import Router
from aiogram.types import Message
import requests
import os

router = Router()

API_BASE = os.getenv("API_BASE_URL", "https://dreamx-v2.onrender.com")

@router.message(Command("start"))
async def start_handler(message: Message):
    user = message.from_user

    payload = {
        "tg_user_id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "language_code": user.language_code,
        "photo_url": None,
    }

    r = requests.post(f"{API_BASE}/players/upsert", json=payload, timeout=5)

    if r.status_code != 200:
        await message.answer("⚠️ Помилка створення профілю")
        return

    await message.answer(
        "👋 Вітаю у DreamX\n\n"
        "Твій профіль створено. Скоро почнемо гру."
    )
