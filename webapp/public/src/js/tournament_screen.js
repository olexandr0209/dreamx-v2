// webapp/public/src/js/tournament_screen.js
(function () {
  if (!window.TournamentApi) {
    console.error("[Tournament] tournament_client.js not loaded");
    return;
  }

  const POLL_INTERVAL = 1500;

  let tournamentId = null;
  let pollTimer = null;

  let lastPhase = null;
  let lastMatchId = null;
  let lastNeedMove = null;

  const Events = {
    onPhase: (state) => {},
    onNeedJoin: (state) => {},
    onRegistration: (state) => {},
    onWaitingGroup: (state) => {},
    onGroup: (state) => {},
    onError: (err) => {},
  };

  // ---------- DOM ----------
  const elInputTid = document.getElementById("tg-tournament-id");
  const elOpen = document.getElementById("tg-open");

  const elJoinCode = document.getElementById("tg-join-code");
  const elJoin = document.getElementById("tg-join");
  const elLeave = document.getElementById("tg-leave");

  const elStatus = document.getElementById("tg-status");
  const elPolling = document.getElementById("tg-polling");

  const elTournamentPill = document.getElementById("tg-tournament-pill");
  const elPhasePill = document.getElementById("tg-phase-pill");
  const elStagePill = document.getElementById("tg-stage-pill");
  const elGroupPill = document.getElementById("tg-group-pill");
  const elMatchPill = document.getElementById("tg-match-pill");

  const elSubtitle = document.getElementById("tg-subtitle");

  const elStandingsBody = document.getElementById("tg-standings-body");

  const elOpponent = document.getElementById("tg-opponent");
  const elSeries = document.getElementById("tg-series");
  const elNextGame = document.getElementById("tg-next-game");
  const elNeedMove = document.getElementById("tg-need-move");

  const rpsButtons = Array.from(document.querySelectorAll(".tg-rps-btn[data-move]"));

  function setStatus(text) {
    if (elStatus) elStatus.textContent = text;
  }

  function setPolling(flag) {
    if (elPolling) elPolling.textContent = `Polling: ${flag ? "on" : "off"}`;
  }

  function setPills(state) {
    if (elTournamentPill) elTournamentPill.textContent = tournamentId ? `ID: ${tournamentId}` : "ID: —";
    if (elPhasePill) elPhasePill.textContent = `phase: ${state?.phase || "—"}`;

    const stNo = state?.stage_no ?? "—";
    const stStatus = state?.stage_status ?? "—";
    if (elStagePill) elStagePill.textContent = `stage: ${stNo} • ${stStatus}`;

    const gNo = state?.group?.group_no ?? "—";
    const gId = state?.group?.id ?? "—";
    if (elGroupPill) elGroupPill.textContent = `group: ${gNo} (id ${gId})`;

    const mid = state?.match?.id ?? "—";
    if (elMatchPill) elMatchPill.textContent = `match: ${mid}`;
  }

  function setSubtitle(state) {
    if (!elSubtitle) return;
    const stNo = state?.stage_no ?? null;
    const gNo = state?.group?.group_no ?? null;
    if (state?.phase === "group" && stNo && gNo) {
      elSubtitle.textContent = `Stage ${stNo} • Group ${gNo}`;
      return;
    }
    if (state?.phase === "waiting_group" && stNo) {
      elSubtitle.textContent = `Stage ${stNo} • Формування груп`;
      return;
    }
    if (state?.phase === "registration" && stNo) {
      elSubtitle.textContent = `Stage ${stNo} • Реєстрація`;
      return;
    }
    elSubtitle.textContent = "Груповий етап";
  }

  function myTgId() {
    const v = window.DreamX?.getTgUserId?.();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function renderStandings(state) {
    if (!elStandingsBody) return;

    const rows = state?.standings || [];
    if (!rows.length) {
      elStandingsBody.innerHTML = `<tr><td colspan="7" class="tg-empty">Поки немає даних…</td></tr>`;
      return;
    }

    const me = myTgId();

    elStandingsBody.innerHTML = rows.map((r) => {
      const isMe = me && Number(r.tg_user_id) === Number(me);
      const style = isMe ? ` style="font-weight:700;background:rgba(0,0,0,0.03);"` : "";
      return `
        <tr${style}>
          <td>${r.seat}</td>
          <td>${r.tg_user_id}</td>
          <td>${r.points}</td>
          <td>${r.wins}</td>
          <td>${r.draws}</td>
          <td>${r.losses}</td>
          <td>${r.matches_played}</td>
        </tr>
      `;
    }).join("");
  }

  function setMovesEnabled(flag) {
    for (const b of rpsButtons) b.disabled = !flag;
  }

  function renderMatch(state) {
    const m = state?.match || null;

    if (!m) {
      if (elOpponent) elOpponent.textContent = "—";
      if (elSeries) elSeries.textContent = "0 : 0";
      if (elNextGame) elNextGame.textContent = "—";
      if (elNeedMove) elNeedMove.textContent = "—";
      setMovesEnabled(false);
      lastMatchId = null;
      lastNeedMove = null;
      return;
    }

    lastMatchId = Number(m.id);

    if (elOpponent) elOpponent.textContent = String(m.opponent_tg_user_id ?? "—");
    if (elNextGame) elNextGame.textContent = `${m.next_game_no ?? "—"} / ${m.series_total ?? "—"}`;

    // series score relative to "you"
    const youP1 = !!m.you_are_p1;
    const p1 = Number(m.p1_series_points ?? 0);
    const p2 = Number(m.p2_series_points ?? 0);
    const myScore = youP1 ? p1 : p2;
    const opScore = youP1 ? p2 : p1;
    if (elSeries) elSeries.textContent = `${myScore} : ${opScore}`;

    const need = !!m.need_move;
    lastNeedMove = need;
    if (elNeedMove) elNeedMove.textContent = need ? "твій" : "очікуй";

    setMovesEnabled(need);
  }

  function setActionsByPhase(phase) {
    // join/leave доступність тільки на рівні UI (бек все одно захищений)
    if (phase === "registration") {
      if (elJoin) elJoin.disabled = false;
      if (elLeave) elLeave.disabled = false;
      return;
    }
    if (phase === "waiting_group") {
      if (elJoin) elJoin.disabled = true;
      if (elLeave) elLeave.disabled = true;
      return;
    }
    if (phase === "group") {
      if (elJoin) elJoin.disabled = true;
      if (elLeave) elLeave.disabled = true;
      return;
    }

    // дефолт
    if (elJoin) elJoin.disabled = false;
    if (elLeave) elLeave.disabled = false;
  }

  function handlePhaseEvents(state) {
    const phase = state?.phase || null;

    if (phase !== lastPhase) lastPhase = phase;

    Events.onPhase(state);

    if (phase === "registration") {
      Events.onRegistration(state);
      return;
    }
    if (phase === "waiting_group") {
      Events.onWaitingGroup(state);
      return;
    }
    if (phase === "group") {
      Events.onGroup(state);
      return;
    }

    Events.onNeedJoin(state);
  }

  // ---------- Core ----------
  async function pollState() {
    if (!tournamentId) return;

    const res = await window.TournamentApi.state(tournamentId);
    if (!res.ok) {
      Events.onError(res);
      setStatus(`⚠️ ${res.error || "error"}`);
      setPolling(false);
      setMovesEnabled(false);
      return;
    }

    setPolling(true);

    setPills(res);
    setSubtitle(res);

    const phase = res.phase || "—";
    setActionsByPhase(phase);

    // human status
    if (phase === "registration") setStatus("🟢 Реєстрація відкрита. Можеш приєднатись (Join).");
    else if (phase === "waiting_group") setStatus("⏳ Етап стартував. Чекаємо формування груп…");
    else if (phase === "group") setStatus("🏁 Груповий етап. Грай свій матч.");
    else setStatus("ℹ️ Вкажи tournament_id і натисни Join.");

    renderStandings(res);
    renderMatch(res);

    handlePhaseEvents(res);
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollState, POLL_INTERVAL);
    pollState();
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    setPolling(false);
  }

  function _readTidFromUrl() {
    const p = new URLSearchParams(window.location.search);
    const tid = p.get("tournament_id");
    return tid ? String(tid) : null;
  }

  function _setUrlTid(tid) {
    const p = new URLSearchParams(window.location.search);
    if (tid) p.set("tournament_id", String(tid));
    else p.delete("tournament_id");
    const newUrl = `${window.location.pathname}?${p.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }

  function setTournamentId(tid) {
    tournamentId = tid ? String(tid) : null;
    if (elTournamentPill) elTournamentPill.textContent = tournamentId ? `ID: ${tournamentId}` : "ID: —";
    if (tournamentId) _setUrlTid(tournamentId);
  }

  async function join(joinCode) {
    if (!tournamentId) return Events.onError({ ok: false, error: "no_tournament_id" });

    setStatus("⏳ Join…");
    const res = await window.TournamentApi.join(tournamentId, joinCode);
    if (!res.ok) {
      Events.onError(res);
      setStatus(`⚠️ join: ${res.error || "error"}`);
      return;
    }
    setStatus("✅ Joined. Очікуємо старт/групи…");
    startPolling();
  }

  async function leave() {
    if (!tournamentId) return Events.onError({ ok: false, error: "no_tournament_id" });

    setStatus("⏳ Leave…");
    const res = await window.TournamentApi.leave(tournamentId);
    if (!res.ok) {
      Events.onError(res);
      setStatus(`⚠️ leave: ${res.error || "error"}`);
      return;
    }
    setStatus("✅ Left.");
    pollState();
  }

  async function sendMove(move) {
    if (!tournamentId) return Events.onError({ ok: false, error: "no_tournament_id" });
    if (!lastMatchId) return Events.onError({ ok: false, error: "no_match" });
    if (!lastNeedMove) return Events.onError({ ok: false, error: "not_your_turn" });

    setMovesEnabled(false);
    setStatus("⏳ Хід відправлено…");

    const res = await window.TournamentApi.move(tournamentId, lastMatchId, move);
    if (!res.ok) {
      Events.onError(res);
      setStatus(`⚠️ move: ${res.error || "error"}`);
      pollState();
      return;
    }

    setStatus("✅ Хід прийнято. Оновлюємо стан…");
    pollState();
  }

  // ---------- Bind UI ----------
  function bindUi() {
    // open
    if (elOpen) {
      elOpen.addEventListener("click", () => {
        const v = elInputTid?.value ? String(elInputTid.value).trim() : "";
        if (!v) {
          setStatus("⚠️ Вкажи tournament_id");
          return;
        }
        setTournamentId(v);
        setStatus("✅ Турнір відкрито. Натисни Join.");
        startPolling();
      });
    }

    // join
    if (elJoin) {
      elJoin.addEventListener("click", () => {
        const code = elJoinCode?.value ? String(elJoinCode.value).trim() : "";
        join(code || null);
      });
    }

    // leave
    if (elLeave) {
      elLeave.addEventListener("click", () => leave());
    }

    // moves
    for (const b of rpsButtons) {
      b.addEventListener("click", () => sendMove(b.dataset.move));
    }
  }

  // ---------- Public ----------
  window.TournamentScreen = {
    start: (tid) => {
      setTournamentId(tid || _readTidFromUrl());
      bindUi();

      // якщо tid є — стартуємо polling одразу
      if (tournamentId) startPolling();
      else setStatus("Вкажи tournament_id і натисни “Відкрити”.");
    },
    join,
    leave,
    sendMove,
    stop: stopPolling,
    events: Events,
  };

  // авто-старт
  document.addEventListener("DOMContentLoaded", () => {
    window.TournamentScreen.start(_readTidFromUrl());
  });
})();
