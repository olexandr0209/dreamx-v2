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

  // ✅ авто-join (тільки 1 раз)
  let autoJoinWanted = false;
  let autoJoinDone = false;

  // ✅ NEW: public details timers (UI stub)
  let publicCountdownTimer = null;
  let publicPlayersTimer = null;

  // ✅ NEW: public state model (легко замінюється бекендом)
  const publicState = {
    open: false,
    phase: "idle", // idle | countdown | forming
    id: null,
    title: "—",
    organizer: "@telegram_account",
    seconds_left: 30,
    seconds_total: 30,
    players: [],
  };

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);

  const scrFind = $("scr-find");
  const scrReg = $("scr-registration");
  const scrWait = $("scr-waiting");
  const scrGroup = $("scr-group");
  const scrError = $("scr-error");
  const scrPublicDetails = $("scr-public-details");

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

  const elTopBack = $("tg-top-back");

  // ✅ public details elements
  const elPubTitle = $("tg-public-title");
  const elPubOrg = $("tg-public-organizer");
  const elPubStatus = $("tg-public-status");

  const elPubTime = $("tg-public-time");
  const elPubRing = $("tg-public-ring");
  const elPubPlayers = $("tg-public-players");
  const elPubCount = $("tg-public-count");

  const elPubTimerBlock = $("tg-public-timer-block");
  const elPubHint = $("tg-public-timer-hint");

  function showScreen(which) {
    const all = [scrFind, scrPublicDetails, scrReg, scrWait, scrGroup, scrError].filter(Boolean);
    for (const s of all) s.hidden = true;
    which.hidden = false;
  }

  function isPublicDetailsOpen() {
    return scrPublicDetails && scrPublicDetails.hidden === false;
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

  function renderRegistration(state) {
    showScreen(scrReg);

    const joined = !!state?.joined;
    const sec = state?.seconds_to_start;

    if (sec != null && elStartBlock) {
      elStartBlock.hidden = false;
      if (elStartIn) elStartIn.textContent = fmtTime(sec);
    } else if (elStartBlock) {
      elStartBlock.hidden = true;
    }

    if (elJoin) {
      elJoin.disabled = joined;
      elJoin.textContent = joined ? "✅ Ви приєднались" : "✅ Join";
    }
  }

  function renderWaiting(state) {
    showScreen(scrWait);

    const count = state?.players_count;
    if (count != null) {
      elPlayersCountBlock.hidden = false;
      elPlayersCount.textContent = String(count);
    } else {
      elPlayersCountBlock.hidden = true;
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

    const members = state?.group_members || [];
    const me = (window.DreamX?.getTgUserId?.() ? Number(window.DreamX.getTgUserId()) : null);

    if (!members.length) {
      elGroupMembers.innerHTML = `<li>—</li>`;
    } else {
      elGroupMembers.innerHTML = members.map((m) => {
        const isMe = me && Number(m.tg_user_id) === Number(me);
        const cls = isMe ? ` class="me"` : "";
        const label = m.username ? `@${m.username}` : `@${m.tg_user_id}`;
        return `<li${cls}>${label}</li>`;
      }).join("");
    }

    const match = state?.match || null;

    if (!match) {
      elGame.hidden = true;
      elGroupLoading.hidden = false;
      setMovesEnabled(false);
      lastMatchId = null;
      lastNeedMove = false;
      return;
    }

    elGroupLoading.hidden = true;
    elGame.hidden = false;

    lastMatchId = Number(match.id);
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

  // ---------------------------------------
  // ✅ Public details: state + render (stub)
  // ---------------------------------------

  function setPublicState(patch) {
    Object.assign(publicState, patch || {});
    renderPublicDetails();
  }

  function renderPlayers(list) {
    if (!elPubPlayers) return;

    elPubPlayers.innerHTML = (list || []).map((p) => {
      return `
        <div class="tg-player">
          <div class="tg-player__name">${p.name}</div>
          <div class="tg-player__tag">${p.tag}</div>
        </div>
      `;
    }).join("");

    if (elPubCount) elPubCount.textContent = String((list || []).length);
  }

  function renderPublicDetails() {
    if (!publicState.open) return;

    if (elPubTitle) elPubTitle.textContent = publicState.title || "—";
    if (elPubOrg) elPubOrg.textContent = publicState.organizer || "@telegram_account";

    // phase UI
    if (publicState.phase === "countdown") {
      if (elPubStatus) elPubStatus.hidden = true;
      if (elPubTimerBlock) elPubTimerBlock.hidden = false;

      if (elPubHint) elPubHint.textContent = "Тестовий відлік (заглушка)";
      if (elPubTime) elPubTime.textContent = fmtTime(publicState.seconds_left);

      if (elPubRing) {
        const total = Number(publicState.seconds_total || 30);
        const left = Number(publicState.seconds_left || 0);
        const p = total > 0 ? Math.max(0, Math.min(1, 1 - (left / total))) : 0;
        elPubRing.style.setProperty("--p", String(p));
      }
    }

    if (publicState.phase === "forming") {
      // ✅ Після 30 сек: тільки список + кількість + текст “Формуються групи”
      if (elPubTimerBlock) elPubTimerBlock.hidden = true;

      if (elPubStatus) {
        elPubStatus.hidden = false;
        elPubStatus.textContent = "Формуються групи";
      }
    }

    renderPlayers(publicState.players || []);
  }

  function stopPublicStubTimers() {
    if (publicCountdownTimer) clearInterval(publicCountdownTimer);
    publicCountdownTimer = null;
    if (publicPlayersTimer) clearInterval(publicPlayersTimer);
    publicPlayersTimer = null;
  }

  function openPublicDetails(stubTournament) {
    // UI-only: не чіпаємо бекенд
    stopPolling();
    setTid(null);

    stopPublicStubTimers();

    setPublicState({
      open: true,
      phase: "countdown",
      id: stubTournament?.id || null,
      title: stubTournament?.title || "Public tournament",
      organizer: stubTournament?.organizer || "@telegram_account",
      seconds_total: 30,
      seconds_left: 30,
      players: [],
    });

    showScreen(scrPublicDetails);

    // countdown tick (через state)
    const startedAt = Date.now();
    publicCountdownTimer = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, 30 - elapsed);
      const leftInt = Math.ceil(left);

      setPublicState({ seconds_left: leftInt });

      if (left <= 0) {
        clearInterval(publicCountdownTimer);
        publicCountdownTimer = null;

        // ✅ перехід у “forming”
        setPublicState({ phase: "forming" });
      }
    }, 250);

    // players online stub
    const pool = [
      { name: "Oleksandr", tag: "@oleksandr" },
      { name: "Andrii", tag: "@andrii" },
      { name: "Ira", tag: "@ira" },
      { name: "Dmytro", tag: "@dmytro" },
      { name: "Vlad", tag: "@vlad" },
      { name: "Katya", tag: "@katya" },
      { name: "Nazar", tag: "@nazar" },
      { name: "Maks", tag: "@maks" },
    ];

    publicPlayersTimer = setInterval(() => {
      const players = Array.isArray(publicState.players) ? [...publicState.players] : [];

      if (players.length < 6) {
        const next = pool[Math.floor(Math.random() * pool.length)];
        if (!players.find(x => x.tag === next.tag)) players.push(next);
      } else {
        players.sort(() => Math.random() - 0.5);
      }

      setPublicState({ players });
    }, 1200);
  }

  // ---- Core ----
  function readJoinCodeFromUrl() {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("join_code") || p.get("code") || p.get("tagid");
    return code ? String(code).trim() : "";
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
    // smart top back
    if (elTopBack) {
      elTopBack.addEventListener("click", (e) => {
        if (isPublicDetailsOpen()) {
          e.preventDefault();
          setPublicState({ open: false });
          stopPublicStubTimers();
          showScreen(scrFind);
          return;
        }
        // якщо не public details — звичайний href на index.html
      });
    }

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

    for (const b of moves) {
      b.addEventListener("click", () => sendMove(b.dataset.move));
    }

    for (const b of menuBtns) b.addEventListener("click", goMenu);

    if (elBackFind) {
      elBackFind.addEventListener("click", () => {
        stopPolling();
        stopPublicStubTimers();
        setTid(null);
        autoJoinWanted = false;
        autoJoinDone = false;
        showScreen(scrFind);
      });
    }
  }

  function renderPublicStub() {
    if (!elPublicList) return;

    const items = [
      { id: 101, title: "Public Tournament #101", organizer: "@dreamx_admin" },
      { id: 102, title: "Public Tournament #102", organizer: "@dreamx_admin" },
      { id: 103, title: "Public Tournament #103", organizer: "@dreamx_admin" },
    ];

    elPublicList.innerHTML = items.map((t) => {
      return `
        <button class="tg-public-item" data-pub-id="${t.id}">
          <div class="tg-public-item__title">${t.title}</div>
          <div class="tg-public-item__sub">Натисни — відкриється екран турніру (UI заглушка)</div>
        </button>
      `;
    }).join("");

    elPublicList.querySelectorAll("[data-pub-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tid = btn.getAttribute("data-pub-id");
        const t = items.find(x => String(x.id) === String(tid));
        openPublicDetails({
          id: tid,
          title: t?.title || `Public Tournament #${tid}`,
          organizer: t?.organizer || "@telegram_account",
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindUi();
    renderPublicStub();

    const urlJoinCode = readJoinCodeFromUrl();
    if (elJoinCode && urlJoinCode) elJoinCode.value = urlJoinCode;

    // Telegram start_param -> реальний режим (як було)
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
