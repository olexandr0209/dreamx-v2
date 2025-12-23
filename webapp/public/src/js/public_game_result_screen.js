// webapp/public/src/js/public_game_result_screen.js
(function () {
  const $ = (id) => document.getElementById(id);

  if (!window.PublicApi) {
    console.error("[PublicResult] public_api_client.js not loaded");
    return;
  }

  const elTitle = $("gr-title");
  const elSub = $("gr-sub");
  const elGroupTitle = $("gr-group-title");
  const elList = $("gr-list");

  const qs = new URLSearchParams(window.location.search);
  const tournamentId = Number(qs.get("tournament_id") || qs.get("public_id") || 0);

  // fallback (старі параметри можуть бути у тебе в url)
  const fallbackTournament = qs.get("t") || "Турнір";
  const fallbackOrg = qs.get("org") || "@organizator";
  const fallbackGroup = qs.get("group") || "";

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function pickPoints(x) {
    return Number(
      x?.points ??
      x?.total_points ??
      x?.score ??
      x?.sum_points ??
      0
    );
  }

  function pickTag(x) {
    return (
      x?.tag ||
      x?.username ||
      x?.user?.username ||
      (x?.tg_user_id ? `#${x.tg_user_id}` : "@user")
    );
  }

  function render(players, groupLabel) {
    if (!elList) return;

    const arr = Array.isArray(players) ? players : [];
    const sorted = [...arr].sort((a, b) => pickPoints(b) - pickPoints(a));

    elList.innerHTML = sorted.map((pl, idx) => {
      const rank = idx + 1;

      const advanced = pl?.advanced === true || rank <= 2; // якщо бек не дає advanced — топ-2
      const badgeText = advanced ? "✅ Проходить далі" : "Дякуємо за гру";

      const tag = pickTag(pl);
      const pts = pickPoints(pl);

      return `
        <div class="gr-item ${advanced ? "is-winner" : ""}">
          <div class="gr-rank">${rank}</div>

          <div class="gr-avatar" aria-label="avatar">
            <div class="gr-avatar__inner">AV</div>
          </div>

          <div class="gr-main">
            <div class="gr-tag">${escapeHtml(tag)}</div>
            <div class="gr-badge">${badgeText}</div>
          </div>

          <div class="gr-points">
            <div class="gr-points__num">${escapeHtml(String(pts))}</div>
            <div class="gr-points__lbl">балів</div>
          </div>
        </div>
      `;
    }).join("");

    if (elGroupTitle) {
      const g = groupLabel ? `Група ${groupLabel}` : "Група";
      elGroupTitle.textContent = `${g} • Результати`;
    }
  }

  function normalizeState(s) {
    const t = s?.tournament || {};
    const tournamentName = t?.name || s?.tournament_name || s?.name || fallbackTournament;
    const organizer = t?.organizer || s?.organizer || s?.org || fallbackOrg;

    // group label
    const g = s?.group || null;
    const groupLabel =
      g?.title ||
      g?.name ||
      g?.group_no ||
      g?.no ||
      fallbackGroup;

    // standings can be in different places
    const standings =
      s?.standings ||
      g?.standings ||
      g?.table ||
      s?.results ||
      [];

    return { tournamentName, organizer, groupLabel, standings, raw: s };
  }

  async function loadOnce() {
    // Якщо tournamentId немає — показуємо fallback і виходимо
    if (!tournamentId) {
      if (elTitle) elTitle.textContent = fallbackTournament;
      if (elSub) elSub.textContent = fallbackOrg;
      render([], fallbackGroup);
      return;
    }

    const s = await PublicApi.state(tournamentId);
    const n = normalizeState(s);

    if (elTitle) elTitle.textContent = n.tournamentName;
    if (elSub) elSub.textContent = n.organizer;

    render(n.standings, n.groupLabel);
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadOnce().catch((e) => {
      console.error(e);
      // якщо бек ще не готовий/нема stage — просто покажемо fallback без крашу
      if (elTitle) elTitle.textContent = fallbackTournament;
      if (elSub) elSub.textContent = fallbackOrg;

      // спробуємо показати хоч порожній список
      render([], fallbackGroup);
    });
  });
})();
