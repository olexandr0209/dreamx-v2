# keyboards.py

from aiogram.utils.keyboard import InlineKeyboardBuilder

def kb_main():
    kb = InlineKeyboardBuilder()
    kb.button(text="➕ Створити турнір", callback_data="t:create")
    kb.button(text="📋 Мої турніри", callback_data="t:mine")
    kb.button(text="ℹ️ Ліміти/чат (з адмінки)", callback_data="t:limits")
    kb.adjust(1, 1, 1)
    return kb.as_markup()

def kb_cancel():
    kb = InlineKeyboardBuilder()
    kb.button(text="❌ Скасувати", callback_data="nav:home")
    return kb.as_markup()

def kb_desc_skip():
    kb = InlineKeyboardBuilder()
    kb.button(text="⏭ Пропустити опис", callback_data="t:skip_desc")
    kb.button(text="❌ Скасувати", callback_data="nav:home")
    kb.adjust(1, 1)
    return kb.as_markup()

def kb_access_type():
    kb = InlineKeyboardBuilder()
    kb.button(text="🌐 Публічний", callback_data="t:access:public")
    kb.button(text="🔒 Приватний", callback_data="t:access:private")
    kb.button(text="❌ Скасувати", callback_data="nav:home")
    kb.adjust(2, 1)
    return kb.as_markup()

def kb_private_code():
    kb = InlineKeyboardBuilder()
    kb.button(text="🔁 Згенерувати код", callback_data="t:code:auto")
    kb.button(text="⌨️ Ввести свій код", callback_data="t:code:manual")
    kb.button(text="❌ Скасувати", callback_data="nav:home")
    kb.adjust(1, 1, 1)
    return kb.as_markup()

def kb_start_mode():
    kb = InlineKeyboardBuilder()
    kb.button(text="📅 Дата і час", callback_data="t:startmode:datetime")
    kb.button(text="⏱ Таймер (5хв/1хв/30с/5с)", callback_data="t:startmode:delay")
    kb.button(text="❌ Скасувати", callback_data="nav:home")
    kb.adjust(1, 1, 1)
    return kb.as_markup()

def kb_delay_pick():
    kb = InlineKeyboardBuilder()
    kb.button(text="5 хв", callback_data="t:delay:300")
    kb.button(text="1 хв", callback_data="t:delay:60")
    kb.button(text="30 сек", callback_data="t:delay:30")
    kb.button(text="5 сек", callback_data="t:delay:5")
    kb.button(text="❌ Скасувати", callback_data="nav:home")
    kb.adjust(2, 2, 1)
    return kb.as_markup()

def kb_confirm_create():
    kb = InlineKeyboardBuilder()
    kb.button(text="✅ Створити", callback_data="t:confirm_create")
    kb.button(text="❌ Скасувати", callback_data="nav:home")
    kb.adjust(1, 1)
    return kb.as_markup()

def kb_tournament_actions(tournament_id: int):
    kb = InlineKeyboardBuilder()
    kb.button(text="🟢 Відкрити реєстрацію", callback_data=f"t:open:{tournament_id}")
    kb.button(text="🔴 Закрити реєстрацію", callback_data=f"t:close:{tournament_id}")
    kb.button(text="🔗 Посилання", callback_data=f"t:link:{tournament_id}")
    kb.button(text="⬅️ Назад", callback_data="nav:home")
    kb.adjust(1, 1, 1, 1)
    return kb.as_markup()
