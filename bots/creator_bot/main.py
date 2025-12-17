import os
import asyncio
from aiogram import Bot, Dispatcher

from .handlers import router as creator_router

def require_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"{name} is missing")
    return v

async def main():
    token = require_env("CREATOR_BOT_TOKEN")
    bot = Bot(token=token)

    dp = Dispatcher()
    dp.include_router(creator_router)

    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
