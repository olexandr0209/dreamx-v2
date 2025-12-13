import os

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
APP_ENV = os.getenv("APP_ENV", "dev").strip()
PORT = int(os.getenv("PORT", "10000"))

# Якщо ще без БД — став у Render/локально APP_USE_DB=0
APP_USE_DB = os.getenv("APP_USE_DB", "1").strip() == "1"

