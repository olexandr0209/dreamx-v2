// webapp/public/src/js/public_tournament_screen.js
(function () {
  const $ = (id) => document.getElementById(id);

  const elTitle = $("pt-title");
  const elOrg = $("pt-org");

  const elTimer = $("pt-timer");      // wrapper for big ring
  const elRing = $("pt-ring");        // ring itself
  const elTime = $("pt-time");
  const elTimerNote = $("pt-timer-note");

  const elStatus = $("pt-status");
  const elStatusText = $("pt-status-text");

  const elPlayersTitle = $("pt-players-title");
  const elCount = $("pt-count");
  const elPlayers = $("pt-players");
  const elNote = $("pt-note");

  let tickTimer = null;
  let playersTimer = null;
  let formingWaitTimer = null;
  let redirectTimer = null;

  /**
   * ✅ Backend-friendly state model
   * phase: "countdown" | "forming" | "group_ready"
   */
  const state = {
    ok: true,
    public_id: null,
    phase: "countdown",

    tournament_name: "Public tournament",
    organizer: "@telegram_account",

    seconds_total: 30,
    seconds_left: 30,

    players_live: [],
    players_all: [],

    group: null, // { title, members }
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

  function hideTimerBlock() {
    // ✅ гарантія що велике кільце реально зникло
    if (elTimer) elTimer.hidden = true;
    if (elRing) elRing.hidden = true;
  }

  function showTimerBlock() {
    if (elTimer) elTimer.hidden = false;
    if (elRing) elRing.hidden = false;
  }

  function applyState() {
    // header
    if (elTitle) elTitle.textContent = state.tournament_name || "—";
    if (elOrg) elOrg.textContent = state.organizer || "@telegram_account";

    // defaults
    hideTimerBlock();
    if (elStatus) elStatus.hidden = true;

    if (state.phase === "countdown") {
      showTimerBlock();

      if (elTime) elTime.textContent = fmtTime(state.seconds_left);
      setRingProgress(state.seconds_total, state.seconds_left);

      if (elTimerNote) elTimerNote.textContent = "Онлайн реєстрація (заглушка)";
      if (elPlayersTitle) elPlayersTitle.textContent = "Учасники";
      if (elNote) elNote.textContent = "Список оновлюється (заглушка).";

      renderPlayers(state.players_live);
      return;
    }

    if (state.phase === "forming") {
      // ✅ без кільця + список НЕ оновлюється
      if (elStatus) elStatus.hidden = false;
      if (elStatusText) elStatusText.textContent = "Реєстрація завершена! Формуються групи";

      if (elPlayersTitle) elPlayersTitle.textContent = "Учасники";
      if (elNote) elNote.textContent = "Список заморожено (очікуємо бекенд).";

      renderPlayers(state.players_all);
      return;
    }

    if (state.phase === "group_ready") {
      const groupTitle = state.group?.title || "Твоя група A1";
      const members = state.group?.members || [];

      if (elStatus) elStatus.hidden = false;
      if (elStatusText) elStatusText.textContent = groupTitle;

      if (elPlayersTitle) elPlayersTitle.textContent = "Гравці твоєї групи";
      if (elNote) elNote.textContent = "Група сформована (заглушка).";

      renderPlayers(members);
      return;
    }
  }

  function stopAllTimers() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;

    if (playersTimer) clearInterval(playersTimer);
    playersTimer = null;

    if (formingWaitTimer) clearTimeout(formingWaitTimer);
    formingWaitTimer = null;

    if (redirectTimer) clearTimeout(redirectTimer);
    redirectTimer = null;
  }

  // ---- STUB: players join during countdown ----
  function startCountdownStub() {
    const startedAt = Date.now();

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

    // list updates only in countdown
    playersTimer = setInterval(() => {
      if (state.phase !== "countdown") return;

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
        state.seconds_left = 0;

        // freeze ALL players once
        state.players_all = state.players_live.slice();

        // stop countdown timers
        if (playersTimer) { clearInterval(playersTimer); playersTimer = null; }
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }

        state.phase = "forming";
        applyState();

        // ✅ STUB waiting for backend group creation (5 sec for now)
        waitGroupsFromBackendStub();
      }
    }, 200);
  }

  // ---- STUB: backend would respond with group data ----
  function waitGroupsFromBackendStub() {
    formingWaitTimer = setTimeout(() => {
      const all = state.players_all.slice();
      const me = all.find(x => x.tag === "@you") || { name: "Ти", tag: "@you" };

      const others = all.filter(x => x.tag !== "@you");
      const groupMembers = [me, ...others.slice(0, 2)]; // group size 3 for stub

      state.group = {
        title: "Твоя група A1",
        members: groupMembers,
      };

      state.phase = "group_ready";
      applyState();

      // after 3 sec -> game stub screen
      redirectTimer = setTimeout(() => {
        window.location.href = `./public_game.html?public_id=${encodeURIComponent(state.public_id)}&group=A1&op=@opponent`;
      }, 3000);

    }, 5000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    stopAllTimers();
    readParams();

    state.tournament_name = `Public Tournament #${state.public_id}`;
    state.phase = "countdown";
    state.seconds_total = 30;
    state.seconds_left = 30;
    state.players_live = [];
    state.players_all = [];
    state.group = null;

    applyState();
    startCountdownStub();
  });
})();
