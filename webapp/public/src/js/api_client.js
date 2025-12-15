// api_client.js

const API_BASE = window.DREAMX_API_BASE || "https://dreamx-v2.onrender.com";

function _headers() {
  const tgId = window.DreamX?.getTgUserId?.();
  const h = { "Content-Type": "application/json" };
  if (tgId) h["X-Tg-User-Id"] = tgId; // хай буде
  return h;
}

async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, { headers: _headers() });
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

window.Api = {
  // ✅ ТУТ ФІКС:
  me: () => {
    const tgId = window.DreamX?.getTgUserId?.();
    return apiGet(`/players/me?tg_user_id=${encodeURIComponent(tgId || "")}`);
  },

  // ✅ будемо грати через один ендпоінт
  botPlay: (move) => apiPost("/games/bot/play", { move }),
};
