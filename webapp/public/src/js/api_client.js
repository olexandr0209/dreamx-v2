// webapp/public/src/js/api_client.js

const API_BASE = window.DREAMX_API_BASE || "https://dreamx-v2.onrender.com";

function _headers() {
  const tgId = window.DreamX?.getTgUserId?.();
  const h = { "Content-Type": "application/json" };
  if (tgId) h["X-Tg-User-Id"] = tgId;
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
  me: () => apiGet("/players/me"),
  addPoints: (delta) => apiPost("/players/add_points", { delta }),
  logGame: (payload) => apiPost("/games/log", payload),
};

