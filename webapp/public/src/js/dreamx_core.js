// webapp/public/src/js/dreamx_core.js

window.DREAMX_API_BASE = "https://dreamx-v2.onrender.com";

window.DreamX = window.DreamX || {};

const DREAMX_LS_TG_KEY = "dreamx_tg_user_id";

window.DreamX.getTgUserId = function () {

  // ✅ 0️⃣ TEMP: query ?tg_user_id=... (для фейкових тестів)
  const p = new URLSearchParams(window.location.search);
  const q = p.get("tg_user_id");
  if (q) {
    localStorage.setItem(DREAMX_LS_TG_KEY, q);
    return q;
  }

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

  return null;
};

window.DreamX.getInitData = function () {
  try {
    const tg = window.Telegram?.WebApp;
    const init = tg?.initData;
    if (init) return init;
  } catch (e) {}
  return "";
};

window.DreamX.getAuthHeaders = function () {
  const headers = {};

  // 1) PROD шлях (Telegram signed initData)
  const initData = window.DreamX.getInitData();
  if (initData) headers["X-Tg-Init-Data"] = initData;

  // 2) DEV шлях (твої фейкові/кешовані id)
  const id = window.DreamX.getTgUserId();
  if (id) headers["X-Debug-Tg-User-Id"] = String(id);

  // (опційно) якщо десь ще використовується tg_user.py
  if (id) headers["X-Tg-User-Id"] = String(id);

  return headers;
};
