// webapp/public/src/js/pvp_screen.js

(function () {
  if (!window.PvP) {
    console.error("[PvP] PvP client not loaded");
    return;
  }

  const POLL_INTERVAL = 1500;

  let matchId = null;
  let pollTimer = null;

  let lastStatus = null; // щоб не спамити onMatchStarted / onMatchFinished / onWaitingOpponent

  // ✅ чи зараз можна робити хід (сервер каже res.can_move)
  let canMoveNow = false;

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

    // ✅ на старті точно не знаємо, чи можна ходити
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

    // ✅ NEW: броня від битого payload
    if (!match || !match.status) {
      Events.onError({ ok: false, error: "bad_state_payload" });
      return;
    }

    Events.onStateUpdate(res);

    // ✅ finished
    if (match.status === "finished") {
      canMoveNow = false;

      if (lastStatus !== "finished") {
        lastStatus = "finished";
        stopPolling();
        Events.onMatchFinished(match); // ✅ тільки 1 раз
      }
      return;
    }

    // ✅ waiting (не спамимо кожен poll)
    if (match.status === "waiting") {
      canMoveNow = false;

      if (lastStatus !== "waiting") {
        lastStatus = "waiting";
        Events.onWaitingOpponent(match);
      }
      return;
    }

    // playing
    if (match.status === "playing") {
      if (lastStatus !== "playing") {
        Events.onMatchStarted(match); // ✅ тільки 1 раз
        lastStatus = "playing";
      }

      // ✅ єдине джерело правди — res.can_move
      canMoveNow = !!res.can_move;

      if (canMoveNow) {
        Events.onCanMove(res);
      }

      return;
    }

    // інші стани (на майбутнє)
    lastStatus = match.status;
    canMoveNow = false;
  }

  async function sendMove(move) {
    if (!matchId) {
      Events.onError({ ok: false, error: "no_match" });
      return;
    }

    // ✅ не шлемо запит, якщо зараз не твій хід
    if (!canMoveNow) return;

    // ✅ одразу блокуємо повторні кліки до наступного pollState
    canMoveNow = false;

    const res = await window.PvP.sendMove(matchId, move);
    if (!res.ok) {
      Events.onError(res);
      return;
    }

    if (res.status === "resolved") {
      Events.onRoundResolved(res); // ✅ тільки коли є реальний resolved payload

      // ✅ якщо сервер сказав що матч завершився — фінішуємо одразу
      if (res.game_over && res.match) {
        lastStatus = "finished";
        stopPolling();
        Events.onMatchFinished(res.match);
        return;
      }
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
