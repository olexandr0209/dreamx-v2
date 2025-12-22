// webapp/public/src/js/public_game_screen.js
(function () {
  const $ = (id) => document.getElementById(id);

  const elBack = $("pg-back");
  const elTitle = $("pg-title");
  const elSub = $("pg-sub");
  const elGroupTitle = $("pg-group-title");
  const elMembers = $("pg-members");

  const elRoundTitle = $("pg-round-title");
  const elTimerFill = $("pg-timer-fill");

  const elOpTag = $("pg-op-tag");
  const elMeTag = $("pg-me-tag");

  const elErr = $("pg-error");
  const elNote = $("pg-note");

  const movesBtns = Array.from(document.querySelectorAll(".pg-move[data-move]"));

  const MOVE = {
    rock: { emoji: "🪨", label: "Камінь" },
    paper: { emoji: "📄", label: "Бумага" },
    scissors: { emoji: "✂️", label: "Ножиці" },
  };

  function setText(el, v) { if (el) el.textContent = String(v); }

  function readParams() {
    const p = new URLSearchParams(window.location.search);

    // базові
    const publicId = p.get("public_id") || "101";
    const org = p.get("org") || "@organizator";
    const groupNo = p.get("group_no") || "2";

    // (опціонально) назва турніру
    const tName = p.get("t_name") || `Турнір #${publicId}`;

    return { publicId, org, groupNo, tName };
  }

  function setCircle(prefix, idx, text) {
    const el = $(`${prefix}-c${idx}`);
    if (!el) return;
    if (idx === 0) return; // avatar handled separately
    el.textContent = text;
  }

  function setScore(prefix, score) {
    const el = $(`${prefix}-c4`);
    if (el) el.textContent = String(score);
  }

  function setAvatar(prefix, label) {
    const el = $(`${prefix}-c0`);
    if (!el) return;
    el.innerHTML = `<div class="pg-avatar">${label}</div>`;
  }

  function setMovesEnabled(flag) {
    for (const b of movesBtns) b.disabled = !flag;
  }

  function decideWinner(myMove, opMove) {
    if (myMove === opMove) return 0; // draw
    if (
      (myMove === "rock" && opMove === "scissors") ||
      (myMove === "paper" && opMove === "rock") ||
      (myMove === "scissors" && opMove === "paper")
    ) return 1; // me
    return -1; // opponent
  }

  // ---------------------------
  // STATE (stub, backend-friendly)
  // ---------------------------
  const state = {
    ok: true,

    tName: "",
    organizer: "",

    groupNo: "",
    members: [], // { tag, points }

    roundNo: 1,
    roundTotal: 3,

    // у кожному раунді 3 гри
    gameInRound: 1,
    gamesPerRound: 3,

    opHist: ["—", "—", "—"],
    meHist: ["—", "—", "—"],

    opScore: 8,
    meScore: 10,

    meTag: "@you",
    opTag: "@opponent",

    turnTotalSec: 5,
    turnEndsAtMs: 0,
    ticking: false,
    tickTimer: null,

    // NEW: params cache for redirect/back links
    publicId: "101",
    org: "@organizator",
  };

  function renderMembers(list) {
    if (!elMembers) return;
    elMembers.innerHTML = (list || []).map((m) => `
      <div class="pg-member">
        <div class="pg-member__name">${m.tag}</div>
        <div class="pg-member__pts">${m.points}</div>
      </div>
    `).join("");
  }

  function applyState() {
    setText(elTitle, state.tName);
    setText(elSub, state.organizer);

    setText(elGroupTitle, `Ваша група № ${state.groupNo}`);
    renderMembers(state.members);

    setText(elRoundTitle, `Раунд ${state.roundNo}/${state.roundTotal}`);

    setText(elOpTag, state.opTag);
    setText(elMeTag, state.meTag);

    setCircle("pg-op", 1, state.opHist[0]);
    setCircle("pg-op", 2, state.opHist[1]);
    setCircle("pg-op", 3, state.opHist[2]);

    setCircle("pg-me", 1, state.meHist[0]);
    setCircle("pg-me", 2, state.meHist[1]);
    setCircle("pg-me", 3, state.meHist[2]);

    setScore("pg-op", state.opScore);
    setScore("pg-me", state.meScore);
  }

  function startTurnTimer() {
    stopTurnTimer();

    state.turnEndsAtMs = Date.now() + state.turnTotalSec * 1000;
    state.ticking = true;

    state.tickTimer = setInterval(() => {
      const leftMs = state.turnEndsAtMs - Date.now();
      const p = Math.max(0, Math.min(1, leftMs / (state.turnTotalSec * 1000)));

      if (elTimerFill) elTimerFill.style.setProperty("--p", String(p));

      if (leftMs <= 0) {
        stopTurnTimer();
        setMovesEnabled(false);
        if (elNote) elNote.textContent = "Час вийшов (заглушка). Пізніше бекенд вирішить автохід/поразку.";
      }
    }, 80);
  }

  function stopTurnTimer() {
    if (state.tickTimer) clearInterval(state.tickTimer);
    state.tickTimer = null;
    state.ticking = false;
    if (elTimerFill) elTimerFill.style.setProperty("--p", "1");
  }

  function showError(obj) {
    if (!elErr) return;
    elErr.hidden = false;
    elErr.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  // ✅ NEW: redirect to result screen
  function goToResults() {
    const url =
      `./public_game_result.html` +
      `?public_id=${encodeURIComponent(state.publicId)}` +
      `&org=${encodeURIComponent(state.org)}` +
      `&t_name=${encodeURIComponent(state.tName)}` +
      `&group_no=${encodeURIComponent(state.groupNo)}`;

    window.location.href = url;
  }

  async function onMove(myMove) {
    try {
      if (!MOVE[myMove]) return;

      setMovesEnabled(false);
      stopTurnTimer();

      const myEmoji = MOVE[myMove].emoji;

      const opMoves = ["rock", "paper", "scissors"];
      const opMove = opMoves[Math.floor(Math.random() * opMoves.length)];
      const opEmoji = MOVE[opMove].emoji;

      const i = state.gameInRound - 1;
      state.meHist[i] = myEmoji;
      state.opHist[i] = opEmoji;

      const w = decideWinner(myMove, opMove);
      if (w === 1) state.meScore += 1;
      if (w === -1) state.opScore += 1;

      applyState();

      await new Promise(r => setTimeout(r, 700));

      if (state.gameInRound < state.gamesPerRound) {
        state.gameInRound += 1;
        if (elNote) elNote.textContent = `Гра ${state.gameInRound}/${state.gamesPerRound} у цьому раунді (заглушка).`;
        applyState();
        setMovesEnabled(true);
        startTurnTimer();
        return;
      }

      if (elNote) elNote.textContent = "Раунд завершено. Очікуємо оновлення (заглушка).";
      await new Promise(r => setTimeout(r, 800));

      state.meHist = ["—", "—", "—"];
      state.opHist = ["—", "—", "—"];
      state.gameInRound = 1;

      if (state.roundNo < state.roundTotal) {
        state.roundNo += 1;
        applyState();
        setMovesEnabled(true);
        startTurnTimer();
        return;
      }

      // ✅ MATCH FINISHED -> go to results screen
      applyState();
      setMovesEnabled(false);
      if (elNote) elNote.textContent = "Матч завершено. Переходимо до результатів…";
      await new Promise(r => setTimeout(r, 650));
      goToResults();

    } catch (e) {
      showError({ ok: false, error: "client_error", details: String(e?.message || e) });
    }
  }

  function bindUi() {
    for (const b of movesBtns) {
      b.addEventListener("click", () => onMove(b.dataset.move));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = readParams();

    // cache params for redirect
    state.publicId = params.publicId;
    state.org = params.org;

    state.tName = params.tName;
    state.organizer = params.org;

    if (elBack) {
      elBack.href = `./public_tournament.html?public_id=${encodeURIComponent(params.publicId)}&org=${encodeURIComponent(params.org)}`;
    }

    state.groupNo = params.groupNo;
    state.members = [
      { tag: "@GamerOne", points: 10 },
      { tag: "@GamerTwo", points: 7 },
      { tag: "@GamerThree", points: 12 },
      { tag: "@GamerFour", points: 9 },
      { tag: state.meTag, points: 8 },
    ];

    setAvatar("pg-op", "AVATAR");
    setAvatar("pg-me", "AVATAR");

    applyState();
    bindUi();

    setMovesEnabled(true);
    if (elNote) elNote.textContent = `Гра ${state.gameInRound}/${state.gamesPerRound} у цьому раунді (заглушка).`;
    startTurnTimer();
  });
})();
