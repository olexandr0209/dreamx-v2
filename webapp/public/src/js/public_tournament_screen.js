// webapp/public/src/js/public_tournament_screen.js
(function () {
  if (!window.PublicApi) {
    console.error("[PublicTournament] public_api_client.js not loaded");
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

  let pollTimer = null;
  let tournamentId = null;

  // для прогресу кільця
  let ringTotal = null;

  function readTournamentId() {
    const p = new URLSearchParams(window.location.search);
    // ✅ підтримуємо ОБИДВА варіанти, щоб не ламати твої лінки
    const v = p.get("tournament_id") || p.get("public_id") || p.get("public_id") || "";
    const n = Number(v || 0);
    return n > 0 ? n : null;
  }

  function fmtTime(sec) {
    const s = Math.max(0, Number(sec) | 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function setRingProgress(left) {
    const L = Math.max(0, Number(left || 0));
    if (ringTotal == null) ringTotal = Math.max(1, L); // перше значення беремо як total
    const p = ringTotal > 0 ? Math.max(0, Math.min(1, 1 - (L / ringTotal))) : 0;
    if (elRing) elRing.style.setProperty("--p", String(p));
  }

  function showTimerBlock(show) {
    if (elTimer) elTimer.hidden = !show;
    if (elRing) elRing.hidden = !show;
  }

  function showStatus(show, text) {
    if (!elStatus) return;
    elStatus.hidden = !show;
    if (show && elStatusText) elStatusText.textContent = text || "—";
  }

  function normTag(username, tg_user_id) {
    const u = (username || "").trim();
    if (u) return u.startsWith("@") ? u : "@" + u;
    return tg_user_id ? `id:${tg_user_id}` : "—";
  }

  function renderPlayers(list) {
    const arr = Array.isArray(list) ? list : [];
    if (elCount) elCount.textContent = String(arr.length);

    if (!elPlayers) return;

    elPlayers.innerHTML = arr.map((p) => {
      const name = (p.name || p.username || "").trim() || "User";
      const tag = normTag(p.username, p.tg_user_id);
      return `
        <div class="tg-player">
          <div class="tg-player__name">${escapeHtml(name)}</div>
          <div class="tg-player__tag">${escapeHtml(tag)}</div>
        </div>
      `;
    }).join("");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function pickSecondsToStart(s) {
    // максимально “живуче” — під різні ключі
    return (
      s?.timers?.seconds_to_start ??
      s?.timers?.secondsToStart ??
      s?.seconds_to_start ??
      s?.seconds_left ??
      0
    );
  }

  function pickTournamentName(s) {
    return (
      s?.tournament?.name ??
      s?.tournament_name ??
      (tournamentId ? `Public Tournament #${tournamentId}` : "Public Tournament")
    );
  }

  function pickOrganizer(s) {
    return (
      s?.tournament?.organizer ??
      s?.tournament?.organizer_username ??
      s?.organizer ??
      "@telegram_account"
    );
  }

  function pickLobbyPlayers(s) {
    return (
      s?.lobby?.players ??
      s?.lobby?.players_live ??
      s?.players ??
      []
    );
  }

  function pickGroupMembers(s) {
    return (
      s?.group?.members ??
      s?.group?.players ??
      s?.group_members ??
      []
    );
  }

  async function refresh() {
    const s = await PublicApi.state(tournamentId);

    // header
    if (elTitle) elTitle.textContent = pickTournamentName(s);
    if (elOrg) elOrg.textContent = pickOrganizer(s);

    const phase = s?.phase || "countdown";

    // default
    showTimerBlock(false);
    showStatus(false, "");

    // 1) countdown/registration/late_join -> показуємо кільце
    if (phase === "countdown" || phase === "registration" || phase === "late_join") {
      showTimerBlock(true);

      const left = pickSecondsToStart(s);
      if (elTime) elTime.textContent = fmtTime(left);
      setRingProgress(left);

      if (elTimerNote) {
        const joinAllowed = !!(s?.lobby?.join_allowed ?? s?.lobby?.joinAllowed);
        elTimerNote.textContent = joinAllowed ? "Реєстрація відкрита" : "Очікуємо старт";
      }

      if (elPlayersTitle) elPlayersTitle.textContent = "Учасники";
      if (elNote) elNote.textContent = "Список оновлюється (бекенд).";

      renderPlayers(pickLobbyPlayers(s));
      return;
    }

    // 2) forming_groups
    if (phase === "forming_groups" || phase === "forming") {
      showTimerBlock(false);
      showStatus(true, "Реєстрація завершена! Формуються групи");

      if (elPlayersTitle) elPlayersTitle.textContent = "Учасники";
      if (elNote) elNote.textContent = "Список оновлюється (бекенд).";

      renderPlayers(pickLobbyPlayers(s));
      return;
    }

    // 3) group -> показуємо групу і редіректимо в гру
    if (phase === "group" || phase === "group_ready") {
      const gTitle =
        s?.group?.title ||
        s?.group?.name ||
        "Твоя група";

      showStatus(true, gTitle);

      if (elPlayersTitle) elPlayersTitle.textContent = "Гравці твоєї групи";
      if (elNote) elNote.textContent = "Група сформована.";

      renderPlayers(pickGroupMembers(s));

      // ✅ без зайвих параметрів; підтримуємо старий public_id як fallback
      window.location.href = `./public_game.html?tournament_id=${encodeURIComponent(tournamentId)}&public_id=${encodeURIComponent(tournamentId)}`;
      return;
    }

    // 4) finished -> результати
    if (phase === "finished") {
      window.location.href = `./public_game_result.html?tournament_id=${encodeURIComponent(tournamentId)}&public_id=${encodeURIComponent(tournamentId)}`;
      return;
    }

    // unknown phase
    showStatus(true, `Невідомий стан: ${phase}`);
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    stop();
    tournamentId = readTournamentId();

    if (!tournamentId) {
      showStatus(true, "Немає tournament_id у URL");
      return;
    }

    try {
      await refresh();
    } catch (e) {
      console.error(e);
      showStatus(true, `Помилка state: ${String(e.message || e)}`);
    }

    pollTimer = setInterval(() => {
      refresh().catch((e) => {
        console.error(e);
        // не спамимо UI, але в консолі видно
      });
    }, POLL_MS);
  });
})();
