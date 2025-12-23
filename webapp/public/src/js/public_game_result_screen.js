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
  const elBack = $("gr-back");

  const qs = new URLSearchParams(window.location.search);
  const tournamentId = Number(qs.get("tournament_id") || qs.get("public_id") || 0);

  // fallback (старі параметри можуть бути у тебе в url)
  const fallbackTournament = qs.get("t") || "Турнір";
  const fallbackOrg = qs.get("org") || "@organizator";
  const fallbackGroup = qs.get("group") || "";

  // ✅ back link з tournament_id
  if (elBack) {
    const tid = tournamentId || (qs.get("tournament_id") || qs.get("public_id") || "");
    elBack.href = tid
      ? `./public_tournament.html?tournament_id=${encodeURIComponent(String(tid))}`
      : `./public_tournament.html`;
  }

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

    if (sorted.length === 0) {
      elList.innerHTML = `
        <div class="gr-item">
          <div class="gr-main">
            <div class="gr-tag">—</div>
            <div class="gr-badge">Немає даних standings</div>
          </div>
          <div class="gr-points">
            <div class="gr-points__num">0</div>
            <div class="gr-points__lbl">балів</div>
          </div>
        </div>
      `;
    } else {
      elList.innerHTML = sorted.map((pl, idx) => {
        const rank = idx + 1;
        const advanced = pl?.advanced === true || rank <= 2;
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
    }

    if (elGroupTitle) {
      const g = groupLabel ? `Група ${groupLabel}` : "Група";
      elGroupTitle.textContent = `${g} • Результати`;
    }
  }

  function normalizeState(s) {
    const t = s?.tournament || {};
    const tournamentName = t?.name || s?.tournament_name || s?.name || fallbackTournament;
    const organizer = t?.organizer || s?.organizer || s?.org || fallbackOrg;

    const g = s?.group || null;
    const groupLabel =
      g?.title ||
      g?.name ||
      g?.group_no ||
      g?.no ||
      fallbackGroup;

    const standings =
      s?.standings ||
      g?.standings ||
      g?.table ||
      s?.results ||
      [];

    return { tournamentName, organizer, groupLabel, standings };
  }

  async function loadOnce() {
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
      if (elTitle) elTitle.textContent = fallbackTournament;
      if (elSub) elSub.textContent = fallbackOrg;
      render([], fallbackGroup);
    });
  });
})();
