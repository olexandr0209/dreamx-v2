// webapp/public/src/js/tournament_client.js
(function () {
  const BASE = window.DREAMX_API_BASE || "https://dreamx-v2.onrender.com";

  function getTgUserId() {
    const id = window.DreamX?.getTgUserId?.();
    if (id) return String(id);

    // fallback (на всяк випадок)
    const p = new URLSearchParams(window.location.search);
    return p.get("tg_user_id");
  }

  async function apiGet(path) {
    try {
      const r = await fetch(`${BASE}${path}`, { method: "GET" });
      return await r.json();
    } catch (e) {
      return { ok: false, error: "network_error", details: String(e?.message || e) };
    }
  }

  async function apiPostForm(path, body) {
    try {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(body || {})) {
        if (v === undefined || v === null) continue;
        form.append(k, String(v));
      }

      const r = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: form.toString(),
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: "network_error", details: String(e?.message || e) };
    }
  }

  function _requireIds(tournamentId) {
    const tgId = getTgUserId();
    if (!tgId) return { ok: false, error: "no_tg_user_id" };
    if (!tournamentId) return { ok: false, error: "no_tournament_id" };
    return { ok: true, tgId: String(tgId), tid: String(tournamentId) };
  }

  window.TournamentApi = {
    state: async (tournamentId) => {
      const ids = _requireIds(tournamentId);
      if (!ids.ok) return ids;
      return apiGet(`/tg/state?tournament_id=${encodeURIComponent(ids.tid)}&tg_user_id=${encodeURIComponent(ids.tgId)}`);
    },

    join: async (tournamentId, joinCode) => {
      const ids = _requireIds(tournamentId);
      if (!ids.ok) return ids;

      return apiPostForm("/tg/join", {
        tournament_id: ids.tid,
        tg_user_id: ids.tgId,
        join_code: joinCode || "",
      });
    },

    leave: async (tournamentId) => {
      const ids = _requireIds(tournamentId);
      if (!ids.ok) return ids;

      return apiPostForm("/tg/leave", {
        tournament_id: ids.tid,
        tg_user_id: ids.tgId,
      });
    },

    move: async (tournamentId, matchId, move) => {
      const ids = _requireIds(tournamentId);
      if (!ids.ok) return ids;

      return apiPostForm("/tg/move", {
        tournament_id: ids.tid,
        tg_user_id: ids.tgId,
        match_id: matchId,
        move: move,
      });
    },
  };
})();

