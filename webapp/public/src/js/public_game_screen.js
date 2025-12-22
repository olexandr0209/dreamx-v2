// webapp/public/src/js/public_game_screen.js
(function () {
  const $ = (id) => document.getElementById(id);
  const q = (sel) => document.querySelector(sel);

  const elBack = $("pg-back");
  const elTitle = $("pg-title");
  const elSub = $("pg-sub");
  const elChip = $("pg-chip");

  const elGroup = $("pg-group");
  const elRound = $("pg-round");

  const elOpName = $("pg-op-name");
  const elMeTag = $("pg-me-tag");
  const elOpTag = $("pg-op-tag");

  const elSeries = $("pg-series");
  const elGameNo = $("pg-game-no");

  const elMyPick = $("pg-my-pick");
  const elOpPick = $("pg-op-pick");

  const elTurn = $("pg-turn");
  const elMini = $("pg-mini");
  const elNote = $("pg-note");

  const elErr = $("pg-error");

  const moveBtns = Array.from(document.querySelectorAll(".pg-move[data-move]"));

  // --- simple state (stub) ---
  const state = {
    public_id: null,
    group: "A1",
    round: 1,

    series_total: 5,
    next_game_no: 1,

    me: { name: "Ти", tag: "@you" },
    op: { name: "Opponent", tag: "@opponent" },

    my_series: 0,
    op_series: 0,

    my_move: null,
    op_move: null,

    need_move: true,
    locked: false,
  };

  function readParams() {
    const p = new URLSearchParams(window.location.search);
    state.public_id = p.get("public_id") || "101";
    const g = p.get("group");
    if (g) state.group = String(g);
    const op = p.get("op");
    if (op) state.op.tag = String(op);
  }

  function moveToEmoji(m) {
    if (m === "rock") return "🪨";
    if (m === "paper") return "📄";
    if (m === "scissors") return "✂️";
    return "—";
  }

  function setEnabled(flag) {
    for (const b of moveBtns) b.disabled = !flag;
  }

  function decide(a, b) {
    // returns: 0 draw, 1 -> a wins, 2 -> b wins
    if (a === b) return 0;
    if (a === "rock" && b === "scissors") return 1;
    if (a === "paper" && b === "rock") return 1;
    if (a === "scissors" && b === "paper") return 1;
    return 2;
  }

  function showError(obj) {
    if (!elErr) return;
    elErr.hidden = false;
    elErr.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function hideError() {
    if (!elErr) return;
    elErr.hidden = true;
    elErr.textContent = "";
  }

  function render() {
    hideError();

    if (elTitle) elTitle.textContent = `Public #${state.public_id}`;
    if (elSub) elSub.textContent = "Матч 1 vs 1";
    if (elChip) elChip.textContent = state.locked ? "..." : "Live";

    if (elGroup) elGroup.textContent = `Група: ${state.group}`;
    if (elRound) elRound.textContent = `Раунд: ${state.round}`;

    if (elOpName) elOpName.textContent = state.op.tag;
    if (elMeTag) elMeTag.textContent = state.me.tag;
    if (elOpTag) elOpTag.textContent = state.op.tag;

    if (elSeries) elSeries.textContent = `${state.my_series} : ${state.op_series}`;
    if (elGameNo) elGameNo.textContent = `Гра ${state.next_game_no} / ${state.series_total}`;

    if (elMyPick) elMyPick.textContent = moveToEmoji(state.my_move);
    if (elOpPick) elOpPick.textContent = moveToEmoji(state.op_move);

    if (elTurn) elTurn.textContent = state.need_move ? "Твій хід" : "Очікуй хід суперника";
    if (elMini) elMini.textContent = state.need_move ? "Зроби вибір" : "Суперник думає…";

    setEnabled(state.need_move && !state.locked);
  }

  // --- stub: simulate opponent after your move ---
  function opponentMoveAfterDelay() {
    state.locked = true;
    state.need_move = false;
    render();

    const pool = ["rock", "paper", "scissors"];
    const delay = 700 + Math.floor(Math.random() * 900);

    setTimeout(() => {
      state.op_move = pool[Math.floor(Math.random() * pool.length)];

      const res = decide(state.my_move, state.op_move);
      if (res === 1) state.my_series += 1;
      else if (res === 2) state.op_series += 1;

      // next game
      state.next_game_no += 1;

      // reset picks for next turn (але даємо 500мс, щоб гравець побачив)
      setTimeout(() => {
        state.my_move = null;
        state.op_move = null;

        // end of series?
        if (state.my_series >= 3 || state.op_series >= 3 || state.next_game_no > state.series_total) {
          state.locked = false;
          state.need_move = false;
          if (elTurn) elTurn.textContent = "Серія завершена";
          if (elMini) elMini.textContent = "Заглушка. Далі буде екран результатів.";
          setEnabled(false);
          return;
        }

        state.locked = false;
        state.need_move = true;
        render();
      }, 550);

      render();
    }, delay);
  }

  function onMoveClick(move) {
    if (!state.need_move || state.locked) return;

    state.my_move = move;
    state.op_move = null;

    // після вибору — блокуємо кнопки і “чекаємо”
    opponentMoveAfterDelay();
    render();
  }

  function bind() {
    for (const b of moveBtns) {
      b.addEventListener("click", () => onMoveClick(b.dataset.move));
    }

    // back: повертаємо з параметрами
    if (elBack) {
      elBack.addEventListener("click", (e) => {
        e.preventDefault();
        const url = `./public_tournament.html?public_id=${encodeURIComponent(state.public_id)}&org=${encodeURIComponent(state.op.tag)}`;
        window.location.href = url;
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    readParams();
    bind();
    render();

    if (elNote) elNote.textContent = "Заглушка матчу. Далі: підключимо бекенд і реальний match state.";
  });
})();
