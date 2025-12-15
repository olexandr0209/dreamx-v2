document.getElementById("btn-play-bot").addEventListener("click", () => {
  const qs = window.location.search || "";
  window.location.href = "./game.html" + qs;
});

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-play-bot");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // Поки просто відкриваємо екран гри проти бота
    window.location.href = "./game.html?mode=bot";
  });
});
