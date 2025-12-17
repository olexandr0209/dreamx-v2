

from aiogram import Router, F
from aiogram.types import CallbackQuery, Message
from aiogram.fsm.state import StatesGroup, State
from aiogram.fsm.context import FSMContext

from bots.common.db import fetch_all, fetch_one, execute
from ..keyboards import kb_creators_menu, kb_cancel

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

class CreatorStates(StatesGroup):
    waiting_add = State()
    waiting_remove = State()

def _find_user_by_tg(tg_user_id: int):
    return fetch_one(
        "SELECT id, tg_user_id, username, first_name, last_name, is_creator FROM users WHERE tg_user_id=%s",
        (tg_user_id,),
    )

@router.callback_query(F.data == "creators:menu")
async def creators_menu(c: CallbackQuery, state: FSMContext):
    await state.clear()
    if not is_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    await c.message.edit_text("👤 Creators:", reply_markup=kb_creators_menu())
    await c.answer()

@router.callback_query(F.data == "creators:list")
async def creators_list(c: CallbackQuery):
    if not is_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    rows = fetch_all(
        "SELECT tg_user_id, username, first_name, last_name FROM users WHERE is_creator=true ORDER BY updated_at DESC NULLS LAST"
    )
    if not rows:
        text = "Creators: (порожньо)"
    else:
        lines = ["Creators:"]
        for r in rows:
            name = " ".join([x for x in [r.get("first_name"), r.get("last_name")] if x]) or "-"
            uname = f"@{r['username']}" if r.get("username") else ""
            lines.append(f"• {r['tg_user_id']} {uname} {name}")
        text = "\n".join(lines)

    await c.message.edit_text(text, reply_markup=kb_creators_menu())
    await c.answer()

@router.callback_query(F.data == "creators:add")
async def creators_add_start(c: CallbackQuery, state: FSMContext):
    if not is_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    await state.set_state(CreatorStates.waiting_add)
    await c.message.edit_text("Введи tg_user_id користувача, якого зробити Creator:", reply_markup=kb_cancel())
    await c.answer()

@router.message(CreatorStates.waiting_add)
async def creators_add_done(m: Message, state: FSMContext):
    if not is_admin(m.from_user.id):
        await m.answer("⛔️ Немає доступу.")
        return
    try:
        tg_id = int((m.text or "").strip())
    except:
        await m.answer("❌ Введи число tg_user_id або ❌ Скасувати.", reply_markup=kb_cancel())
        return

    u = _find_user_by_tg(tg_id)
    if not u:
        await m.answer("❌ Користувача нема в таблиці users. Він має хоч раз зайти в DreamX, щоб створився профіль.", reply_markup=kb_creators_menu())
        await state.clear()
        return

    execute("UPDATE users SET is_creator=true, updated_at=NOW() WHERE tg_user_id=%s", (tg_id,))
    await state.clear()
    await m.answer("✅ Готово. Додано в Creators.", reply_markup=kb_creators_menu())

@router.callback_query(F.data == "creators:remove")
async def creators_remove_start(c: CallbackQuery, state: FSMContext):
    if not is_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    await state.set_state(CreatorStates.waiting_remove)
    await c.message.edit_text("Введи tg_user_id Creator-а, якого прибрати:", reply_markup=kb_cancel())
    await c.answer()

@router.message(CreatorStates.waiting_remove)
async def creators_remove_done(m: Message, state: FSMContext):
    if not is_admin(m.from_user.id):
        await m.answer("⛔️ Немає доступу.")
        return
    try:
        tg_id = int((m.text or "").strip())
    except:
        await m.answer("❌ Введи число tg_user_id або ❌ Скасувати.", reply_markup=kb_cancel())
        return

    execute("UPDATE users SET is_creator=false, updated_at=NOW() WHERE tg_user_id=%s", (tg_id,))
    await state.clear()
    await m.answer("✅ Готово. Прибрано з Creators.", reply_markup=kb_creators_menu())
