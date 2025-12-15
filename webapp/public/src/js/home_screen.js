// webapp/public/src/js/home_screen.js

document.addEventListener("DOMContentLoaded", () => {
  // ===== BOT =====
  const btnBot = document.getElementById("btn-play-bot");
  if (btnBot) {
    btnBot.addEventListener("click", () => {
      // 1) беремо tg_user_id з Telegram і збережемо в localStorage (якщо dreamx_core вже оновлений)
      try {
        window.DreamX?.getUser?.(); // прогріває кеш (localStorage)
      } catch (e) {}

      // 2) зберігаємо стару поведінку: якщо в URL є query — переносимо його
      const qs = window.location.search || "";

      // 3) переходимо
      window.location.href = "./game.html" + qs;
    });
  }

  // ===== PVP (1v1) =====
  const btnPvp = document.getElementById("btn-play-pvp");
  if (btnPvp) {
    btnPvp.addEventListener("click", () => {
      // 1) прогріваємо кеш Telegram user так само
      try {
        window.DreamX?.getUser?.();
      } catch (e) {}

      // 2) переносимо query як і для bot
      const qs = window.location.search || "";

      // 3) переходимо на pvp екран
      window.location.href = "./pvp.html" + qs;
    });
  }
});
