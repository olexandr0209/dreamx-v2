// webapp/public/src/js/public_game_result_screen.js
(function () {
  const $ = (id) => document.getElementById(id);

  const elTitle = $("gr-title");
  const elSub = $("gr-sub");
  const elGroupTitle = $("gr-group-title");
  const elList = $("gr-list");

  function readParams() {
    const p = new URLSearchParams(window.location.search);
    return {
      tournament: p.get("t") || "Турнір BestGamers",
      org: p.get("org") || "@organizator",
      group: p.get("group") || "A1",
    };
  }

  function render(players, group) {
    if (!elList) return;

    // sort desc by points
    const sorted = [...players].sort((a, b) => Number(b.points || 0) - Number(a.points || 0));

    elList.innerHTML = sorted.map((pl, idx) => {
      const rank = idx + 1;
      const isWinner = idx < 2;

      const tag = pl.tag || `@${pl.tg_user_id || "user"}`;
      const pts = Number(pl.points || 0);

      const badgeText = isWinner ? "✅ Проходить далі" : "Дякуємо за гру";

      return `
        <div class="gr-item ${isWinner ? "is-winner" : ""}">
          <div class="gr-rank">${rank}</div>

          <div class="gr-avatar" aria-label="avatar">
            <div class="gr-avatar__inner">AV</div>
          </div>

          <div class="gr-main">
            <div class="gr-tag">${tag}</div>
            <div class="gr-badge">${badgeText}</div>
          </div>

          <div class="gr-points">
            <div class="gr-points__num">${pts}</div>
            <div class="gr-points__lbl">балів</div>
          </div>
        </div>
      `;
    }).join("");

    if (elGroupTitle) elGroupTitle.textContent = `Група ${group} • Результати`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const { tournament, org, group } = readParams();

    if (elTitle) elTitle.textContent = tournament;
    if (elSub) elSub.textContent = org;

    // ✅ STUB data (3-5 players). Later -> from backend.
    const playersStub = [
      { tg_user_id: 1, tag: "@GamerOne", points: 12 },
      { tg_user_id: 2, tag: "@GamerTwo", points: 9 },
      { tg_user_id: 3, tag: "@GamerThree", points: 6 },
      { tg_user_id: 4, tag: "@GamerFour", points: 3 },
    ];

    render(playersStub, group);
  });
})();
