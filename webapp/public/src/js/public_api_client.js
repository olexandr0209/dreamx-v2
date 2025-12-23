// webapp/public/src/js/public_api_client.js
(function () {
  "use strict";

  // Якщо бекенд і фронт на одному домені — лишай ""
  // Якщо бекенд окремо — у HTML перед підключенням цього файлу задай:
  // <script>window.API_BASE="https://your-backend.onrender.com";</script>
  const API_BASE = window.API_BASE || "";

  // DEV header (крок 3)
  const DEBUG_HEADER_NAME = "X-Debug-Tg-User-Id";
  const DEBUG_STORAGE_KEY = "DX_DEBUG_TG_USER_ID";

  function _qs(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (_) {
      return null;
    }
  }

  function getDebugTgUserId() {
    // 1) пробуємо взяти з query (?tg=1001)
    const fromQuery = (_qs("tg") || "").trim();
    if (fromQuery) {
      localStorage.setItem(DEBUG_STORAGE_KEY, fromQuery);
      return fromQuery;
    }

    // 2) беремо зі сховища
    const fromStorage = (localStorage.getItem(DEBUG_STORAGE_KEY) || "").trim();
    if (fromStorage) return fromStorage;

    // 3) нема — значить ти відкрив сторінку без tg
    return "";
  }

  function buildHeaders(extra) {
    const h = Object.assign(
      { "Content-Type": "application/json" },
      extra || {}
    );

    const tg = getDebugTgUserId();
    if (!tg) {
      // DEV: без tg заборонено, щоб не отримати “дивні” баги
      throw new Error("DEV: missing tg user id. Open page with ?tg=1001");
    }
    h[DEBUG_HEADER_NAME] = tg;

    return h;
  }

  async function requestJson(method, path, body) {
    const headers = buildHeaders();
    const url = API_BASE + path;

    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    // на випадок якщо бекенд віддасть не-json
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = { ok: false, error: "non_json_response", raw: text };
    }

    if (!res.ok) {
      // HTTP error
      const err = data.error || `HTTP_${res.status}`;
      throw new Error(err);
    }

    // У нас контракт: ok true/false
    if (data && data.ok === false) {
      throw new Error(data.error || "api_error");
    }

    return data;
  }

  // ---- Public API ----
  const PublicApi = {
    state(tournamentId) {
      if (!tournamentId) throw new Error("missing_tournament_id");
      return requestJson("GET", `/api/public/tournaments/${tournamentId}/state`);
    },

    join(tournamentId) {
      if (!tournamentId) throw new Error("missing_tournament_id");
      return requestJson("POST", `/api/public/tournaments/${tournamentId}/join`);
    },

    leave(tournamentId) {
      if (!tournamentId) throw new Error("missing_tournament_id");
      return requestJson("POST", `/api/public/tournaments/${tournamentId}/leave`);
    },

    move(tournamentId, matchId, move) {
      if (!tournamentId) throw new Error("missing_tournament_id");
      if (!matchId) throw new Error("missing_match_id");
      if (!move) throw new Error("missing_move");
      return requestJson("POST", `/api/public/matches/${matchId}/move`, {
        tournament_id: tournamentId,
        move: String(move).trim(),
      });
    },
  };

  // експортуємо глобально
  window.PublicApi = PublicApi;
})();
