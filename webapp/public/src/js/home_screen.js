//  home_screen.js 

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-play-bot");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // зберігаємо tg_user_id та інші query-параметри
    const qs = window.location.search || "";
    window.location.href = "./game.html" + qs;
  });
});
