from aiogram.utils.keyboard import InlineKeyboardBuilder

def kb_main():
    kb = InlineKeyboardBuilder()
    kb.button(text="👤 Creators", callback_data="creators:menu")
    kb.button(text="⚙️ Settings", callback_data="settings:menu")
    kb.adjust(2)
    return kb.as_markup()

def kb_creators_menu():
    kb = InlineKeyboardBuilder()
    kb.button(text="📋 Список", callback_data="creators:list")
    kb.button(text="➕ Додати", callback_data="creators:add")
    kb.button(text="➖ Видалити", callback_data="creators:remove")
    kb.button(text="⬅️ Назад", callback_data="nav:home")
    kb.adjust(2, 1, 1)
    return kb.as_markup()

def kb_settings_menu(giveaways_enabled: bool, max_participants: int, chat_enabled: bool):
    kb = InlineKeyboardBuilder()

    kb.button(
        text=f"🎁 Розіграші: {'ON ✅' if giveaways_enabled else 'OFF ❌'}",
        callback_data="settings:toggle_giveaways",
    )

    kb.button(
        text=f"👥 Макс учасників: {max_participants}",
        callback_data="settings:set_max",
    )

    kb.button(
        text=f"💬 Чат під час гри: {'ON ✅' if chat_enabled else 'OFF ❌'}",
        callback_data="settings:toggle_chat",
    )

    kb.button(text="⬅️ Назад", callback_data="nav:home")
    kb.adjust(1, 1, 1, 1)
    return kb.as_markup()

def kb_cancel():
    kb = InlineKeyboardBuilder()
    kb.button(text="❌ Скасувати", callback_data="nav:home")
    return kb.as_markup()
