// webapp/public/src/js/dreamx_core.js

window.DreamX = window.DreamX || {};

const DREAMX_LS_TG_KEY = "dreamx_tg_user_id";

window.DreamX.getTgUserId = function () {
  // 1️⃣ Telegram WebApp (основний шлях)
  try {
    const tg = window.Telegram?.WebApp;
    const id = tg?.initDataUnsafe?.user?.id;
    if (id) {
      // 🔐 кешуємо, щоб не втратити при навігації
      localStorage.setItem(DREAMX_LS_TG_KEY, String(id));
      return String(id);
    }
  } catch (e) {}

  // 2️⃣ localStorage (головний фікс проблеми)
  const cached = localStorage.getItem(DREAMX_LS_TG_KEY);
  if (cached) return cached;

  // 3️⃣ fallback: query ?tg_user_id=...
  const p = new URLSearchParams(window.location.search);
  const q = p.get("tg_user_id");
  if (q) {
    localStorage.setItem(DREAMX_LS_TG_KEY, q);
    return q;
  }

  return null;
};
