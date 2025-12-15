// game_screen.js

(function () {
  // ===== Round state (NEW) =====
  let round = 1;        // номер раунду
  let step = 0;         // 0..2 (3 гри)
  let roundPoints = 0;  // очки за раунд

  function moveLabel(m) {
    if (m === "rock") return "Камінь";
    if (m === "scissors") return "Ножиці";
    return "Бумага";
  }

  function moveShort(m) {
    if (m === "rock") return "К";
    if (m === "scissors") return "Н";
    return "Б";
  }

  function setPointsUI(points) {
    const el = document.querySelector("[data-points]");
    if (el) el.textContent = String(points ?? 0);
  }

  function setStatusUI(text) {
    const el = document.querySelector("[data-status]");
    if (el) el.textContent = text;
  }

  // OLD: залишаємо, якщо в тебе є ці поля
  function setMovesUI(userMove, botMove) {
    const u = document.querySelector("[data-user-move]");
    const b = document.querySelector("[data-bot-move]");
    if (u) u.textContent = userMove ? moveLabel(userMove) : "—";
    if (b) b.textContent = botMove ? moveLabel(botMove) : "—";
  }

  // ===== NEW helpers (нічого не ламають, якщо елементів немає) =====
  function setRoundUI(val) {
    const el = document.querySelector("[data-round]");
    if (el) el.textContent = String(val);
  }

  function setRoundScoreUI(val) {
    const el = document.querySelector("[data-round-score]");
    if (el) el.textContent = String(val);
  }

  function setAvatarUI(url) {
    const img = document.querySelector("[data-avatar]");
    if (!img) return;
    if (url) img.src = url;
  }

  function paintCircle(selector, move, result) {
    const el = document.querySelector(selector);
    if (!el) return; // якщо кружечків нема — просто пропускаємо
    el.textContent = move ? moveShort(move) : "";
    el.classList.remove("win", "draw", "lose");
    if (result) el.classList.add(result);
  }

  function resetRoundCircles() {
    for (let i = 0; i < 3; i++) {
      paintCircle(`[data-user-${i}]`, null, null);
      paintCircle(`[data-bot-${i}]`, null, null);
    }
    setRoundScoreUI(0);
    roundPoints = 0;
    step = 0;
  }

  async function loadProfile() {
    const data = await window.Api.me();
    if (!data.ok) throw new Error(data.error || "me_failed");

    setPointsUI(data.user?.points ?? 0);

    // NEW: аватар (якщо у тебе вже є data-avatar в HTML)
    setAvatarUI(data.user?.photo_url || null);

    // NEW: раунд UI (якщо є)
    setRoundUI(round);
    resetRoundCircles();
  }

  function pointsForResult(result) {
    if (result === "win") return 3;
    if (result === "draw") return 2;
    return 0; // lose
  }

  async function onPlay(userMove) {
    try {
      // якщо раунд вже завершився — блокуємо кліки до reset
      if (step >= 3) return;

      setStatusUI("⏳ Граємо...");
      const res = await window.Api.botPlay(userMove);

      if (!res.ok) {
        setStatusUI("⚠️ " + (res.error || "Помилка"));
        return;
      }

      // OLD UI лишається
      setMovesUI(res.user_move, res.bot_move);
      setPointsUI(res.points);

      // NEW: кружечки (якщо є в HTML)
      paintCircle(`[data-user-${step}]`, res.user_move, res.result);
      paintCircle(`[data-bot-${step}]`, res.bot_move, res.result);

      // NEW: очки раунду
      roundPoints += pointsForResult(res.result);
      setRoundScoreUI(roundPoints);

      if (res.result === "win") setStatusUI("✅ Перемога!");
      else if (res.result === "lose") setStatusUI("❌ Поразка");
      else setStatusUI("🤝 Нічия");

      step++;

      // NEW: якщо 3 гри зіграно — новий раунд
      if (step === 3) {
        setTimeout(() => {
          round += 1;
          setRoundUI(round);
          resetRoundCircles();
          setMovesUI(null, null);
          setStatusUI("Зроби вибір 👇");
        }, 700);
      }
    } catch (e) {
      setStatusUI("⚠️ Помилка. Спробуй ще раз.");
    }
  }

  async function init() {
    // OLD: підвішуємо кнопки
    document.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => onPlay(btn.dataset.move));
    });

    // OLD: завантажуємо профіль
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
