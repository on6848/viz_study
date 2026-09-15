// Shared site behaviour: theme toggle + (on the top page) paper card list.
(function () {
  "use strict";

  var STORAGE_KEY = "viz_study_theme";

  function applyTheme(theme) {
    if (theme === "dark" || theme === "light") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function currentTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "system";
    } catch (e) {
      return "system";
    }
  }

  function cycleTheme() {
    var order = ["system", "light", "dark"];
    var next = order[(order.indexOf(currentTheme()) + 1) % order.length];
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* private browsing etc: theme just won't persist */
    }
    applyTheme(next === "system" ? null : next);
    updateToggleLabel();
  }

  function updateToggleLabel() {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    var t = currentTheme();
    var label = { system: "Theme: 自動", light: "Theme: ライト", dark: "Theme: ダーク" }[t];
    btn.textContent = label;
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(currentTheme() === "system" ? null : currentTheme());
    var btn = document.querySelector("[data-theme-toggle]");
    if (btn) {
      btn.addEventListener("click", cycleTheme);
      updateToggleLabel();
    }

    var grid = document.querySelector("[data-paper-grid]");
    if (grid) renderPaperGrid(grid);
  });

  function renderPaperGrid(grid) {
    fetch("papers.json")
      .then(function (r) { return r.json(); })
      .then(function (papers) {
        papers.sort(function (a, b) { return b.date.localeCompare(a.date); });
        if (papers.length === 0) {
          grid.innerHTML = '<p style="color:var(--text-muted)">まだ論文がありません。最初の一本を投げてください。</p>';
          return;
        }
        grid.innerHTML = papers.map(function (p) {
          var tags = (p.tags || []).map(function (t) {
            return '<span class="tag">' + escapeHtml(t) + "</span>";
          }).join("");
          return (
            '<a class="card" href="papers/' + encodeURIComponent(p.slug) + '/">' +
              '<div class="card-date">' + escapeHtml(p.date) + "</div>" +
              "<h3>" + escapeHtml(p.title) + "</h3>" +
              "<p>" + escapeHtml(p.oneLiner || "") + "</p>" +
              (tags ? '<div style="margin-top:10px">' + tags + "</div>" : "") +
            "</a>"
          );
        }).join("");
      })
      .catch(function (err) {
        grid.innerHTML = '<p style="color:var(--text-muted)">papers.json の読み込みに失敗しました: ' + escapeHtml(String(err)) + "</p>";
      });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
