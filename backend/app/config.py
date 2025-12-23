import os

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
APP_ENV = os.getenv("APP_ENV", "dev").strip()
PORT = int(os.getenv("PORT", "10000"))

# Якщо ще без БД — став у Render/локально APP_USE_DB=0
APP_USE_DB = os.getenv("APP_USE_DB", "1").strip() == "1"

# Telegram WebApp auth
TELEGRAM_BOT_TOKEN = (
    os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    or os.getenv("BOT_TOKEN", "").strip()
    or os.getenv("BOT_TOKEN_PROD", "").strip()
)

# optional: скільки живе initData (сек). 86400 = 24h
TG_WEBAPP_MAX_AGE_SEC = int(os.getenv("TG_WEBAPP_MAX_AGE_SEC", "86400"))
