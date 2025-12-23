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

  // ✅ optional (якщо додаси кнопку в HTML)
  const btnJoin = $("pt-join");

  const POLL_MS = 1200;

  const qs = new URLSearchParams(location.search);
  const tournamentId = Number(qs.get("tournament_id") || qs.get("public_id") || 0);

  if (!tournamentId) {
    if (elStatus) elStatus.hidden = false;
    if (elStatusText) elStatusText.textContent = "Помилка: немає tournament_id";
    return;
  }

  let pollTimer = null;
  let initTried = false; // ✅ 1 раз спробувати join якщо no_stage
  let joining = false;
  let isRefreshing = false;

  // ✅ для правильного progress кільця
  let ringTotalSec = null;

  function fmtTime(sec) {
    const s = Math.max(0, Number(sec) | 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function setRingProgress(total, left) {
    const T = Math.max(1, Number(total || 1));
    const L = Math.max(0, Number(left || 0));
    const p = Math.max(0, Math.min(1, 1 - (L / T)));
    if (elRing) elRing.style.setProperty("--p", String(p));
  }

  function renderPlayers(list) {
    const arr = Array.isArray(list) ? list : [];
    if (elCount) elCount.textContent = String(arr.length);

    if (!elPlayers) return;

    elPlayers.innerHTML = arr
      .map((p) => {
        const username = p.username || p.name || (p.tg_user_id ? `id${p.tg_user_id}` : "—");
        const tag = p.username ? `@${p.username}` : (p.tag || "");
        return `
          <div class="tg-player">
            <div class="tg-player__name">${escapeHtml(username)}</div>
            <div class="tg-player__tag">${escapeHtml(tag)}</div>
          </div>
        `;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showStatus(text) {
    if (elStatus) elStatus.hidden = false;
    if (elStatusText) elStatusText.textContent = text || "—";
  }

  function hideStatus() {
    if (elStatus) elStatus.hidden = true;
  }

  function showTimer() {
    if (elTimer) elTimer.hidden = false;
    if (elRing) elRing.hidden = false;
  }

  function hideTimer() {
    if (elTimer) elTimer.hidden = true;
    if (elRing) elRing.hidden = true;
  }

  function goGame() {
    location.href = `./public_game.html?tournament_id=${encodeURIComponent(String(tournamentId))}`;
  }

  async function doJoinOnce() {
    if (joining) return;
    joining = true;
    try {
      if (btnJoin) btnJoin.disabled = true;
      await PublicApi.join(tournamentId);
    } catch (e) {
      console.error(e);
    } finally {
      joining = false;
      if (btnJoin) btnJoin.disabled = false;
    }
  }

  function setJoinVisible(allowed) {
    if (!btnJoin) return;
    btnJoin.style.display = allowed ? "block" : "none";
    btnJoin.disabled = !allowed || joining;
  }

  async function refresh() {
    if (isRefreshing) return;
    isRefreshing = true;

    try {
      const s = await PublicApi.state(tournamentId);

      // header
      const t = s.tournament || {};
      if (elTitle) elTitle.textContent = t.name || `#${tournamentId}`;
      if (elOrg) elOrg.textContent = t.organizer || "—";

      const phase = s.phase || "unknown";

      // lobby players
      const lobby = s.lobby || {};
      const players = lobby.players || [];
      if (elPlayersTitle) elPlayersTitle.textContent = "Учасники";
      if (elNote) elNote.textContent = "Список оновлюється.";
      renderPlayers(players);

      // ✅ join visibility
      const joinAllowed = !!(s.join_allowed ?? lobby.join_allowed);
      setJoinVisible(joinAllowed);

      // phase routing / UI
      if (phase === "countdown" || phase === "registration" || phase === "late_join") {
        hideStatus();
        showTimer();

        const secondsLeft = Number(s.timers?.seconds_to_start ?? 0);

        // ✅ зафіксуємо total один раз на вході у фазу, щоб прогрес рухався
        if (ringTotalSec == null || ringTotalSec < secondsLeft) {
          ringTotalSec = Math.max(1, secondsLeft);
        }

        if (elTime) elTime.textContent = fmtTime(secondsLeft);
        setRingProgress(ringTotalSec || Math.max(secondsLeft, 1), secondsLeft);

        if (elTimerNote) {
          elTimerNote.textContent =
            phase === "countdown"
              ? "Старт скоро"
              : "Реєстрація відкрита";
        }
        return;
      }

      // ✅ коли виходимо з таймер-фаз — скидаємо total, щоб наступного разу було коректно
      ringTotalSec = null;

      if (phase === "forming_groups") {
        hideTimer();
        showStatus("Реєстрація завершена! Формуються групи…");
        if (elNote) elNote.textContent = "Очікуємо формування груп.";
        return;
      }

      if (phase === "group") {
        goGame();
        return;
      }

      if (phase === "finished") {
        hideTimer();
        showStatus("Турнір завершено");
        return;
      }

      // fallback
      hideTimer();
      showStatus(`Невідомий стан: ${phase}`);
    } catch (e) {
      const msg = String(e?.message || e || "");

      // ✅ якщо бек каже no_stage — 1 раз робимо join, щоб stage з’явився
      if (!initTried && (msg === "no_stage" || msg === "stage_not_found")) {
        initTried = true;
        await doJoinOnce();
        return;
      }

      hideTimer();
      showStatus(`Помилка state: ${msg || "unknown"}`);
      if (elNote) elNote.textContent = "Перевір tournament_id і бекенд.";
      renderPlayers([]);
      setJoinVisible(false);
    } finally {
      isRefreshing = false;
    }
  }

  function start() {
    if (btnJoin) {
      btnJoin.addEventListener("click", async () => {
        await doJoinOnce();
        refresh().catch(console.error);
      });
    }

    refresh().catch(console.error);
    pollTimer = setInterval(() => refresh().catch(console.error), POLL_MS);
  }

  document.addEventListener("DOMContentLoaded", start);
})();
