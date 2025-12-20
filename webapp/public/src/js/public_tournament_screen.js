// webapp/public/src/js/public_tournament_screen.js
(function () {
  const $ = (id) => document.getElementById(id);

  const elTitle = $("pt-title");
  const elOrg = $("pt-org");

  const elTimer = $("pt-timer");
  const elRing = $("pt-ring");
  const elTime = $("pt-time");
  const elTimerNote = $("pt-timer-note");

  const elStatus = $("pt-status");
  const elStatusText = $("pt-status-text");
  const elBubble = $("pt-bubble");

  const elPlayersTitle = $("pt-players-title");
  const elCount = $("pt-count");
  const elPlayers = $("pt-players");
  const elNote = $("pt-note");

  let tickTimer = null;
  let playersTimer = null;
  let phaseTimer = null;

  // ✅ один state обʼєкт — потім просто підміняємо на дані з API
  // phase: countdown -> forming -> group_ready -> redirect
  const state = {
    ok: true,
    phase: "countdown",
    public_id: null,

    tournament_name: "Public tournament",
    organizer: "@telegram_account",

    seconds_total: 30,
    seconds_left: 30,

    players_live: [],
    players_frozen: [],

    group_title: "Твоя група 1а",
  };

  function readParams() {
    const p = new URLSearchParams(window.location.search);
    state.public_id = p.get("public_id") || "101";
    const org = p.get("org");
    if (org) state.organizer = String(org);
  }

  function fmtTime(sec) {
    const s = Math.max(0, Number(sec) | 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function setRingProgress(total, left) {
    const T = Number(total || 30);
    const L = Number(left || 0);
    const p = T > 0 ? Math.max(0, Math.min(1, 1 - (L / T))) : 0;
    if (elRing) elRing.style.setProperty("--p", String(p));
  }

  function renderPlayers(list) {
    const arr = Array.isArray(list) ? list : [];
    if (elCount) elCount.textContent = String(arr.length);

    if (!elPlayers) return;
    elPlayers.innerHTML = arr.map((p) => `
      <div class="tg-player">
        <div class="tg-player__name">${p.name}</div>
        <div class="tg-player__tag">${p.tag}</div>
      </div>
    `).join("");
  }

  function applyState() {
    // header
    if (elTitle) elTitle.textContent = state.tournament_name || "—";
    if (elOrg) elOrg.textContent = state.organizer || "@telegram_account";

    // defaults (важливо щоб нічого не висіло)
    if (elBubble) elBubble.hidden = true;
    if (elStatus) elStatus.hidden = true;

    if (state.phase === "countdown") {
      // ✅ велике коло видно тільки тут
      if (elTimer) elTimer.hidden = false;

      if (elTime) elTime.textContent = fmtTime(state.seconds_left);
      setRingProgress(state.seconds_total, state.seconds_left);

      if (elPlayersTitle) elPlayersTitle.textContent = "Учасники";
      if (elNote) elNote.textContent = "Список оновлюється (заглушка).";
      if (elTimerNote) elTimerNote.textContent = "Онлайн реєстрація (заглушка)";

      renderPlayers(state.players_live);
      return;
    }

    if (state.phase === "forming") {
      // ✅ коло зникло
      if (elTimer) elTimer.hidden = true;

      // ✅ статус показали
      if (elStatus) elStatus.hidden = false;
      if (elStatusText) elStatusText.textContent = "Реєстрація завершена! Формуються групи";

      if (elPlayersTitle) elPlayersTitle.textContent = "Учасники";
      if (elNote) elNote.textContent = "Список заморожено (заглушка).";

      // ✅ список вже frozen і не рухається
      renderPlayers(state.players_frozen);
      return;
    }

    if (state.phase === "group_ready") {
      if (elTimer) elTimer.hidden = true;

      if (elStatus) elStatus.hidden = false;
      if (elStatusText) elStatusText.textContent = state.group_title || "Твоя група 1а";

      // ✅ малий кружок тільки тут
      if (elBubble) elBubble.hidden = false;

      if (elPlayersTitle) elPlayersTitle.textContent = "Гравці";
      if (elNote) elNote.textContent = "Група готова (заглушка).";

      renderPlayers(state.players_frozen);
      return;
    }
  }

  function stopAllTimers() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;

    if (playersTimer) clearInterval(playersTimer);
    playersTimer = null;

    if (phaseTimer) clearTimeout(phaseTimer);
    phaseTimer = null;
  }

  function startCountdown() {
    const startedAt = Date.now();

    // ✅ оновлення списку ТІЛЬКИ під час countdown
    const pool = [
      { name: "Andrii", tag: "@andrii" },
      { name: "Ira", tag: "@ira" },
      { name: "Dmytro", tag: "@dmytro" },
      { name: "Vlad", tag: "@vlad" },
      { name: "Katya", tag: "@katya" },
      { name: "Nazar", tag: "@nazar" },
      { name: "Maks", tag: "@maks" },
    ];
    const me = { name: "Ти", tag: "@you" };

    state.players_live = [me];
    applyState();

    playersTimer = setInterval(() => {
      if (state.phase !== "countdown") return;

      // додаємо по 1 гравцю, не пересортовуємо — щоб не "смикалось"
      const live = [...state.players_live];

      if (live.length < 7) {
        const next = pool[Math.floor(Math.random() * pool.length)];
        if (!live.find(x => x.tag === next.tag)) live.push(next);
      }

      state.players_live = live;
      applyState();
    }, 1000);

    tickTimer = setInterval(() => {
      if (state.phase !== "countdown") return;

      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, 30 - elapsed);
      state.seconds_left = Math.ceil(left);

      applyState();

      if (left <= 0) {
        // ✅ ЗУПИНЯЄМО countdown
        state.seconds_left = 0;
        state.phase = "forming";

        // ✅ заморожуємо список РІВНО тут
        state.players_frozen = state.players_live.slice();

        // ✅ стоп оновлення списку
        if (playersTimer) {
          clearInterval(playersTimer);
          playersTimer = null;
        }
        if (tickTimer) {
          clearInterval(tickTimer);
          tickTimer = null;
        }

        applyState();

        // ✅ 5 секунд forming -> group_ready
        phaseTimer = setTimeout(() => {
          state.phase = "group_ready";
          applyState();

          // ✅ 3 секунди -> перехід на заглушку гри
          phaseTimer = setTimeout(() => {
            window.location.href = "./public_game_stub.html";
          }, 3000);

        }, 5000);
      }
    }, 200);
  }

  document.addEventListener("DOMContentLoaded", () => {
    stopAllTimers();
    readParams();

    // заглушка назви поки
    state.tournament_name = `Public Tournament #${state.public_id}`;

    // старт
    state.phase = "countdown";
    state.seconds_total = 30;
    state.seconds_left = 30;

    applyState();
    startCountdown();
  });
})();
