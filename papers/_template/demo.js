// Demo template.
//
// Guidelines:
// - No build step: CDN or vanilla JS/SVG only, so this can be served as-is
//   from GitHub Pages.
// - Use the shared CSS custom properties from assets/css/style.css for color
//   (--series-1..8 for categorical, --seq-100..700 for sequential magnitude,
//   see the dataviz notes in papers/_template/README.md).
// - If the data is synthetic/illustrative rather than the paper's real
//   experimental data, say so in the page (see the commented-out
//   .callout.note-source block in index.html) and in a comment here.
// - Give every chart a hover tooltip (#tooltip element already in the page)
//   and make interactive elements keyboard-focusable (tabindex="0" + focus
//   handlers mirroring mouse handlers).

(function () {
  "use strict";

  var root = document.getElementById("demo-root");
  if (!root) return;

  root.innerHTML = "<p style=\"color:var(--text-muted)\">TODO: build the demo here.</p>";
})();
