// api_client.js

const API_BASE = window.DREAMX_API_BASE || "https://dreamx-v2.onrender.com";

/* =========================
   HELPERS
   ========================= */

// ✅ мінімальний фікс: беремо user з DreamX (Telegram → localStorage fallback)
function getTgUser() {
  try {
    return window.DreamX?.getUser?.() || window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch (e) {
    return null;
  }
}

// ✅ мінімальний фікс: tg_user_id теж через DreamX (не губиться при навігації)
function getTgUserId() {
  const id = window.DreamX?.getTgUserId?.();
  if (id) return String(id);

  // fallback: ?tg_user_id=... (залишаю як було)
  const p = new URLSearchParams(window.location.search);
  return p.get("tg_user_id");
}

function _headers() {
  // ⚠️ ВАЖЛИВО: НЕ додаємо кастомні headers (X-Tg-User-Id),
  // щоб не ловити CORS preflight / блокування браузером.
  return { "Content-Type": "application/json" };
}

async function apiGet(path) {
  // ✅ Без headers → без preflight
  const r = await fetch(`${API_BASE}${path}`, { method: "GET" });
  return await r.json();
}

async function apiPost(path, body) {
  // ✅ Simple request → без preflight
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body || {})) {
    if (v === undefined || v === null) continue;
    form.append(k, String(v));
  }

  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: form.toString(),
  });

  return await r.json();
}

/* =========================
   API
   ========================= */

window.Api = {
  /**
   * 🔑 Ensure user exists in DB (upsert)
   */
  ensure: async () => {
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
  },

  /**
   * 👤 Get my profile
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

    const tgId = getTgUserId();
    // tg_user_id передаємо в query, щоб бек гарантовано отримав його без header
    return apiPost(`/games/bot/play?tg_user_id=${encodeURIComponent(tgId)}`, { move });
  },
};

// ✅ NEW (SAFE): Telegram initData (для майбутніх secure endpoint-ів)
function getTgInitData() {
  try {
    if (window.DreamX && typeof window.DreamX.getInitData === "function") {
      const v = String(window.DreamX.getInitData() || "").trim();
      if (v) return v;
    }
  } catch (e) {}

  try {
    const v = window.Telegram?.WebApp?.initData;
    if (v) return String(v).trim();
  } catch (e) {}

  return "";
}

// ✅ NEW (SAFE): готові auth headers (НЕ використовується старим кодом)
function _authHeaders() {
  const h = {};
  const initData = getTgInitData();
  if (initData) h["X-Tg-Init-Data"] = initData;
  return h;
}

// (опційно на майбутнє) apiGet/apiPost з auth headers
async function apiGetAuth(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { ..._authHeaders() },
  });
  return await r.json();
}

async function apiPostAuth(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ..._authHeaders() },
    body: JSON.stringify(body || {}),
  });
  return await r.json();
}
