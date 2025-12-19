# bots/creator_bot/handlers/start.py

import os
from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from bots.common.db import fetch_one
from bots.common.settings import snapshot_tournament_limits
from ..keyboards import kb_main

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

def is_creator_or_admin(tg_user_id: int) -> bool:
    if tg_user_id in ADMIN_IDS:
        return True
    row = fetch_one("SELECT is_creator FROM users WHERE tg_user_id=%s", (tg_user_id,))
    return bool(row and row.get("is_creator"))

@router.message(CommandStart())
async def start(m: Message, state: FSMContext):
    await state.clear()
    if not is_creator_or_admin(m.from_user.id):
        await m.answer("⛔️ Немає доступу. Тобі має видати права адмін (is_creator=true).")
        return
    await m.answer("DreamX Creator Bot ✅\nОбери дію:", reply_markup=kb_main())

@router.message(Command("menu"))
async def menu(m: Message, state: FSMContext):
    await state.clear()
    if not is_creator_or_admin(m.from_user.id):
        await m.answer("⛔️ Немає доступу.")
        return
    await m.answer("Меню:", reply_markup=kb_main())

@router.callback_query(F.data == "nav:home")
async def nav_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    if not is_creator_or_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    await c.message.edit_text("Меню:", reply_markup=kb_main())
    await c.answer()

@router.callback_query(F.data == "t:limits")
async def show_limits(c: CallbackQuery):
    if not is_creator_or_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    maxp, chat_enabled = snapshot_tournament_limits()
    text = (
        "ℹ️ Глобальні налаштування (з адмінки):\n"
        f"• max participants: {maxp}\n"
        f"• чат під час гри: {'ON ✅' if chat_enabled else 'OFF ❌'}\n\n"
        "Ці значення бот бере автоматично і робить snapshot у турнірі."
    )
    await c.message.edit_text(text, reply_markup=kb_main())
    await c.answer()
