// webapp/public/src/js/pvp_client.js
(function () {
  const BASE = window.DREAMX_API_BASE || "https://dreamx-v2.onrender.com";

  function getTgUserId() {
    const id = window.DreamX?.getTgUserId?.();
    if (id) return String(id);
    const p = new URLSearchParams(window.location.search);
    return p.get("tg_user_id");
  }

  async function apiGet(path) {
    const r = await fetch(`${BASE}${path}`, { method: "GET" });
    return await r.json();
  }

  async function apiPost(path, body) {
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
  }

  async function ensureUser() {
    // якщо api_client.js підключений — використовуємо його (найкраще)
    if (window.Api?.ensure) {
      return await window.Api.ensure();
    }
    // fallback (на всякий випадок): просто не блокуємо PvP
    return { ok: true };
  }

  window.PvP = {
    joinQueue: async () => {
      const tgId = getTgUserId();
      if (!tgId) return { ok: false, error: "no_tg_user_id" };

      const ensured = await ensureUser();
      if (ensured && ensured.ok === false) return ensured;

      return apiPost(`/pvp/queue/join?tg_user_id=${encodeURIComponent(tgId)}`, {});
    },

    getMatchState: async (matchId) => {
      const tgId = getTgUserId();
      if (!tgId || !matchId) return { ok: false, error: "missing_params" };

      return apiGet(
        `/pvp/match/state?tg_user_id=${encodeURIComponent(tgId)}&match_id=${encodeURIComponent(matchId)}`
      );
    },

    sendMove: async (matchId, move) => {
      const tgId = getTgUserId();
      if (!tgId || !matchId) return { ok: false, error: "missing_params" };

      return apiPost(
        `/pvp/match/move?tg_user_id=${encodeURIComponent(tgId)}&match_id=${encodeURIComponent(matchId)}`,
        { move }
      );
    },
  };
})();
