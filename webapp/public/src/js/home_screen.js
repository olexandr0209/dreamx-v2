// webapp/public/src/js/home_screen.js

document.addEventListener("DOMContentLoaded", () => {

  // ✅ NEW: якщо WebApp відкрили через t.me/<bot>?startapp=...
  // то Telegram передає payload у initDataUnsafe.start_param (і часто дублює в URL як tgWebAppStartParam)
  function readStartParam() {
    try {
      const tg = window.Telegram?.WebApp;
      const sp = tg?.initDataUnsafe?.start_param;
      if (sp) return String(sp);
    } catch (e) {}

    try {
      const p = new URLSearchParams(window.location.search || "");
      const sp2 = p.get("tgWebAppStartParam");
      if (sp2) return String(sp2);
    } catch (e) {}

    return null;
  }

  function parseTournamentPayload(sp) {
    if (!sp) return null;
    // очікуємо: t_<tid>_<code>
    const m = String(sp).match(/^t_(\d+)_([A-Za-z0-9]{4,20})$/);
    if (!m) return null;
    return { tid: m[1], joinCode: m[2] };
  }

  const sp = readStartParam();
  const parsed = parseTournamentPayload(sp);

  if (parsed) {
    // прогріваємо кеш Telegram user (як у твоєму коді)
    try {
      window.DreamX?.getUser?.();
    } catch (e) {}

    // переносимо існуючий query і додаємо tournament_id + join_code
    const p = new URLSearchParams(window.location.search || "");
    p.set("tournament_id", String(parsed.tid));
    p.set("join_code", String(parsed.joinCode));

    // ✅ одразу відкриваємо tournament.html
    window.location.href = "./tournament.html?" + p.toString();
    return; // важливо: щоб не навішувати зайві хендлери
  }

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

  // ===== TOURNAMENTS (group stage) =====
  const btnT = document.getElementById("btn-play-tournament");
  if (btnT) {
    btnT.addEventListener("click", () => {
      try {
        window.DreamX?.getUser?.();
      } catch (e) {}

      const qs = window.location.search || "";
      window.location.href = "./tournament.html" + qs;
    });
  }
});
