// game_screen.js

(function () {
  const MOVES = ["rock", "scissors", "paper"];

  function moveEmoji(m) {
    if (m === "rock") return "🪨";
    if (m === "scissors") return "✂️";
    return "📄";
  }

  function setPointsUI(points) {
    const el = document.querySelector("[data-points]");
    if (el) el.textContent = String(points ?? 0);
  }

  function setRoundUI(round) {
    const el = document.querySelector("[data-round]");
    if (el) el.textContent = String(round ?? 1);
  }

  function setBotRoundPointsUI(points) {
    const el = document.querySelector("[data-round-score]");
    if (el) el.textContent = String(points ?? 0);
  }
  
  function setUserRoundPointsUI(points) {
    const el = document.querySelector("[data-user-round-score]");
    if (el) el.textContent = String(points ?? 0);
  }



  function setStatusUI(text) {
    const el = document.querySelector("[data-status]");
    if (el) el.textContent = text;
  }

  function setAvatar(url) {
    const img = document.querySelector("[data-avatar]");
    if (!img) return;
    img.src = url || "";
  }

  function setSlot(kind, idx, move) {
    const sel =
      kind === "user"
        ? `[data-user-${idx}]`
        : `[data-bot-${idx}]`;
    const el = document.querySelector(sel);
    if (!el) return;
    el.textContent = move ? moveEmoji(move) : "";
  }


  function clearRoundSlots() {
    for (let i = 0; i < 3; i++) {
      setSlot("user", i, null);
      setSlot("bot", i, null);
    }
    setBotRoundPointsUI(0);
    setUserRoundPointsUI(0);
  }


  function setButtonsEnabled(enabled) {
    document.querySelectorAll("[data-move]").forEach((btn) => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? "1" : "0.6";
    });
  }

  let round = 1;
  let step = 0; // 0..2
  let userRoundPoints = 0;
  let botRoundPoints = 0;


  async function loadProfile() {
    const data = await window.Api.me();
    if (!data.ok) throw new Error(data.error || "me_failed");

    // очки з БД
    setPointsUI(data.user?.points ?? 0);

    // avatar з БД (photo_url)
    setAvatar(data.user?.photo_url || "");
  }

  async function onPlay(userMove) {
    if (!MOVES.includes(userMove)) return;
    if (step >= 3) return;

    setStatusUI("CLICK ✅ " + userMove);


    try {
      setButtonsEnabled(false);
      setStatusUI("⏳ Граємо...");

      const res = await window.Api.botPlay(userMove);

      if (!res.ok) {
        setStatusUI("⚠️ " + (res.error || "Помилка"));
        setButtonsEnabled(true);
        return;
      }

      // заповнюємо кружечки (3 гри)
      setSlot("user", step, res.user_move);
      setSlot("bot", step, res.bot_move);

      // очки за гру (з бекенда)
      const result = res.result;
      
      // бали за одну гру по правилах (незалежно від бекенда)
      let userDelta = 0;
      let botDelta = 0;
      
      if (result === "win") { userDelta = 3; botDelta = 0; }
      else if (result === "draw") { userDelta = 1; botDelta = 1; }
      else { userDelta = 0; botDelta = 3; }
      
      userRoundPoints += userDelta;
      botRoundPoints += botDelta;
      
      setUserRoundPointsUI(userRoundPoints);
      setBotRoundPointsUI(botRoundPoints);


      // загальні очки (з БД)
      setPointsUI(res.points);

      if (result === "win") setStatusUI(`✅ +${userDelta} (перемога)`);
      else if (result === "draw") setStatusUI(`🤝 +${userDelta} (нічия)`);
      else setStatusUI(`❌ +${userDelta} (поразка)`);


      step += 1;

      // кінець раунду (3 гри)
      if (step === 3) {
        setStatusUI("✅ Раунд завершено");
        round += 1;
        setRoundUI(round);

        // коротка пауза і очищаємо для нового раунду
        setTimeout(() => {
          step = 0;
          userRoundPoints = 0;
          botRoundPoints = 0;

          clearRoundSlots();
          setStatusUI("Зроби вибір 👇");
        }, 700);
      }
    } catch (e) {
      console.error("[onPlay error]", e);
      setStatusUI("⚠️ " + (e?.message || String(e)));
    } finally {
      setButtonsEnabled(true);
    }
  }

  async function init() {
    setRoundUI(round);
    clearRoundSlots();

    document.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => onPlay(btn.dataset.move));
    });

    try {
      await loadProfile();
      setStatusUI("Зроби вибір 👇");
    } catch (e) {
      // важливо: показуємо причину, щоб ти одразу бачив що саме
      setStatusUI("⚠️ Не вдалось завантажити профіль");
      // якщо хочеш супер-точно: розкоментуй
      // console.error(e);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
