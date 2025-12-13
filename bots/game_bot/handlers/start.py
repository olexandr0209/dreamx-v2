from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command
import requests
import os

router = Router()

API_BASE = os.getenv("API_BASE_URL", "https://dreamx-v2.onrender.com")


@router.message(Command("start"))
async def start_handler(message: Message):
    user = message.from_user

    photo_file_id = None

    # Беремо останнє (найсвіжіше) фото профілю
    photos = await message.bot.get_user_profile_photos(user_id=user.id, limit=1)

    if photos.total_count > 0 and photos.photos:
        # photos.photos[0] — список розмірів одного фото (small -> big)
        # беремо найбільший розмір (останній)
        largest_photo = photos.photos[0][-1]
        photo_file_id = largest_photo.file_id

    payload = {
        "tg_user_id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "language_code": user.language_code,
        "photo_url": photo_file_id,  # тут зберігаємо file_id
    }

    r = requests.post(f"{API_BASE}/players/upsert", json=payload, timeout=10)

    if r.status_code != 200:
        await message.answer("⚠️ Помилка створення профілю")
        return

    await message.answer(
        "👋 Вітаю у DreamX\n\n"
        "Твій профіль створено. Скоро почнемо гру."
    )
