// pvp_client.js

const API_BASE = window.DREAMX_API_BASE || "https://dreamx-v2.onrender.com";

/* =========================
   HELPERS (ті самі принципи)
   ========================= */

function getTgUserId() {
  const id = window.DreamX?.getTgUserId?.();
  if (id) return String(id);

  const p = new URLSearchParams(window.location.search);
  return p.get("tg_user_id");
}

async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "GET",
  });
  return await r.json();
}

async function apiPost(path, body) {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body || {})) {
    if (v === undefined || v === null) continue;
    form.append(k, String(v));
  }

  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: form.toString(),
  });

  return await r.json();
}

/* =========================
   PvP API
   ========================= */

window.PvP = {
  /**
   * 🟢 Join PvP queue
   * або повертає існуючий матч
   */
  joinQueue: async () => {
    const tgId = getTgUserId();
    if (!tgId) return { ok: false, error: "no_tg_user_id" };

    return apiPost(`/pvp/queue/join?tg_user_id=${encodeURIComponent(tgId)}`);
  },

  /**
   * 🔍 Get match state
   */
  getMatchState: async (matchId) => {
    const tgId = getTgUserId();
    if (!tgId || !matchId) {
      return { ok: false, error: "missing_params" };
    }

    return apiGet(
      `/pvp/match/state?tg_user_id=${encodeURIComponent(tgId)}&match_id=${encodeURIComponent(matchId)}`
    );
  },

  /**
   * ✊ Send move (rock / paper / scissors)
   */
  sendMove: async (matchId, move) => {
    const tgId = getTgUserId();
    if (!tgId || !matchId) {
      return { ok: false, error: "missing_params" };
    }

    return apiPost(
      `/pvp/match/move?tg_user_id=${encodeURIComponent(tgId)}&match_id=${encodeURIComponent(matchId)}`,
      { move }
    );
  },
};
