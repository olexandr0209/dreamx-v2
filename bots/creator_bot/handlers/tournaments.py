# bots/creator_bot/handlers/tournaments.py

import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.state import StatesGroup, State
from aiogram.fsm.context import FSMContext

from bots.common.db import fetch_one, fetch_all, execute
from bots.common.settings import snapshot_tournament_limits
from ..keyboards import (
    kb_main, kb_cancel, kb_desc_skip, kb_access_type, kb_private_code,
    kb_start_mode, kb_delay_pick, kb_confirm_create, kb_tournament_actions
)
from .start import is_creator_or_admin

router = Router()

APP_TZ = os.getenv("APP_TZ", "Europe/Berlin")
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()

class CreateTournament(StatesGroup):
    title = State()
    description = State()
    prize = State()
    access = State()
    private_code = State()
    start_mode = State()
    start_datetime = State()
    confirm = State()

def _clean_text(s: str, max_len: int) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    if len(s) > max_len:
        s = s[:max_len].strip()
    return s

def _gen_join_code() -> str:
    # 6 символів, без плутанини
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(6))

def _parse_datetime_local_to_utc(s: str) -> datetime | None:
    """
    Приймає 'YYYY-MM-DD HH:MM' у APP_TZ і повертає UTC datetime
    """
    s = s.strip()
    try:
        dt = datetime.strptime(s, "%Y-%m-%d %H:%M")
    except:
        return None
    try:
        tz = ZoneInfo(APP_TZ)
    except:
        tz = timezone.utc
    dt_local = dt.replace(tzinfo=tz)
    return dt_local.astimezone(timezone.utc)

def _format_preview(data: dict) -> str:
    maxp = data.get("max_participants")
    chat_enabled = data.get("chat_enabled")

    access_type = data.get("access_type")
    join_code = data.get("join_code")

    start_mode = data.get("start_mode")
    start_at_utc = data.get("start_at_utc")
    delay_sec = data.get("start_delay_sec")

    if start_mode == "datetime":
        start_line = f"📅 Старт: {start_at_utc} (UTC)"
    else:
        start_line = f"⏱ Старт через: {delay_sec} сек (запланований start_at в UTC)"

    access_line = "🌐 Публічний" if access_type == "public" else f"🔒 Приватний (код: {join_code})"

    return (
        "🧾 Підтверди створення турніру:\n\n"
        f"🏷 Назва: {data.get('title')}\n"
        f"📝 Опис: {data.get('description') or '—'}\n"
        f"🎁 Приз: {data.get('prize')}\n"
        f"{access_line}\n"
        f"{start_line}\n\n"
        f"👥 max participants (snapshot): {maxp}\n"
        f"💬 чат (snapshot): {'ON ✅' if chat_enabled else 'OFF ❌'}\n"
    )

@router.callback_query(F.data == "t:create")
async def create_start(c: CallbackQuery, state: FSMContext):
    if not is_creator_or_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    await state.clear()
    await state.set_state(CreateTournament.title)
    await c.message.edit_text("Введи назву турніру (3–80 символів):", reply_markup=kb_cancel())
    await c.answer()

@router.message(CreateTournament.title)
async def create_title(m: Message, state: FSMContext):
    if not is_creator_or_admin(m.from_user.id):
        await m.answer("⛔️ Немає доступу.")
        return
    title = _clean_text(m.text, 80)
    if len(title) < 3:
        await m.answer("❌ Назва занадто коротка. Спробуй ще раз:", reply_markup=kb_cancel())
        return
    await state.update_data(title=title)
    await state.set_state(CreateTournament.description)
    await m.answer("Введи опис/умови (або натисни “Пропустити”):", reply_markup=kb_desc_skip())

@router.callback_query(F.data == "t:skip_desc", CreateTournament.description)
async def skip_desc(c: CallbackQuery, state: FSMContext):
    await state.update_data(description="")
    await state.set_state(CreateTournament.prize)
    await c.message.edit_text("Введи приз (обовʼязково):", reply_markup=kb_cancel())
    await c.answer()

@router.message(CreateTournament.description)
async def create_desc(m: Message, state: FSMContext):
    desc = _clean_text(m.text, 500)
    await state.update_data(description=desc)
    await state.set_state(CreateTournament.prize)
    await m.answer("Введи приз (обовʼязково):", reply_markup=kb_cancel())

@router.message(CreateTournament.prize)
async def create_prize(m: Message, state: FSMContext):
    prize = _clean_text(m.text, 120)
    if len(prize) < 2:
        await m.answer("❌ Приз занадто короткий. Спробуй ще раз:", reply_markup=kb_cancel())
        return
    await state.update_data(prize=prize)
    await state.set_state(CreateTournament.access)
    await m.answer("Тип доступу:", reply_markup=kb_access_type())

@router.callback_query(F.data.startswith("t:access:"), CreateTournament.access)
async def pick_access(c: CallbackQuery, state: FSMContext):
    access = c.data.split(":")[-1]
    if access not in ("public", "private"):
        await c.answer("bad access", show_alert=True)
        return

    await state.update_data(access_type=access)

    if access == "public":
        await state.update_data(join_code=None)
        await state.set_state(CreateTournament.start_mode)
        await c.message.edit_text("Обери режим старту:", reply_markup=kb_start_mode())
        await c.answer()
        return

    # private
    await state.set_state(CreateTournament.private_code)
    await c.message.edit_text("Приватний турнір: як зробимо код доступу?", reply_markup=kb_private_code())
    await c.answer()

@router.callback_query(F.data == "t:code:auto", CreateTournament.private_code)
async def private_code_auto(c: CallbackQuery, state: FSMContext):
    code = _gen_join_code()
    await state.update_data(join_code=code)
    await state.set_state(CreateTournament.start_mode)
    await c.message.edit_text(f"Код: **{code}**\n\nОбери режим старту:", reply_markup=kb_start_mode(), parse_mode="Markdown")
    await c.answer()

@router.callback_query(F.data == "t:code:manual", CreateTournament.private_code)
async def private_code_manual(c: CallbackQuery, state: FSMContext):
    await c.message.edit_text("Введи свій код (6–12 символів, A-Z/0-9):", reply_markup=kb_cancel())
    await c.answer()

@router.message(CreateTournament.private_code)
async def private_code_manual_done(m: Message, state: FSMContext):
    code = _clean_text(m.text, 12).upper()
    code = re.sub(r"[^A-Z0-9]", "", code)
    if len(code) < 6:
        await m.answer("❌ Код занадто короткий. Треба 6–12 символів A-Z/0-9:", reply_markup=kb_cancel())
        return
    await state.update_data(join_code=code)
    await state.set_state(CreateTournament.start_mode)
    await m.answer(f"Код: {code}\n\nОбери режим старту:", reply_markup=kb_start_mode())

@router.callback_query(F.data.startswith("t:startmode:"), CreateTournament.start_mode)
async def pick_start_mode(c: CallbackQuery, state: FSMContext):
    mode = c.data.split(":")[-1]
    if mode == "datetime":
        await state.update_data(start_mode="datetime")
        await state.set_state(CreateTournament.start_datetime)
        await c.message.edit_text(
            f"Введи дату і час старту у форматі:\n`YYYY-MM-DD HH:MM`\n\nTZ: {APP_TZ}\nНапр: `2025-12-20 19:30`",
            reply_markup=kb_cancel(),
            parse_mode="Markdown",
        )
        await c.answer()
        return

    if mode == "delay":
        await state.update_data(start_mode="delay")
        await c.message.edit_text("Обери таймер старту:", reply_markup=kb_delay_pick())
        await c.answer()
        return

    await c.answer("bad mode", show_alert=True)

@router.callback_query(F.data.startswith("t:delay:"), CreateTournament.start_mode)
async def pick_delay(c: CallbackQuery, state: FSMContext):
    try:
        sec = int(c.data.split(":")[-1])
    except:
        await c.answer("bad delay", show_alert=True)
        return

    if sec not in (300, 60, 30, 5):
        await c.answer("bad delay", show_alert=True)
        return

    now_utc = datetime.now(timezone.utc)
    start_at = now_utc + timedelta(seconds=sec)

    await state.update_data(start_delay_sec=sec, start_at_utc=start_at.isoformat())
    await _go_confirm(c, state)

@router.message(CreateTournament.start_datetime)
async def datetime_done(m: Message, state: FSMContext):
    dt_utc = _parse_datetime_local_to_utc(m.text or "")
    if not dt_utc:
        await m.answer("❌ Невірний формат. Треба `YYYY-MM-DD HH:MM`:", reply_markup=kb_cancel(), parse_mode="Markdown")
        return

    if dt_utc < datetime.now(timezone.utc) + timedelta(seconds=10):
        await m.answer("❌ Час старту має бути в майбутньому (хоча б +10 сек). Спробуй ще раз:", reply_markup=kb_cancel())
        return

    await state.update_data(start_at_utc=dt_utc.isoformat(), start_delay_sec=None)
    # перехід до confirm через message:
    data = await state.get_data()
    maxp, chat_enabled = snapshot_tournament_limits()
    await state.update_data(max_participants=maxp, chat_enabled=chat_enabled)

    preview = _format_preview({**data, "max_participants": maxp, "chat_enabled": chat_enabled})
    await state.set_state(CreateTournament.confirm)
    await m.answer(preview, reply_markup=kb_confirm_create())

async def _go_confirm(c: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    maxp, chat_enabled = snapshot_tournament_limits()
    await state.update_data(max_participants=maxp, chat_enabled=chat_enabled)

    preview = _format_preview({**data, "max_participants": maxp, "chat_enabled": chat_enabled})
    await state.set_state(CreateTournament.confirm)
    await c.message.edit_text(preview, reply_markup=kb_confirm_create())
    await c.answer()

@router.callback_query(F.data == "t:confirm_create", CreateTournament.confirm)
async def confirm_create(c: CallbackQuery, state: FSMContext):
    if not is_creator_or_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return

    data = await state.get_data()

    title = data["title"]
    description = data.get("description") or None
    prize = data["prize"]
    access_type = data.get("access_type", "public")
    join_code = data.get("join_code")

    start_mode = data.get("start_mode")
    start_at_utc = data.get("start_at_utc")
    start_delay_sec = data.get("start_delay_sec")

    max_participants = int(data.get("max_participants", 64))
    chat_enabled = bool(data.get("chat_enabled", False))

    # ✅ NEW: гарантуємо join_code для будь-якого турніру (і public теж)
    if not join_code:
        code = _gen_join_code()
        while fetch_one("SELECT 1 FROM tournaments WHERE join_code=%s", (code,)):
            code = _gen_join_code()
        join_code = code

    # створюємо турнір
    execute(
        """
        INSERT INTO tournaments(
          created_by_tg, title, description, prize,
          access_type, join_code,
          start_mode, start_at, start_delay_sec,
          max_participants, chat_enabled,
          status, created_at, updated_at
        )
        VALUES (
          %s, %s, %s, %s,
          %s, %s,
          %s, %s, %s,
          %s, %s,
          'draft', NOW(), NOW()
        )
        """,
        (
            c.from_user.id, title, description, prize,
            access_type, join_code,
            start_mode, start_at_utc, start_delay_sec,
            max_participants, chat_enabled,
        ),
    )

    row = fetch_one(
        "SELECT id FROM tournaments WHERE created_by_tg=%s ORDER BY id DESC LIMIT 1",
        (c.from_user.id,),
    )
    tid = int(row["id"])

    await state.clear()
    await c.message.edit_text(
        f"✅ Турнір створено!\nID: {tid}\nСтатус: draft\n\nДалі можеш відкрити реєстрацію або взяти посилання.",
        reply_markup=kb_tournament_actions(tid),
    )
    await c.answer("Created ✅")

@router.callback_query(F.data.startswith("t:open:"))
async def open_registration(c: CallbackQuery):
    if not is_creator_or_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    tid = int(c.data.split(":")[-1])

    # safety: тільки власник або адмін може змінювати
    row = fetch_one("SELECT created_by_tg, status FROM tournaments WHERE id=%s", (tid,))
    if not row:
        await c.answer("not found", show_alert=True)
        return
    if row["created_by_tg"] != c.from_user.id and c.from_user.id not in set(map(int, os.getenv("ADMIN_IDS","").split(",") if os.getenv("ADMIN_IDS") else [])):
        await c.answer("No access", show_alert=True)
        return

    execute("UPDATE tournaments SET status='open', updated_at=NOW() WHERE id=%s", (tid,))
    await c.answer("Реєстрація відкрита ✅", show_alert=True)

@router.callback_query(F.data.startswith("t:close:"))
async def close_registration(c: CallbackQuery):
    if not is_creator_or_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    tid = int(c.data.split(":")[-1])

    row = fetch_one("SELECT created_by_tg, status FROM tournaments WHERE id=%s", (tid,))
    if not row:
        await c.answer("not found", show_alert=True)
        return

    execute("UPDATE tournaments SET status='draft', updated_at=NOW() WHERE id=%s", (tid,))
    await c.answer("Реєстрацію закрито ✅", show_alert=True)

@router.callback_query(F.data.startswith("t:link:"))
async def tournament_link(c: CallbackQuery):
    if not is_creator_or_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return
    tid = int(c.data.split(":")[-1])

    row = fetch_one(
        "SELECT id, access_type, join_code FROM tournaments WHERE id=%s",
        (tid,),
    )
    if not row:
        await c.answer("not found", show_alert=True)
        return

    # ✅ NEW: якщо раптом у старого турніру пустий join_code — згенерувати та зберегти
    join_code = row.get("join_code")
    if not join_code:
        code = _gen_join_code()
        while fetch_one("SELECT 1 FROM tournaments WHERE join_code=%s", (code,)):
            code = _gen_join_code()
        execute("UPDATE tournaments SET join_code=%s, updated_at=NOW() WHERE id=%s", (code, tid))
        join_code = code

    if WEBAPP_URL:
        # ✅ NEW: тепер лінк не по id, а по tagid=join_code
        link = f"{WEBAPP_URL}?tagid={join_code}"
    else:
        link = "(WEBAPP_URL не заданий у ENV)"

    extra = ""
    if row["access_type"] == "private":
        extra = f"\n🔒 Код: {join_code}"

    await c.message.edit_text(
        f"🔗 Посилання для гравців:\n{link}{extra}\n\n(Гравці відкривають WebApp і приєднуються до турніру.)",
        reply_markup=kb_tournament_actions(tid),
    )
    await c.answer()

@router.callback_query(F.data == "t:mine")
async def my_tournaments(c: CallbackQuery):
    if not is_creator_or_admin(c.from_user.id):
        await c.answer("No access", show_alert=True)
        return

    rows = fetch_all(
        """
        SELECT id, title, status, access_type, start_mode, start_at
        FROM tournaments
        WHERE created_by_tg=%s
        ORDER BY id DESC
        LIMIT 10
        """,
        (c.from_user.id,),
    )

    if not rows:
        await c.message.edit_text("У тебе ще нема турнірів.", reply_markup=kb_main())
        await c.answer()
        return

    lines = ["📋 Останні турніри:"]
    for r in rows:
        lines.append(f"• #{r['id']} — {r['title']} [{r['status']}] ({r['access_type']})")

    await c.message.edit_text("\n".join(lines), reply_markup=kb_main())
    await c.answer()
