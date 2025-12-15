// webapp/public/src/js/home_screen.js

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-play-bot");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // 1) беремо tg_user_id з Telegram і збережемо в localStorage (якщо dreamx_core вже оновлений)
    try {
      window.DreamX?.getUser?.(); // прогріває кеш (localStorage)
    } catch (e) {}

    // 2) зберігаємо стару поведінку: якщо в URL є query — переносимо його
    const qs = window.location.search || "";

    // 3) переходимо
    window.location.href = "./game.html" + qs;
  });
});
