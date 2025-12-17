from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.state import StatesGroup, State
from aiogram.fsm.context import FSMContext

from bots.common.db import fetch_one, execute
from ..keyboards import kb_main, kb_settings_menu, kb_cancel

import os

router = Router()

def _admin_ids():
    raw = os.getenv("ADMIN_IDS", "").strip()
    ids = set()
    for x in raw.split(","):
        x = x.strip()
        if not x:
            continue
        try:
            ids.add(int(x))
        except:
            pass
    return ids

ADMIN_IDS = _admin_ids()

def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS

def get_setting(key: str, default: str):
    row = fetch_one("SELECT value FROM app_settings WHERE key=%s", (key,))
    return row["value"] if row else default

def set_setting(key: str, value: str):
    execute(
        """
        INSERT INTO app_settings(key, value, updated_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
        """,
        (key, value),
    )

def settings_snapshot():
    enabled = get_setting("giveaways_enabled", "true").lower() == "true"
    maxp = int(get_setting("giveaway_max_participants", "64"))
    chat_enabled = get_setting("chat_enabled", "false").lower() == "true"
    return enabled, maxp, chat_enabled

class SettingsStates(StatesGroup):
    waiting_max = State()

@router.message(CommandStart())
async def start(m: Message):
    if not is_admin(m.from_user.id):
        await m.answer("⛔️ Немає доступу.")
        return
    await m.answer("DreamX Admin Bot ✅\nОбери розділ:", reply_markup=kb_main())

@router.message(Command("menu"))
async def menu(m: Message):
    if not is_admin(m.from_user.id):
        await m.answer("⛔️ Немає доступу.")
        return
    await m.answer("Меню:", reply_markup=kb_main())

@router.callback_query(F.data == "nav:home")
async def nav_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    if not is_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    await c.message.edit_text("Меню:", reply_markup=kb_main())
    await c.answer()

@router.callback_query(F.data == "settings:menu")
async def settings_menu(c: CallbackQuery):
    if not is_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    enabled, maxp, chat_enabled = settings_snapshot()
    await c.message.edit_text(
        "⚙️ Settings:",
        reply_markup=kb_settings_menu(enabled, maxp, chat_enabled)
    )
    await c.answer()

@router.callback_query(F.data == "settings:toggle_giveaways")
async def toggle_giveaways(c: CallbackQuery):
    if not is_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    enabled, maxp, chat_enabled = settings_snapshot()
    set_setting("giveaways_enabled", "false" if enabled else "true")
    enabled2, maxp2, chat2 = settings_snapshot()
    await c.message.edit_reply_markup(reply_markup=kb_settings_menu(enabled2, maxp2, chat2))
    await c.answer("Збережено ✅")

@router.callback_query(F.data == "settings:toggle_chat")
async def toggle_chat(c: CallbackQuery):
    if not is_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    enabled, maxp, chat_enabled = settings_snapshot()
    set_setting("chat_enabled", "false" if chat_enabled else "true")
    enabled2, maxp2, chat2 = settings_snapshot()
    await c.message.edit_reply_markup(reply_markup=kb_settings_menu(enabled2, maxp2, chat2))
    await c.answer("Збережено ✅")

@router.callback_query(F.data == "settings:set_max")
async def set_max_start(c: CallbackQuery, state: FSMContext):
    if not is_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    await state.set_state(SettingsStates.waiting_max)
    await c.message.edit_text(
        "Введи нове число max participants (наприклад 64):",
        reply_markup=kb_cancel(),
    )
    await c.answer()

@router.message(SettingsStates.waiting_max)
async def set_max_done(m: Message, state: FSMContext):
    if not is_admin(m.from_user.id):
        await m.answer("⛔️ Немає доступу.")
        return
    txt = (m.text or "").strip()
    try:
        n = int(txt)
        if n < 1 or n > 100000:
            raise ValueError()
    except:
        await m.answer(
            "❌ Це не число або занадто дивне значення. Спробуй ще раз або ❌ Скасувати.",
            reply_markup=kb_cancel(),
        )
        return

    set_setting("giveaway_max_participants", str(n))
    await state.clear()

    enabled, maxp, chat_enabled = settings_snapshot()
    await m.answer("✅ Збережено.", reply_markup=kb_settings_menu(enabled, maxp, chat_enabled))
