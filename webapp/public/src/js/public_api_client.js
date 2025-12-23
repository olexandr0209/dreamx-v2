// webapp/public/src/js/public_api_client.js
(function () {
  "use strict";

  const API_BASE = window.API_BASE || "";

  // DEV header (залишаємо як було)
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
    // 1) query (?tg=1001)
    const fromQuery = (_qs("tg") || "").trim();
    if (fromQuery) {
      localStorage.setItem(DEBUG_STORAGE_KEY, fromQuery);
      return fromQuery;
    }

    // 2) storage
    const fromStorage = (localStorage.getItem(DEBUG_STORAGE_KEY) || "").trim();
    if (fromStorage) return fromStorage;

    return "";
  }

  // ✅ NEW (MIN): prod tg_user_id з DreamX або Telegram WebApp
  function getProdTgUserId() {
    try {
      if (window.DreamX && typeof window.DreamX.getTgUserId === "function") {
        const v = String(window.DreamX.getTgUserId() || "").trim();
        if (v) return v;
      }
    } catch (_) {}

    try {
      const v = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (v) return String(v).trim();
    } catch (_) {}

    return "";
  }

  function buildHeaders(extra) {
    const h = Object.assign({ "Content-Type": "application/json" }, extra || {});

    // ✅ PROD: якщо є tg id з Telegram — не додаємо debug header
    const prodTg = getProdTgUserId();
    if (prodTg) return h;

    // ✅ DEV: як було — через ?tg=1001 та debug header
    const tg = getDebugTgUserId();
    if (!tg) {
      throw new Error("missing_tg_user_id");
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

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = { ok: false, error: "non_json_response", raw: text };
    }

    if (!res.ok) {
      const err = data.error || `HTTP_${res.status}`;
      throw new Error(err);
    }

    if (data && data.ok === false) {
      throw new Error(data.error || "api_error");
    }

    return data;
  }

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

  window.PublicApi = PublicApi;
})();
