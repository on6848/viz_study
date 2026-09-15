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
        grid.innerHTML = papers.map(function (p) {
          var primaryTag = (p.tags && p.tags[0]) || p.slug;
          var tagChips = (p.tags || []).slice(0, 3).map(function (t) {
            return '<span class="tag-chip"><span class="dot" style="background:var(' + colorForTag(t) + ')"></span>' + escapeHtml(t) + "</span>";
          }).join("");
          return (
            '<a class="card" href="papers/' + encodeURIComponent(p.slug) + '/">' +
              '<div class="card-banner">' + bannerSvg(p.slug, primaryTag) + "</div>" +
              '<div class="card-body">' +
                '<div class="card-date">' + escapeHtml(p.date) + "</div>" +
                "<h3>" + escapeHtml(p.title) + "</h3>" +
                '<div class="card-tags">' + tagChips + "</div>" +
              "</div>" +
            "</a>"
          );
        }).join("");
      })
      .catch(function (err) {
        grid.innerHTML = '<p style="color:var(--text-muted)">papers.json の読み込みに失敗しました: ' + escapeHtml(String(err)) + "</p>";
      });
  }

  // Deterministic per-paper "fingerprint" graphic: a few soft shapes tinted
  // with a categorical color picked from the paper's primary tag, so every
  // card gets a distinct visual identity without any authored artwork.
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

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function bannerSvg(slug, tag) {
    var colorVar = colorForTag(tag);
    var rnd = mulberry32(hashStr(slug));
    var W = 260, H = 84;
    var shapes = "";
    var count = 4 + Math.floor(rnd() * 2);
    for (var i = 0; i < count; i++) {
      var r = 10 + rnd() * 34;
      var cx = rnd() * W;
      var cy = rnd() * H;
      var op = (0.10 + rnd() * 0.28).toFixed(2);
      shapes += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="var(' + colorVar + ')" opacity="' + op + '"></circle>';
    }
    shapes += '<line x1="' + (rnd() * W).toFixed(1) + '" y1="' + (rnd() * H).toFixed(1) + '" x2="' + (rnd() * W).toFixed(1) + '" y2="' + (rnd() * H).toFixed(1) + '" stroke="var(' + colorVar + ')" stroke-width="1.5" opacity="0.35"></line>';
    return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true">' + shapes + "</svg>";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
