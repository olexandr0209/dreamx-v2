// webapp/public/src/js/public_game_screen.js
(function () {
  const $ = (id) => document.getElementById(id);

  // ---- required ----
  if (!window.PublicApi) {
    console.error("[PublicGame] public_api_client.js not loaded");
    return;
  }

  // ---- DOM ----
  const elBack = $("pg-back");
  const elTitle = $("pg-title");
  const elSub = $("pg-sub");
  const elGroupTitle = $("pg-group-title");
  const elMembers = $("pg-members");

  const elRoundTitle = $("pg-round-title");
  const elTimerFill = $("pg-timer-fill");

  const elOpTag = $("pg-op-tag");
  const elMeTag = $("pg-me-tag");

  const elErr = $("pg-error");
  const elNote = $("pg-note");

  const movesBtns = Array.from(document.querySelectorAll(".pg-move[data-move]"));

  const MOVE = {
    rock: { emoji: "🪨", label: "Камінь" },
    paper: { emoji: "📄", label: "Бумага" },
    scissors: { emoji: "✂️", label: "Ножиці" },
  };

  // ---- params ----
  const qs = new URLSearchParams(window.location.search);
  const tournamentId = Number(qs.get("tournament_id") || qs.get("public_id") || 0);
  if (!tournamentId) {
    showError({ ok: false, error: "missing_tournament_id" });
    return;
  }

  // Back link: завжди назад у лоббі
  if (elBack) elBack.href = `./public_tournament.html?tournament_id=${encodeURIComponent(String(tournamentId))}`;

  // ---- local runtime ----
  const POLL_MS = 900;
  let pollTimer = null;
  let sending = false;
  let currentMatch = null;

  // timer bar (optional)
  let tickTimer = null;
  let turnEndsAtMs = 0;
  let turnTotalMs = 0;

  function setText(el, v) { if (el) el.textContent = String(v ?? ""); }

  function showError(obj) {
    if (!elErr) return;
    elErr.hidden = false;
    elErr.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function clearError() {
    if (!elErr) return;
    elErr.hidden = true;
    elErr.textContent = "";
  }

  function setMovesEnabled(flag) {
    for (const b of movesBtns) b.disabled = !flag || sending;
  }

  function setCircle(prefix, idx, text) {
    const el = $(`${prefix}-c${idx}`);
    if (!el) return;
    if (idx === 0) return; // avatar is separate
    el.textContent = String(text ?? "—");
  }

  function setScore(prefix, score) {
    const el = $(`${prefix}-c4`);
    if (el) el.textContent = String(score ?? 0);
  }

  function setAvatar(prefix, label) {
    const el = $(`${prefix}-c0`);
    if (!el) return;
    el.innerHTML = `<div class="pg-avatar">${label || "AVATAR"}</div>`;
  }

  function renderMembers(list) {
    if (!elMembers) return;
    const arr = Array.isArray(list) ? list : [];
    elMembers.innerHTML = arr.map((m) => {
      const tag = m.tag || m.username || (m.tg_user_id ? `#${m.tg_user_id}` : "—");
      const pts = m.points ?? m.score ?? m.total_points ?? 0;
      return `
        <div class="pg-member">
          <div class="pg-member__name">${escapeHtml(tag)}</div>
          <div class="pg-member__pts">${escapeHtml(String(pts))}</div>
        </div>
      `;
    }).join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---- timerbar (optional, best-effort) ----
  function stopTurnTimer() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
    turnEndsAtMs = 0;
    turnTotalMs = 0;
    if (elTimerFill) elTimerFill.style.setProperty("--p", "1");
  }

  function startTurnTimer(secondsLeft, secondsTotal) {
    stopTurnTimer();

    const left = Number(secondsLeft);
    const total = Number(secondsTotal);

    if (!isFinite(left) || !isFinite(total) || total <= 0) {
      if (elTimerFill) elTimerFill.style.setProperty("--p", "1");
      return;
    }

    turnTotalMs = total * 1000;
    turnEndsAtMs = Date.now() + left * 1000;

    tickTimer = setInterval(() => {
      const leftMs = turnEndsAtMs - Date.now();
      const p = Math.max(0, Math.min(1, leftMs / turnTotalMs));
      if (elTimerFill) elTimerFill.style.setProperty("--p", String(p));
      if (leftMs <= 0) stopTurnTimer();
    }, 80);
  }

  // ---- normalize backend state (flex) ----
  function normTag(v) {
    if (!v) return "";
    return String(v).startsWith("@") ? String(v) : `@${v}`;
  }

  function normalizeState(s) {
    const t = s?.tournament || {};
    const phase = s?.phase || s?.state?.phase || "unknown";

    const tournamentName = t?.name || s?.tournament_name || s?.name || `Турнір #${tournamentId}`;
    const organizer = t?.organizer || s?.organizer || s?.org || "—";

    const group = s?.group || s?.my_group || null;
    const match = s?.match || s?.current_match || null;

    // members best-effort
    const members =
      group?.members ||
      group?.players ||
      s?.members ||
      s?.group_members ||
      [];

    return {
      raw: s,
      phase,
      tournamentName,
      organizer,
      group,
      members,
      match,
      standings: s?.standings || group?.standings || [],
    };
  }

  function moveToEmoji(m) {
    return MOVE[m]?.emoji || "—";
  }

  // ---- render from normalized state ----
  function applyFrom(norm) {
    clearError();

    // header
    setText(elTitle, norm.tournamentName);
    setText(elSub, norm.organizer);

    // phase gate
    if (norm.phase !== "group") {
      // якщо турнір ще не в груповій фазі — назад у лоббі
      setMovesEnabled(false);
      stopTurnTimer();
      if (elNote) elNote.textContent = `Стан: ${norm.phase}. Повертаємось у лоббі…`;
      window.location.href = `./public_tournament.html?tournament_id=${encodeURIComponent(String(tournamentId))}`;
      return;
    }

    // group title
    const gNo = norm.group?.group_no || norm.group?.no || norm.group?.title || norm.group?.name;
    if (gNo) setText(elGroupTitle, String(gNo).includes("груп") ? gNo : `Ваша група № ${gNo}`);
    else setText(elGroupTitle, "Ваша група");

    renderMembers(norm.members);

    // finished → results
    const gStatus = norm.group?.status;
    if (gStatus === "finished" || norm.phase === "finished") {
      setMovesEnabled(false);
      stopTurnTimer();
      if (elNote) elNote.textContent = "Група завершена. Переходимо до результатів…";
      window.location.href = `./public_game_result.html?tournament_id=${encodeURIComponent(String(tournamentId))}`;
      return;
    }

    // match
    const m = norm.match;
    currentMatch = m || null;

    if (!m) {
      setText(elRoundTitle, "Очікуємо матч…");
      setText(elOpTag, "@opponent");
      setText(elMeTag, "@you");
      setAvatar("pg-op", "AVATAR");
      setAvatar("pg-me", "AVATAR");

      // circles reset
      setCircle("pg-op", 1, "—"); setCircle("pg-op", 2, "—"); setCircle("pg-op", 3, "—");
      setCircle("pg-me", 1, "—"); setCircle("pg-me", 2, "—"); setCircle("pg-me", 3, "—");
      setScore("pg-op", 0);
      setScore("pg-me", 0);

      setMovesEnabled(false);
      stopTurnTimer();
      if (elNote) elNote.textContent = "У цьому турі ти зараз не в парі. Чекаємо…";
      return;
    }

    // round title (best-effort)
    const roundNo = m.round_no ?? m.round ?? norm.group?.round_no ?? null;
    const roundTotal = m.round_total ?? m.total_rounds ?? norm.group?.round_total ?? null;
    if (roundNo && roundTotal) setText(elRoundTitle, `Раунд ${roundNo}/${roundTotal}`);
    else setText(elRoundTitle, "Раунд");

    // tags
    const meTag = normTag(m.me_tag || m.me_username || m.me || m.you || "@you") || "@you";
    const opTag = normTag(m.op_tag || m.op_username || m.opponent || "@opponent") || "@opponent";
    setText(elMeTag, meTag);
    setText(elOpTag, opTag);

    setAvatar("pg-op", "AVATAR");
    setAvatar("pg-me", "AVATAR");

    // history (best-effort arrays of moves)
    const myMoves = m.me_moves || m.my_moves || m.moves_me || [];
    const opMoves = m.op_moves || m.enemy_moves || m.moves_op || [];

    setCircle("pg-me", 1, moveToEmoji(myMoves[0]));
    setCircle("pg-me", 2, moveToEmoji(myMoves[1]));
    setCircle("pg-me", 3, moveToEmoji(myMoves[2]));

    setCircle("pg-op", 1, moveToEmoji(opMoves[0]));
    setCircle("pg-op", 2, moveToEmoji(opMoves[1]));
    setCircle("pg-op", 3, moveToEmoji(opMoves[2]));

    // score
    setScore("pg-me", m.me_score ?? m.my_score ?? m.score_me ?? 0);
    setScore("pg-op", m.op_score ?? m.enemy_score ?? m.score_op ?? 0);

    // need_move + timer
    const needMove = !!(m.need_move ?? m.can_move ?? false);
    setMovesEnabled(needMove);

    // timer best-effort: якщо бек віддає seconds_left/seconds_total
    const secLeft = m.turn_seconds_left ?? m.seconds_left ?? null;
    const secTotal = m.turn_seconds_total ?? m.seconds_total ?? null;
    if (secLeft != null && secTotal != null) startTurnTimer(secLeft, secTotal);
    else stopTurnTimer();

    // note
    if (elNote) {
      if (needMove) elNote.textContent = "Твій хід.";
      else elNote.textContent = "Очікуємо хід суперника…";
    }
  }

  async function refresh() {
    try {
      const s = await PublicApi.state(tournamentId);
      const norm = normalizeState(s);
      applyFrom(norm);
    } catch (e) {
      // якщо бек повернув не-json або 404 тощо — покажемо помилку і вимкнемо кнопки
      setMovesEnabled(false);
      stopTurnTimer();
      showError({ ok: false, error: "state_fetch_failed", details: String(e?.message || e) });
      if (elNote) elNote.textContent = "Помилка state. Перевір бекенд / endpoint.";
    }
  }

  async function sendMove(move) {
    if (sending) return;
    if (!currentMatch || !currentMatch.id) return;

    sending = true;
    setMovesEnabled(false);
    try {
      await PublicApi.move(tournamentId, currentMatch.id, move);
      await refresh();
    } catch (e) {
      showError({ ok: false, error: "move_failed", details: String(e?.message || e) });
    } finally {
      sending = false;
    }
  }

  function bindUi() {
    for (const b of movesBtns) {
      b.addEventListener("click", () => {
        const mv = b.dataset.move;
        if (!MOVE[mv]) return;
        sendMove(mv);
      });
    }
  }

  function start() {
    bindUi();
    refresh();
    pollTimer = setInterval(() => refresh(), POLL_MS);
  }

  document.addEventListener("DOMContentLoaded", start);
})();
