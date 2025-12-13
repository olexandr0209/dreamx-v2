// webapp/public/src/js/dreamx_core.js

window.DreamX = window.DreamX || {};

window.DreamX.getTgUserId = function () {
  try {
    const tg = window.Telegram?.WebApp;
    const id = tg?.initDataUnsafe?.user?.id;
    if (id) return String(id);
  } catch (e) {}
  // fallback: query ?tg_user_id=...
  const p = new URLSearchParams(window.location.search);
  return p.get("tg_user_id");
};
