(function () {
  function moveLabel(m) {
    if (m === "rock") return "Камінь";
    if (m === "scissors") return "Ножиці";
    return "Бумага";
  }

  function setPointsUI(points) {
    const el = document.querySelector("[data-points]");
    if (el) el.textContent = String(points ?? 0);
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
    if (!data.ok) throw new Error(data.error || "me_failed");
    setPointsUI(data.user?.points ?? 0);
  }

  async function onPlay(userMove) {
    try {
      setStatusUI("⏳ Граємо...");
      const res = await window.Api.botPlay(userMove);

      if (!res.ok) {
        setStatusUI("⚠️ " + (res.error || "Помилка"));
        return;
      }

      setMovesUI(res.user_move, res.bot_move);
      setPointsUI(res.points);

      if (res.result === "win") setStatusUI("✅ Перемога!");
      else if (res.result === "lose") setStatusUI("❌ Поразка");
      else setStatusUI("🤝 Нічия");
    } catch (e) {
      setStatusUI("⚠️ Помилка. Спробуй ще раз.");
    }
  }

  async function init() {
    // 1) підвішуємо кнопки одразу (навіть якщо профіль не завантажиться)
    document.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => onPlay(btn.dataset.move));
    });

    // 2) пробуємо завантажити профіль
    try {
      await loadProfile();
      setStatusUI("Зроби вибір 👇");
    } catch (e) {
      setStatusUI("⚠️ Не вдалось завантажити профіль");
    }

    setMovesUI(null, null);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
