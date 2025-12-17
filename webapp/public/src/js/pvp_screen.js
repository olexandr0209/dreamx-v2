// webapp/public/src/js/pvp_screen.js

(function () {
  if (!window.PvP) {
    console.error("[PvP] PvP client not loaded");
    return;
  }

  const POLL_INTERVAL = 1500;

  let matchId = null;
  let pollTimer = null;

  let lastStatus = null;
  let canMoveNow = false;

  // ✅ NEW: щоб не домальовувати один і той самий resolved багато разів
  let lastResolvedKey = null;

  const Events = {
    onQueueJoined: (match) => {},
    onWaitingOpponent: (match) => {},
    onMatchStarted: (match) => {},
    onMatchFinished: (match) => {},
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

    canMoveNow = false;
    lastResolvedKey = null;

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

    if (!match || !match.status) {
      Events.onError({ ok: false, error: "bad_state_payload" });
      return;
    }

    Events.onStateUpdate(res);

    // ✅ NEW: домальовуємо останній resolved з polling (для обох гравців)
    const lr = res.last_resolved;
    if (lr && lr.status === "resolved") {
      const k = lr.key || null;
      if (k && k !== lastResolvedKey) {
        lastResolvedKey = k;
        Events.onRoundResolved(lr);
      }
    }

    if (match.status === "finished") {
      canMoveNow = false;

      if (lastStatus !== "finished") {
        lastStatus = "finished";
        stopPolling();
        Events.onMatchFinished(match);
      }
      return;
    }

    if (match.status === "waiting") {
      canMoveNow = false;

      if (lastStatus !== "waiting") {
        lastStatus = "waiting";
        Events.onWaitingOpponent(match);
      }
      return;
    }

    if (match.status === "playing") {
      if (lastStatus !== "playing") {
        Events.onMatchStarted(match);
        lastStatus = "playing";
      }

      canMoveNow = !!res.can_move;
      if (canMoveNow) Events.onCanMove(res);
      return;
    }

    lastStatus = match.status;
    canMoveNow = false;
  }

  async function sendMove(move) {
    if (!matchId) {
      Events.onError({ ok: false, error: "no_match" });
      return;
    }

    if (!canMoveNow) {
      Events.onError({ ok: false, error: "not_your_turn" });
      pollState();
      return;
    }

    canMoveNow = false;

    const res = await window.PvP.sendMove(matchId, move);
    if (!res.ok) {
      Events.onError(res);
      return;
    }

    if (res.status === "resolved") {
      // ✅ NEW: запамʼятали key, щоб polling не викликав resolved вдруге
      if (res.key) lastResolvedKey = res.key;

      Events.onRoundResolved(res);

      if (res.game_over && res.match) {
        lastStatus = "finished";
        stopPolling();
        Events.onMatchFinished(res.match);
        return;
      }
    }

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
