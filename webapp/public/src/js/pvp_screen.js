// pvp_screen.js

(function () {
  if (!window.PvP) {
    console.error("[PvP] PvP client not loaded");
    return;
  }

  const POLL_INTERVAL = 1500; // ms

  let matchId = null;
  let pollTimer = null;
  let lastStepKey = null;

  /* =========================
     EVENTS (hooks for UI)
     ========================= */

  const Events = {
    onQueueJoined: (match) => {},
    onWaitingOpponent: (match) => {},
    onMatchStarted: (match) => {},
    onStateUpdate: (state) => {},
    onCanMove: (state) => {},
    onRoundResolved: (result) => {},
    onError: (err) => {},
  };

  /* =========================
     CORE
     ========================= */

  async function joinQueue() {
    const res = await window.PvP.joinQueue();
    if (!res.ok) {
      Events.onError(res);
      return;
    }

    matchId = res.match.id;
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

    if (match.status === "waiting") {
      Events.onWaitingOpponent(match);
      return;
    }

    if (match.status === "playing") {
      Events.onMatchStarted(match);

      if (res.can_move) {
        Events.onCanMove(res);
      }

      detectStepResolution(match);
    }
  }

  function detectStepResolution(match) {
    const stepKey = `${match.round_number}:${match.step_in_round}`;

    // якщо step змінився → попередній хід вирішено
    if (lastStepKey && stepKey !== lastStepKey) {
      Events.onRoundResolved(match);
    }

    lastStepKey = stepKey;
  }

  async function sendMove(move) {
    if (!matchId) {
      Events.onError({ error: "no_match" });
      return;
    }

    const res = await window.PvP.sendMove(matchId, move);
    if (!res.ok) {
      Events.onError(res);
      return;
    }

    if (res.status === "resolved") {
      Events.onRoundResolved(res);
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollState, POLL_INTERVAL);
    pollState(); // одразу
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* =========================
     PUBLIC API
     ========================= */

  window.PvPScreen = {
    start: joinQueue,
    sendMove,
    stop: stopPolling,

    // UI hooks
    events: Events,
  };
})();
