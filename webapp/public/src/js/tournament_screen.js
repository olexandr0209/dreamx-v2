// webapp/public/src/js/tournament_screen.js
(function () {
  if (!window.TournamentApi) {
    console.error("[Tournament] tournament_client.js not loaded");
    return;
  }

  const POLL_INTERVAL = 1500;

  let tournamentId = null;
  let pollTimer = null;

  let lastMatchId = null;
  let lastNeedMove = false;

  let autoJoinWanted = false;
  let autoJoinDone = false;

  const $ = (id) => document.getElementById(id);
  const setHidden = (el, flag) => { if (el) el.hidden = !!flag; };

  const scrFind = $("scr-find");
  const scrReg = $("scr-registration");
  const scrWait = $("scr-waiting");
  const scrGroup = $("scr-group");
  const scrError = $("scr-error");

  const elJoinCode = $("tg-join-code");
  const elOpen = $("tg-open");
  const elJoin = $("tg-join");

  const elStartBlock = $("tg-start-block");
  const elStartIn = $("tg-start-in");

  const elPlayersCountBlock = $("tg-players-count-block");
  const elPlayersCount = $("tg-players-count");

  const elRing = $("tg-ring");
  const elRingTime = $("tg-ring-time");

  const elGroupTitle = $("tg-group-title");
  const elGroupMembers = $("tg-group-members");
  const elGroupLoading = $("tg-group-loading");

  const elGame = $("tg-game");
  const elMyPick = $("tg-my-pick");
  const elOpPick = $("tg-op-pick");
  const elSeries = $("tg-series");
  const elGameNo = $("tg-game-no");
  const elTurn = $("tg-turn");

  const moves = Array.from(document.querySelectorAll(".tg-move[data-move]"));

  const elErrText = $("tg-error-text");
  const elBackFind = $("tg-back-find");

  const menuBtns = ["tg-menu-1", "tg-menu-2", "tg-menu-3"].map($).filter(Boolean);
  const elPublicList = $("tg-public-list");

  function showScreen(which) {
    const all = [scrFind, scrReg, scrWait, scrGroup, scrError].filter(Boolean);
    for (const s of all) s.hidden = true;
    if (which) which.hidden = false;
  }

  function fmtTime(sec) {
    if (sec == null) return "—";
    const s = Math.max(0, Number(sec) | 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function setMovesEnabled(flag) {
    for (const b of moves) b.disabled = !flag;
  }

  function moveToEmoji(m) {
    if (m === "rock") return "🪨";
    if (m === "paper") return "📄";
    if (m === "scissors") return "✂️";
    return "—";
  }

  function getMeTgId() {
    const id = window.DreamX?.getTgUserId?.();
    if (id) return Number(id);
    const p = new URLSearchParams(window.location.search);
    const q = p.get("tg_user_id");
    return q ? Number(q) : null;
  }

  function renderRegistration(state) {
    showScreen(scrReg);

    const joined = !!state?.joined;
    const sec = state?.seconds_to_start;

    if (elStartBlock) {
      if (sec != null) {
        elStartBlock.hidden = false;
        if (elStartIn) elStartIn.textContent = fmtTime(sec);
      } else {
        elStartBlock.hidden = true;
      }
    }

    if (elJoin) {
      elJoin.disabled = joined;
      elJoin.textContent = joined ? "✅ Ви приєднались" : "✅ Join";
    }
  }

  function renderWaiting(state) {
    showScreen(scrWait);

    const count = state?.players_count;
    if (elPlayersCountBlock) {
      if (count != null) {
        elPlayersCountBlock.hidden = false;
        if (elPlayersCount) elPlayersCount.textContent = String(count);
      } else {
        elPlayersCountBlock.hidden = true;
      }
    }

    const sec = state?.seconds_to_start;
    if (elRingTime) elRingTime.textContent = fmtTime(sec);

    const total = state?.start_total_sec;
    if (elRing) {
      let p = 0;
      if (sec != null && total != null && Number(total) > 0) {
        p = Math.max(0, Math.min(1, 1 - (Number(sec) / Number(total))));
      }
      elRing.style.setProperty("--p", String(p));
    }
  }

  function renderGroup(state) {
    showScreen(scrGroup);

    const gNo = state?.group?.group_no ?? "—";
    if (elGroupTitle) elGroupTitle.textContent = `Ваша група № ${gNo}`;

    const members = Array.isArray(state?.group_members) ? state.group_members : [];
    const me = getMeTgId();

    if (elGroupMembers) {
      if (!members.length) {
        elGroupMembers.innerHTML = `<li>—</li>`;
      } else {
        elGroupMembers.innerHTML = members.map((m) => {
          const isMe = me != null && Number(m.tg_user_id) === Number(me);
          const cls = isMe ? ` class="me"` : "";
          const label = m.username ? `@${m.username}` : `@${m.tg_user_id}`;
          return `<li${cls}>${label}</li>`;
        }).join("");
      }
    }

    const match = state?.match || null;

    if (!match) {
      setHidden(elGame, true);
      setHidden(elGroupLoading, false);
      setMovesEnabled(false);
      lastMatchId = null;
      lastNeedMove = false;
      return;
    }

    setHidden(elGroupLoading, true);
    setHidden(elGame, false);

    lastMatchId = match?.id != null ? Number(match.id) : null;
    if (!Number.isFinite(lastMatchId)) lastMatchId = null;

    lastNeedMove = !!match.need_move;

    const youP1 = !!match.you_are_p1;
    const p1 = Number(match.p1_series_points ?? 0);
    const p2 = Number(match.p2_series_points ?? 0);
    const myScore = youP1 ? p1 : p2;
    const opScore = youP1 ? p2 : p1;

    if (elSeries) elSeries.textContent = `${myScore} : ${opScore}`;
    if (elGameNo) elGameNo.textContent = `Гра ${match.next_game_no ?? "—"} / ${match.series_total ?? "—"}`;

    if (elMyPick) elMyPick.textContent = moveToEmoji(match.my_move);
    if (elOpPick) elOpPick.textContent = moveToEmoji(match.opponent_move);

    if (elTurn) elTurn.textContent = lastNeedMove ? "Твій хід" : "Очікуй хід суперника";
    setMovesEnabled(lastNeedMove);
  }

  function renderMessage(obj) {
    showScreen(scrError);
    if (elErrText) elErrText.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function readStartParam() {
    try {
      return window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
    } catch (e) {
      return "";
    }
  }

  function parseTournamentStartParam(sp) {
    if (!sp) return null;
    if (!String(sp).startsWith("t_")) return null;
    const parts = String(sp).split("_");
    if (parts.length < 3) return null;

    const tid = parts[1];
    const code = parts.slice(2).join("_");
    if (!tid) return null;

    return { tid: String(tid), joinCode: String(code || "") };
  }

  function setTid(tid) {
    tournamentId = tid ? String(tid) : null;
  }

  async function pollState() {
    if (!tournamentId) return;

    const res = await window.TournamentApi.state(tournamentId);
    if (!res.ok) {
      renderMessage(res);
      stopPolling();
      return;
    }

    const phase = res.phase || "—";

    if (phase === "registration" && autoJoinWanted && !autoJoinDone && !res.joined) {
      autoJoinDone = true;

      const code = elJoinCode?.value ? String(elJoinCode.value).trim() : "";
      const j = await window.TournamentApi.join(tournamentId, code || "");
      if (!j.ok) {
        renderMessage(j);
        stopPolling();
        return;
      }
      return;
    }

    if (phase === "registration") return renderRegistration(res);
    if (phase === "waiting_group") return renderWaiting(res);
    if (phase === "group") return renderGroup(res);

    renderRegistration(res);
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollState, POLL_INTERVAL);
    pollState();
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function joinNow() {
    if (!tournamentId) return;
    const code = elJoinCode?.value ? String(elJoinCode.value).trim() : "";
    const res = await window.TournamentApi.join(tournamentId, code || "");
    if (!res.ok) {
      renderMessage(res);
      return;
    }
    startPolling();
  }

  async function sendMove(move) {
    if (!tournamentId) return;
    if (!lastMatchId) return;
    if (!lastNeedMove) return;

    setMovesEnabled(false);
    const res = await window.TournamentApi.move(tournamentId, lastMatchId, move);
    if (!res.ok) {
      renderMessage(res);
      return;
    }
    pollState();
  }

  function goMenu() {
    window.location.href = "./index.html";
  }

  function bindUi() {
    if (elOpen) {
      elOpen.addEventListener("click", () => {
        const code = elJoinCode?.value ? String(elJoinCode.value).trim() : "";
        if (!code) {
          renderMessage("ℹ️ На цьому кроці: private пошук по join_code ще не підключений (заглушка).");
          return;
        }
        renderMessage(`✅ Заглушка\n\nВвів join_code: ${code}\n\nДалі підключимо бекенд.`);
      });
    }

    if (elJoin) elJoin.addEventListener("click", () => joinNow());
    for (const b of moves) b.addEventListener("click", () => sendMove(b.dataset.move));
    for (const b of menuBtns) b.addEventListener("click", goMenu);

    if (elBackFind) {
      elBackFind.addEventListener("click", () => {
        stopPolling();
        setTid(null);
        autoJoinWanted = false;
        autoJoinDone = false;
        showScreen(scrFind);
      });
    }
  }

  // ✅ Public list now navigates to separate page
  function renderPublicStub() {
    if (!elPublicList) return;

    const items = [
      { id: 101, title: "Public Tournament #101", subtitle: "Реєстрація 30 сек • Групи • Матч", organizer: "@dreamx_admin" },
      { id: 102, title: "Public Tournament #102", subtitle: "Тестовий public flow", organizer: "@dreamx_admin" },
      { id: 103, title: "Public Tournament #103", subtitle: "Далі підключимо API", organizer: "@dreamx_admin" },
    ];

    elPublicList.innerHTML = items.map((t) => `
      <button class="tg-public-item" data-pub-id="${t.id}" data-org="${t.organizer}">
        <div class="tg-public-item__title">${t.title}</div>
        <div class="tg-public-item__sub">${t.subtitle}</div>
      </button>
    `).join("");

    elPublicList.querySelectorAll("[data-pub-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-pub-id");
        const org = btn.getAttribute("data-org") || "@telegram_account";
        window.location.href = `./public_tournament.html?public_id=${encodeURIComponent(id)}&org=${encodeURIComponent(org)}`;
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindUi();
    renderPublicStub();

    // Telegram start_param => private реальний режим (як було)
    let tid = null;
    const sp = readStartParam();
    const parsed = parseTournamentStartParam(sp);
    if (parsed?.tid) {
      tid = parsed.tid;
      if (elJoinCode && parsed.joinCode) elJoinCode.value = parsed.joinCode;
      autoJoinWanted = true;
    }

    if (tid) {
      setTid(tid);
      startPolling();
    } else {
      showScreen(scrFind);
    }
  });
})();
