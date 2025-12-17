from bots.common.db import fetch_one, execute

def get_setting(key: str, default: str) -> str:
    row = fetch_one("SELECT value FROM app_settings WHERE key=%s", (key,))
    return row["value"] if row else default

def set_setting_if_missing(key: str, value: str):
    execute(
        """
        INSERT INTO app_settings(key, value, updated_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (key) DO NOTHING
        """,
        (key, value),
    )

def get_bool(key: str, default: bool) -> bool:
    v = get_setting(key, "true" if default else "false").strip().lower()
    return v in ("1", "true", "yes", "y", "on")

def get_int(key: str, default: int) -> int:
    v = get_setting(key, str(default)).strip()
    try:
        return int(v)
    except:
        return default

def snapshot_tournament_limits():
    # MVP: беремо існуючий giveaway_max_participants як max для турніру
    maxp = get_int("giveaway_max_participants", 64)
    chat_enabled = get_bool("chat_enabled", False)
    return maxp, chat_enabled
