// webapp/public/src/js/game_screen.js

(function () {
  const MOVES = ["rock", "scissors", "paper"];

  function randMove() {
    return MOVES[Math.floor(Math.random() * MOVES.length)];
  }

  function calcResult(userMove, botMove) {
    if (userMove === botMove) return { result: "draw", delta: 0 };

    const win =
      (userMove === "rock" && botMove === "scissors") ||
      (userMove === "scissors" && botMove === "paper") ||
      (userMove === "paper" && botMove === "rock");

    // очки: win +1, lose -1 (можеш змінити пізніше)
    return win ? { result: "win", delta: 1 } : { result: "lose", delta: -1 };
  }

  function moveLabel(m) {
    if (m === "rock") return "Камінь";
    if (m === "scissors") return "Ножиці";
    return "Бумага";
  }

  async function loadPoints() {
    const data = await window.Api.me();
    if (!data.ok) throw new Error(data.error || "me failed");
    return data.user.points ?? 0;
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

  async function onPlay(userMove) {
    try {
      const botMove = randMove();
      const { result, delta } = calcResult(userMove, botMove);

      setMovesUI(userMove, botMove);

      if (result === "win") setStatusUI("✅ Перемога!");
      if (result === "lose") setStatusUI("❌ Поразка");
      if (result === "draw") setStatusUI("🤝 Нічия");

      // 1) оновлюємо points у БД (атомарно)
      const upd = await window.Api.addPoints(delta);
      if (upd.ok) setPointsUI(upd.points);

      // 2) лог гри (не критично, але бажано)
      window.Api.logGame({
        mode: "bot_rps",
        user_move: userMove,
        bot_move: botMove,
        result,
        points_delta: delta,
      }).catch(() => {});
    } catch (e) {
      setStatusUI("⚠️ Помилка. Спробуй ще раз.");
    }
  }

  async function init() {
    // points при вході
    try {
      const points = await loadPoints();
      setPointsUI(points);
    } catch (e) {
      setStatusUI("⚠️ Не вдалось завантажити профіль");
      return;
    }

    // кнопки
    document.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => onPlay(btn.dataset.move));
    });

    // стартовий стан
    setStatusUI("Зроби вибір 👇");
    setMovesUI(null, null);
  }

  document.addEventListener("DOMContentLoaded", init);
})();

