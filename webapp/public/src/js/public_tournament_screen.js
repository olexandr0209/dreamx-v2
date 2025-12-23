// webapp/public/src/js/public_tournament_screen.js
(function () {
  if (!window.PublicApi) {
    console.error("[PublicTournament] PublicApi not loaded (public_api_client.js?)");
    return;
  }

  const $ = (id) => document.getElementById(id);

  const elTitle = $("pt-title");
  const elOrg = $("pt-org");

  const elTimer = $("pt-timer");
  const elRing = $("pt-ring");
  const elTime = $("pt-time");
  const elTimerNote = $("pt-timer-note");

  const elStatus = $("pt-status");
  const elStatusText = $("pt-status-text");

  const elPlayersTitle = $("pt-players-title");
  const elCount = $("pt-count");
  const elPlayers = $("pt-players");
  const elNote = $("pt-note");

  const POLL_MS = 1200;

  let tournamentId = 0;
  let pollTimer = null;
  let autoJoinDone = false;

  function readParams() {
    const p = new URLSearchParams(window.location.search);
    // підтримуємо і tournament_id, і public_id (щоб не ламати старі лінки)
    tournamentId = Number(p.get("tournament_id") || p.get("public_id") || 0);
    if (!tournamentId) tournamentId = 101; // fallback (як у тебе було)
  }

  function fmtTime(sec) {
    const s = Math.max(0, Number(sec) | 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function setRingProgress(total, left) {
    const T = Math.max(1, Number(total || 30));
    const L = Math.max(0, Number(left || 0));
    const p = Math.max(0, Math.min(1, 1 - L / T));
    if (elRing) elRing.style.setProperty("--p", String(p));
  }

  function renderPlayers(list) {
    const arr = Array.isArray(list) ? list : [];

    if (elCount) elCount.textContent = String(arr.length);
    if (!elPlayers) return;

    elPlayers.innerHTML = arr
      .map((p) => {
        // підтримка 2 форматів: {name, tag} (старий) і {username, tg_user_id} (бекенд)
        const name =
          p.name ||
          (p.username ? (p.username.startsWith("@") ? p.username.slice(1) : p.username) : "User");
        const tag =
          p.tag ||
          (p.username ? (p.username.startsWith("@") ? p.username : `@${p.username}`) : `#${p.tg_user_id ?? "?"}`);

        return `
          <div class="tg-player">
            <div class="tg-player__name">${name}</div>
            <div class="tg-player__tag">${tag}</div>
          </div>
        `;
      })
      .join("");
  }

  function hideTimerBlock() {
    if (elTimer) elTimer.hidden = true;
    if (elRing) elRing.hidden = true;
  }

  function showTimerBlock() {
    if (elTimer) elTimer.hidden = false;
    if (elRing) elRing.hidden = false;
  }

  function setStatus(text) {
    if (elStatus) elStatus.hidden = false;
    if (elStatusText) elStatusText.textContent = text || "—";
  }

  function clearStatus() {
    if (elStatus) elStatus.hidden = true;
  }

  function mapPhase(phase) {
    // бекенд: countdown/registration/late_join/forming_groups/group/finished
    if (phase === "forming_groups") return "forming";
    if (phase === "group") return "group";
    if (phase === "finished") return "finished";
    // countdown/registration/late_join → показуємо таймер-блок
    return "countdown";
  }

  async function refresh() {
    const s = await PublicApi.state(tournamentId);

    const t = s.tournament || {};
    if (elTitle) elTitle.textContent = t.name || `Public Tournament #${t.tournament_id || tournamentId}`;
    if (elOrg) elOrg.textContent = t.organizer || "@telegram_account";

    const phase = mapPhase(s.phase);

    // default
    hideTimerBlock();
    clearStatus();

    const lobby = s.lobby || {};
    const players = lobby.players || [];

    // --- countdown/registration/late_join ---
    if (phase === "countdown") {
      showTimerBlock();

      const secToStart = s.timers?.seconds_to_start;
      if (elTime && secToStart != null) elTime.textContent = fmtTime(secToStart);

      const total = Math.max(30, Number(secToStart || 30));
      setRingProgress(total, secToStart);

      if (elTimerNote) {
        elTimerNote.textContent =
          s.phase === "registration" ? "Реєстрація відкрита" :
          s.phase === "late_join" ? "Можна приєднатись (late join)" :
          "Очікування старту";
      }

      if (elPlayersTitle) elPlayersTitle.textContent = "Учасники";
      if (elNote) elNote.textContent = "Список оновлюється (бекенд).";

      renderPlayers(players);

      // ✅ авто-join 1 раз (бо кнопки join у верстці нема)
      const joinAllowed = !!lobby.join_allowed;
      const joined = !!lobby.joined;
      if (!autoJoinDone && joinAllowed && !joined) {
        autoJoinDone = true;
        try {
          await PublicApi.join(tournamentId);
        } catch (e) {
          console.error("[PublicTournament] auto-join failed:", e);
          autoJoinDone = false; // щоб ще раз спробувало на наступному poll
        }
      }

      return;
    }

    // --- forming ---
    if (phase === "forming") {
      setStatus("Реєстрація завершена! Формуються групи");

      if (elPlayersTitle) elPlayersTitle.textContent = "Учасники";
      if (elNote) elNote.textContent = "Список з бекенду (формування).";

      renderPlayers(players);
      return;
    }

    // --- group ---
    if (phase === "group") {
      // як тільки бекенд каже group — одразу в гру
      window.location.href = `./public_game.html?tournament_id=${encodeURIComponent(String(tournamentId))}`;
      return;
    }

    // --- finished ---
    if (phase === "finished") {
      window.location.href = `./public_game_result.html?tournament_id=${encodeURIComponent(String(tournamentId))}`;
      return;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    readParams();
    refresh().catch(console.error);
    pollTimer = setInterval(() => refresh().catch(console.error), POLL_MS);
  });
})();
