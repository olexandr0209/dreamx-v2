// webapp/public/src/js/game_screen.js
(function () {
  function moveLabel(m) {
    if (m === "rock") return "Камінь";
    if (m === "scissors") return "Ножиці";
    return "Бумага";
  }

  function setPointsUI(points) {
    const el = document.querySelector("[data-points]");
    if (el) el.textContent = String(points);
  }

  function setStatusUI(text) {
    const el = document.querySelector("[data-status]");
    if (el) el.textContent = text;
  }

  function setMovesUI(userMove, botMove) {
    const u = document.querySelector("[data-user-move]");
    const b = document.querySelector("[data-bot-move]");
    if (u) u.textContent = userMove ? moveLabel(userMove) : "—";
    if (b) b.textContent = botMove ? moveLabel(botMove) : "—";
  }

  async function loadProfile() {
    const data = await window.Api.me();
    if (!data.ok) throw new Error(data.error || "me failed");
    setPointsUI(data.user.points ?? 0);
  }

  async function onPlay(move) {
    try {
      const res = await window.Api.botPlay(move);
      if (!res.ok) throw new Error(res.error || "bot_play_failed");

      setMovesUI(move, res.bot_move);

      if (res.result === "win") setStatusUI("✅ Перемога!");
      else if (res.result === "lose") setStatusUI("❌ Поразка");
      else setStatusUI("🤝 Нічия");

      setPointsUI(res.points);
    } catch (e) {
      setStatusUI("⚠️ Помилка. Спробуй ще раз.");
    }
  }

  async function init() {
    try {
      await loadProfile();
    } catch (e) {
      setStatusUI("⚠️ Не вдалось завантажити профіль");
      return;
    }

    document.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => onPlay(btn.dataset.move));
    });

    setStatusUI("Зроби вибір 👇");
    setMovesUI(null, null);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
