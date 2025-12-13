from bots.common.api_client import upsert_user_on_start

async def start_handler(message):
    data = upsert_user_on_start(message.from_user)

    if not data.get("ok"):
        await message.answer(f"❌ Не вдалося створити профіль: {data.get('error')}")
        return

    user = data["user"]
    await message.answer(
        f"👋 Вітаю, {user.get('first_name') or ''}!\n"
        f"✅ Профіль створено.\n"
        f"ID: {user['id']} | Points: {user['points']}"
    )
