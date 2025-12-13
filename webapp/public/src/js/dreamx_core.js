
(function () {
  // Theme prepared: light only for now
  const root = document.body;
  if (!root.classList.contains("theme-light") && !root.classList.contains("theme-dark")) {
    root.classList.add("theme-light");
  }

  // Telegram WebApp integration (safe if opened in browser)
  const tg = window.Telegram ? window.Telegram.WebApp : null;

  window.DreamX = {
    tg,
    isTelegram: !!tg,
    initData: tg ? tg.initData : "",
    user: tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null,
  };

  if (tg) {
    tg.ready();
    tg.expand();
  }
})();
