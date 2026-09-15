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
    // cache-bust papers.json so a new entry shows up immediately after a
    // GitHub Pages deploy, instead of waiting out a stale cached copy.
    fetch("papers.json?v=" + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (papers) {
        papers.sort(function (a, b) { return b.date.localeCompare(a.date); });
        if (papers.length === 0) {
          grid.innerHTML = '<p style="color:var(--text-muted)">まだ論文がありません。最初の一本を投げてください。</p>';
          return;
        }
        // Each card shows papers/<slug>/preview.svg — a small static snapshot
        // of the actual technique used in that paper's demo (like a D3
        // example-gallery thumbnail), not a decorative abstraction.
        return Promise.all(papers.map(function (p) {
          return fetch("papers/" + encodeURIComponent(p.slug) + "/preview.svg?v=" + Date.now())
            .then(function (r) { return r.ok ? r.text() : fallbackPreview(); })
            .catch(function () { return fallbackPreview(); })
            .then(function (svg) { return { paper: p, svg: svg }; });
        })).then(function (items) {
          grid.innerHTML = items.map(function (item) {
            var p = item.paper;
            var tagChips = (p.tags || []).slice(0, 3).map(function (t) {
              return '<span class="tag-chip"><span class="dot" style="background:var(' + colorForTag(t) + ')"></span>' + escapeHtml(t) + "</span>";
            }).join("");
            return (
              '<a class="card" href="papers/' + encodeURIComponent(p.slug) + '/">' +
                '<div class="card-banner">' + item.svg + "</div>" +
                '<div class="card-body">' +
                  '<div class="card-date">' + escapeHtml(p.date) + "</div>" +
                  "<h3>" + escapeHtml(p.title) + "</h3>" +
                  '<div class="card-tags">' + tagChips + "</div>" +
                "</div>" +
              "</a>"
            );
          }).join("");
        });
      })
      .catch(function (err) {
        grid.innerHTML = '<p style="color:var(--text-muted)">papers.json の読み込みに失敗しました: ' + escapeHtml(String(err)) + "</p>";
      });
  }

  // Used only if a paper folder is missing preview.svg (shouldn't happen —
  // CLAUDE.md requires authoring one per paper).
  function fallbackPreview() {
    return '<svg viewBox="0 0 260 84" role="presentation" aria-hidden="true">' +
      '<rect x="8" y="8" width="244" height="68" rx="6" fill="none" stroke="var(--border)"></rect>' +
      "</svg>";
  }

  var TAG_COLORS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5", "--series-6", "--series-7", "--series-8"];

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function colorForTag(tag) {
    return TAG_COLORS[hashStr(String(tag)) % TAG_COLORS.length];
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
