// webapp/public/src/js/pvp_client.js
(function () {

  // ✅ НЕ кешуємо BASE — беремо щоразу актуальний
  function getApiBase() {
    return window.DREAMX_API_BASE || "https://dreamx-v2.onrender.com";
  }

  function getTgUserId() {
    const id = window.DreamX?.getTgUserId?.();
    if (id) return String(id);
    const p = new URLSearchParams(window.location.search);
    return p.get("tg_user_id");
  }

  async function apiGet(path) {
    try {
      const r = await fetch(`${getApiBase()}${path}`, { method: "GET" });
      return await r.json();
    } catch (e) {
      return { ok: false, error: "network_error", details: String(e?.message || e) };
    }
  }

  async function apiPost(path, body) {
    try {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(body || {})) {
        if (v === undefined || v === null) continue;
        form.append(k, String(v));
      }

      const r = await fetch(`${getApiBase()}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: form.toString(),
      });

      return await r.json();
    } catch (e) {
      return { ok: false, error: "network_error", details: String(e?.message || e) };
    }
  }

  function getTgUser() {
    try {
      return (
        window.DreamX?.getUser?.() ||
        window.Telegram?.WebApp?.initDataUnsafe?.user ||
        null
      );
    } catch (e) {
      return null;
    }
  }

  async function ensureUser() {
    // 1) якщо api_client.js підключений — використовуємо його
    if (window.Api?.ensure) {
      return await window.Api.ensure();
    }

    // 2) fallback: робимо upsert напряму
    const tgId = getTgUserId();
    if (!tgId) return { ok: false, error: "no_tg_user_id" };

    const tg = getTgUser();
    return apiPost("/players/upsert", {
      tg_user_id: tgId,
      username: tg?.username || null,
      first_name: tg?.first_name || null,
      last_name: tg?.last_name || null,
      language_code: tg?.language_code || null,
      photo_url: tg?.photo_url || null,
    });
  }

  window.PvP = {
    joinQueue: async () => {
      const tgId = getTgUserId();
      if (!tgId) return { ok: false, error: "no_tg_user_id" };

      const ensured = await ensureUser();
      if (ensured && ensured.ok === false) return ensured;

      return apiPost(
        `/pvp/queue/join?tg_user_id=${encodeURIComponent(tgId)}`,
        {}
      );
    },

    // ✅ FIX: теж гарантуємо, що юзер існує (інакше може бути user_not_found)
    getMatchState: async (matchId) => {
      const tgId = getTgUserId();
      if (!tgId || !matchId) {
        return { ok: false, error: "missing_params" };
      }

      const ensured = await ensureUser();
      if (ensured && ensured.ok === false) return ensured;

      return apiGet(
        `/pvp/match/state?tg_user_id=${encodeURIComponent(tgId)}&match_id=${encodeURIComponent(matchId)}`
      );
    },

    // ✅ FIX: те саме для ходу
    sendMove: async (matchId, move) => {
      const tgId = getTgUserId();
      if (!tgId || !matchId) {
        return { ok: false, error: "missing_params" };
      }

      const ensured = await ensureUser();
      if (ensured && ensured.ok === false) return ensured;

      return apiPost(
        `/pvp/match/move?tg_user_id=${encodeURIComponent(tgId)}&match_id=${encodeURIComponent(matchId)}`,
        { move }
      );
    },
  };

})();
