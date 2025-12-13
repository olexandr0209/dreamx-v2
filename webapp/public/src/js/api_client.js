// webapp/public/src/js/api_client.js
const API_BASE = window.DREAMX_API_BASE || "https://dreamx-v2.onrender.com";

function getTgId() {
  const id = window.DreamX?.getTgUserId?.();
  return id ? String(id) : null;
}

function headers() {
  const h = { "Content-Type": "application/json" };
  const tgId = getTgId();
  if (tgId) h["X-Tg-User-Id"] = tgId; // для POST-ів
  return h;
}

async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, { headers: headers() });
  return await r.json();
}

async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body || {}),
  });
  return await r.json();
}

window.Api = {
  me: () => {
    const tgId = getTgId();
    // ВАЖЛИВО: players.me читає tg_user_id з query -> додаємо його сюди
    return apiGet(`/players/me?tg_user_id=${encodeURIComponent(tgId || "")}`);
  },

  botPlay: (move) => {
    const tgId = getTgId();
    return apiPost("/games/bot/play", { tg_user_id: tgId, move });
  },
};
