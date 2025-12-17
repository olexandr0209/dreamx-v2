// webapp/public/src/js/pvp_screen.js

(function () {
  if (!window.PvP) {
    console.error("[PvP] PvP client not loaded");
    return;
  }

  const POLL_INTERVAL = 1500;

  let matchId = null;
  let pollTimer = null;

  let lastStatus = null; // щоб не спамити onMatchStarted

  // ✅ NEW: чи зараз можна робити хід (сервер каже res.can_move)
  let canMoveNow = false;

  const Events = {
    onQueueJoined: (match) => {},
    onWaitingOpponent: (match) => {},
    onMatchStarted: (match) => {},
    onStateUpdate: (state) => {},
    onCanMove: (state) => {},
    onRoundResolved: (result) => {},
    onError: (err) => {},
  };

  async function joinQueue() {
    const res = await window.PvP.joinQueue();
    if (!res.ok) {
      Events.onError(res);
      return;
    }

    matchId = res.match.id;
    lastStatus = res.match.status || null;

    // ✅ NEW: на старті точно не знаємо, чи можна ходити
    canMoveNow = false;

    Events.onQueueJoined(res.match);
    startPolling();
  }

  async function pollState() {
    if (!matchId) return;

    const res = await window.PvP.getMatchState(matchId);
    if (!res.ok) {
      Events.onError(res);
      return;
    }

    const match = res.match;
    Events.onStateUpdate(res);

    // waiting
    if (match.status === "waiting") {
      lastStatus = "waiting";
      canMoveNow = false; // ✅ NEW
      Events.onWaitingOpponent(match);
      return;
    }

    // playing
    if (match.status === "playing") {
      if (lastStatus !== "playing") {
        Events.onMatchStarted(match); // ✅ тільки 1 раз
        lastStatus = "playing";
      }

      // ✅ NEW: єдине джерело правди — res.can_move
      canMoveNow = !!res.can_move;

      if (canMoveNow) {
        Events.onCanMove(res);
      }

      return;
    }

    // інші стани (на майбутнє)
    lastStatus = match.status;
    canMoveNow = false; // ✅ NEW
  }

  async function sendMove(move) {
    if (!matchId) {
      Events.onError({ ok: false, error: "no_match" });
      return;
    }

    // ✅ NEW: не шлемо запит, якщо зараз не твій хід
    if (!canMoveNow) {
      return;
    }

    // ✅ NEW: одразу блокуємо повторні кліки до наступного pollState
    canMoveNow = false;

    const res = await window.PvP.sendMove(matchId, move);
    if (!res.ok) {
      Events.onError(res);
      return;
    }

    if (res.status === "resolved") {
      Events.onRoundResolved(res); // ✅ тільки коли є реальний resolved payload
    }

    // ✅ швидше оновлюємо стан
    pollState();
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
  }

  window.PvPScreen = {
    start: joinQueue,
    sendMove,
    stop: stopPolling,
    events: Events,
  };
})();
