// api_client.js

const API_BASE = window.DREAMX_API_BASE || "https://dreamx-v2.onrender.com";

/* =========================
   HELPERS
   ========================= */

function getTgUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch (e) {
    return null;
  }
}

function getTgUserId() {
  // 1) Telegram WebApp
  const tgUser = getTgUser();
  if (tgUser?.id) return String(tgUser.id);

  // 2) fallback: ?tg_user_id=...
  const p = new URLSearchParams(window.location.search);
  return p.get("tg_user_id");
}

function _headers() {
  const tgId = getTgUserId();
  const h = { "Content-Type": "application/json" };
  if (tgId) h["X-Tg-User-Id"] = tgId;
  return h;
}

async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: _headers(),
  });
  return await r.json();
}

async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: _headers(),
    body: JSON.stringify(body || {}),
  });
  return await r.json();
}

/* =========================
   API
   ========================= */

window.Api = {
  /**
   * 🔑 Ensure user exists in DB (upsert)
   * MUST be called before any game / me / stats
   */
  ensure: async () => {
    const tgId = getTgUserId();
    if (!tgId) {
      return { ok: false, error: "no_tg_user_id" };
    }

    const tg = getTgUser();

    return apiPost("/players/upsert", {
      tg_user_id: tgId,
      username: tg?.username || null,
      first_name: tg?.first_name || null,
      last_name: tg?.last_name || null,
      language_code: tg?.language_code || null,
      photo_url: tg?.photo_url || null,
    });
  },

  /**
   * 👤 Get my profile
   * (automatically ensures user first)
   */
  me: async () => {
    const ensured = await window.Api.ensure();
    if (!ensured.ok) return ensured;

    const tgId = getTgUserId();
    return apiGet(`/players/me?tg_user_id=${encodeURIComponent(tgId)}`);
  },

  /**
   * 🎮 Play vs bot (RPS)
   */
  botPlay: async (move) => {
    const ensured = await window.Api.ensure();
    if (!ensured.ok) return ensured;

    return apiPost("/games/bot/play", { move });
  },
};
