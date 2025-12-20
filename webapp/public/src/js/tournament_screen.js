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

  // ✅ public stub timers
  let publicCountdownInterval = null;
  let publicPlayersInterval = null;
  let publicPhaseTimeout1 = null; // forming -> group_ready
  let publicPhaseTimeout2 = null; // group_ready -> game_stub

  // ✅ public state model (бекенд-friendly)
  const publicState = {
    open: false,
    phase: "idle", // idle | countdown | forming | group_ready | game_stub
    id: null,

    title: "—",
    organizer: "@telegram_account",

    seconds_total: 30,
    seconds_left: 30,

    players_live: [],     // під час countdown (оновлюється)
    players_final: [],    // “заморожений” список після формування
    my_tag: "@you",
    group_title: "Твоя група 1а",
  };

  const $ = (id) => document.getElementById(id);

  const scrFind = $("scr-find");
  const scrReg = $("scr-registration");
  const scrWait = $("scr-waiting");
  const scrGroup = $("scr-group");
  const scrError = $("scr-error");
  const scrPublicDetails = $("scr-public-details");
  const scrPublicGame = $("scr-public-game");

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

  // public details elements
  const elPubTitle = $("tg-public-title");
  const elPubOrg = $("tg-public-organizer");
  const elPubStatus = $("tg-public-status");
  const elPubBubble = $("tg-public-bubble");

  const elPubTime = $("tg-public-time");
  const elPubRing = $("tg-public-ring");
  const elPubTimerBlock = $("tg-public-timer-block");

  const elPubPlayers = $("tg-public-players");
  const elPubCount = $("tg-public-count");
  const elPubPlayersTitle = $("tg-public-players-title");
  const elPubPlayersNote = $("tg-public-players-note");

  function showScreen(which) {
    const all = [
      scrFind, scrPublicDetails, scrPublicGame,
      scrReg, scrWait, scrGroup, scrError,
    ].filter(Boolean);

    for (const s of all) s.hidden = true;
    which.hidden = false;
  }

  function isPublicOpen() {
    return publicState.open && scrPublicDetails && scrPublicDetails.hidden === false;
  }

  function fmtTime(sec) {
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

  // ---------------------------------------
  // Existing private tournament renders (unchanged)
  // ---------------------------------------

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
  // ✅ Public flow: state machine (backend-friendly)
  // ---------------------------------------

  function setPublicState(patch) {
    Object.assign(publicState, patch || {});
    renderPublic();
  }

  function renderPlayers(players) {
    if (!elPubPlayers) return;

    elPubPlayers.innerHTML = (players || []).map((p) => {
      return `
        <div class="tg-player">
          <div class="tg-player__name">${p.name}</div>
          <div class="tg-player__tag">${p.tag}</div>
        </div>
      `;
    }).join("");

    if (elPubCount) elPubCount.textContent = String((players || []).length);
  }

  function renderPublic() {
    if (!publicState.open) return;

    if (elPubTitle) elPubTitle.textContent = publicState.title || "—";
    if (elPubOrg) elPubOrg.textContent = publicState.organizer || "@telegram_account";

    // defaults
    if (elPubBubble) elPubBubble.hidden = true;

    if (publicState.phase === "countdown") {
      if (elPubTimerBlock) elPubTimerBlock.hidden = false;

      if (elPubStatus) elPubStatus.hidden = true;

      if (elPubTime) elPubTime.textContent = fmtTime(publicState.seconds_left);

      if (elPubRing) {
        const total = Number(publicState.seconds_total || 30);
        const left = Number(publicState.seconds_left || 0);
        const p = total > 0 ? Math.max(0, Math.min(1, 1 - (left / total))) : 0;
        elPubRing.style.setProperty("--p", String(p));
      }

      if (elPubPlayersTitle) elPubPlayersTitle.textContent = "Учасники";
      if (elPubPlayersNote) elPubPlayersNote.textContent = "Список оновлюється онлайн (заглушка).";

      renderPlayers(publicState.players_live);
      return;
    }

    if (publicState.phase === "forming") {
      // ✅ 1) зникнути коло часу
      if (elPubTimerBlock) elPubTimerBlock.hidden = true;

      // ✅ 2) список перестати оновлюватись (показуємо “заморожений” список)
      if (elPubPlayersTitle) elPubPlayersTitle.textContent = "Учасники";
      if (elPubPlayersNote) elPubPlayersNote.textContent = "Реєстрація завершена (заглушка).";

      // ✅ 3) текст реальний “forming” (потім з бекенду буде залежати)
      if (elPubStatus) {
        elPubStatus.hidden = false;
        elPubStatus.textContent = "Реєстрація завершена! Формуються групи";
      }

      renderPlayers(publicState.players_final);
      return;
    }

    if (publicState.phase === "group_ready") {
      if (elPubTimerBlock) elPubTimerBlock.hidden = true;

      // ✅ показуємо кружок зверху
      if (elPubBubble) elPubBubble.hidden = false;

      if (elPubStatus) {
        elPubStatus.hidden = false;
        elPubStatus.textContent = publicState.group_title || "Твоя група 1а";
      }

      if (elPubPlayersTitle) elPubPlayersTitle.textContent = "Гравці у групі";
      if (elPubPlayersNote) elPubPlayersNote.textContent = "Готово (заглушка).";

      renderPlayers(publicState.players_final);
      return;
    }
  }

  function stopPublicTimers() {
    if (publicCountdownInterval) clearInterval(publicCountdownInterval);
    publicCountdownInterval = null;

    if (publicPlayersInterval) clearInterval(publicPlayersInterval);
    publicPlayersInterval = null;

    if (publicPhaseTimeout1) clearTimeout(publicPhaseTimeout1);
    publicPhaseTimeout1 = null;

    if (publicPhaseTimeout2) clearTimeout(publicPhaseTimeout2);
    publicPhaseTimeout2 = null;
  }

  // ✅ “бекенд-friendly” точки: ці функції потім будуть викликані по API-сигналу
  function onPublicRegistrationClosed() {
    // Тут у реалі ми чекаємо на DB сигнал “groups_ready”.
    // Зараз: 5 секунд “forming” -> потім група готова.
    publicPhaseTimeout1 = setTimeout(() => {
      // (імітація відповіді з бекенду)
      onPublicGroupsReady({
        group_title: "Твоя група 1а",
        players: publicState.players_final,
      });
    }, 5000);
  }

  function onPublicGroupsReady(payload) {
    setPublicState({
      phase: "group_ready",
      group_title: payload?.group_title || "Твоя група 1а",
      players_final: Array.isArray(payload?.players) ? payload.players : publicState.players_final,
    });

    // Далі у реалі буде сигнал “match_ready”.
    // Зараз: 3 секунди -> game stub
    publicPhaseTimeout2 = setTimeout(() => {
      onPublicMatchReady();
    }, 3000);
  }

  function onPublicMatchReady() {
    setPublicState({ phase: "game_stub" });
    showScreen(scrPublicGame);
  }

  function openPublicDetails(stubTournament) {
    stopPolling();
    setTid(null);

    stopPublicTimers();

    // базові заглушки + старт state
    setPublicState({
      open: true,
      phase: "countdown",
      id: stubTournament?.id || null,
      title: stubTournament?.title || "Public tournament",
      organizer: stubTournament?.organizer || "@telegram_account",
      seconds_total: 30,
      seconds_left: 30,
      players_live: [],
      players_final: [],
      group_title: "Твоя група 1а",
    });

    showScreen(scrPublicDetails);

    // players live stub (оновлюємо тільки під час countdown)
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

    // гарантовано “ти” в списку
    const me = { name: "Ти", tag: publicState.my_tag || "@you" };

    publicPlayersInterval = setInterval(() => {
      if (publicState.phase !== "countdown") return;

      const live = Array.isArray(publicState.players_live) ? [...publicState.players_live] : [];

      // додай "ти" якщо немає
      if (!live.find(x => x.tag === me.tag)) live.unshift(me);

      if (live.length < 6) {
        const next = pool[Math.floor(Math.random() * pool.length)];
        if (!live.find(x => x.tag === next.tag)) live.push(next);
      }

      setPublicState({ players_live: live });
    }, 1000);

    // countdown -> forming
    const startedAt = Date.now();
    publicCountdownInterval = setInterval(() => {
      if (publicState.phase !== "countdown") return;

      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, 30 - elapsed);
      const leftInt = Math.ceil(left);

      setPublicState({ seconds_left: leftInt });

      if (left <= 0) {
        clearInterval(publicCountdownInterval);
        publicCountdownInterval = null;

        // ✅ STOP updates and FREEZE list
        if (publicPlayersInterval) {
          clearInterval(publicPlayersInterval);
          publicPlayersInterval = null;
        }

        const frozen = (publicState.players_live || []).slice(0, 6);

        // перейти в forming
        setPublicState({
          phase: "forming",
          players_final: frozen,
        });

        // ✅ trigger forming flow (5s)
        onPublicRegistrationClosed();
      }
    }, 250);
  }

  // ---------------------------------------
  // private tournament core (unchanged)
  // ---------------------------------------

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
    // top back smart: якщо public відкритий -> назад на список турнірів
    if (elTopBack) {
      elTopBack.addEventListener("click", (e) => {
        if (isPublicOpen() || (scrPublicGame && scrPublicGame.hidden === false)) {
          e.preventDefault();
          stopPublicTimers();
          setPublicState({ open: false, phase: "idle" });
          showScreen(scrFind);
          return;
        }
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
        stopPublicTimers();
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
          <div class="tg-public-item__sub">Натисни — стартне UI (заглушка)</div>
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

    const urlJoinCode = (() => {
      const p = new URLSearchParams(window.location.search);
      const code = p.get("join_code") || p.get("code") || p.get("tagid");
      return code ? String(code).trim() : "";
    })();
    if (elJoinCode && urlJoinCode) elJoinCode.value = urlJoinCode;

    // Telegram start_param -> private реальний режим (як було)
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
