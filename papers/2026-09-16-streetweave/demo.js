// Interactive explorer for the core idea of StreetWeave (Srabanti, Marai
// & Miranda, arXiv:2508.07496): a declarative grammar where you describe a
// street-overlay visualization by picking a "unit" (segment/node), a
// "method" (line/rect/matrix), and binding visual channels (color, width,
// dash/squiggle) to data attributes — and the same underlying street
// network + data can look completely different depending on those choices.
//
// SIMPLIFICATIONS vs. the paper (disclosed on the page too):
// - Real StreetWeave reads an actual street network + thematic datasets and
//   applies spatial relations (buffer/nearest-neighbor/contains) to join
//   them. Here the "network" is a tiny fixed synthetic grid with made-up
//   per-segment values, so there is no join/aggregation step to show.
// - "chart" (embedding a Vega-Lite spec per segment) and "node"/"point"
//   units, orientation on charts, and zoom-dependent rendering are not
//   implemented; this demo covers the line/rect/matrix "method" axis and
//   the color/width/dash-or-squiggle channel axis for segment units.
(function () {
  "use strict";

  var root = document.getElementById("sw-demo");
  var tooltip = document.getElementById("tooltip");
  if (!root) return;

  var SPACING = 90, OFFSET = 40;
  var nodes = {};
  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 3; c++) {
      nodes["n" + r + "_" + c] = { x: c * SPACING + OFFSET, y: r * SPACING + OFFSET };
    }
  }

  var RAW = [
    { a: "n0_0", b: "n0_1", traffic: 30, noise: 20, pedestrians: 70, busRoute: false },
    { a: "n0_1", b: "n0_2", traffic: 85, noise: 60, pedestrians: 40, busRoute: true },
    { a: "n1_0", b: "n1_1", traffic: 55, noise: 45, pedestrians: 55, busRoute: false },
    { a: "n1_1", b: "n1_2", traffic: 95, noise: 80, pedestrians: 20, busRoute: true },
    { a: "n2_0", b: "n2_1", traffic: 15, noise: 10, pedestrians: 85, busRoute: false },
    { a: "n2_1", b: "n2_2", traffic: 40, noise: 30, pedestrians: 60, busRoute: false },
    { a: "n0_0", b: "n1_0", traffic: 25, noise: 15, pedestrians: 75, busRoute: false },
    { a: "n1_0", b: "n2_0", traffic: 20, noise: 12, pedestrians: 80, busRoute: false },
    { a: "n0_1", b: "n1_1", traffic: 70, noise: 55, pedestrians: 35, busRoute: true },
    { a: "n1_1", b: "n2_1", traffic: 60, noise: 48, pedestrians: 45, busRoute: false },
    { a: "n0_2", b: "n1_2", traffic: 90, noise: 75, pedestrians: 25, busRoute: true },
    { a: "n1_2", b: "n2_2", traffic: 45, noise: 35, pedestrians: 50, busRoute: false }
  ];
  var SEGMENTS = RAW.map(function (s, i) {
    return { id: "s" + i, a: nodes[s.a], b: nodes[s.b], attrs: { traffic: s.traffic, noise: s.noise, pedestrians: s.pedestrians }, busRoute: s.busRoute };
  });

  var ATTRS = [
    { key: "traffic", label: "交通量" },
    { key: "noise", label: "騒音レベル" },
    { key: "pedestrians", label: "歩行者数" },
    { key: "none", label: "（固定値）" }
  ];
  var RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#256abf", "#184f95", "#0d366b"];
  function colorFor(v) {
    var idx = Math.round((v / 100) * (RAMP.length - 1));
    return RAMP[Math.max(0, Math.min(RAMP.length - 1, idx))];
  }

  var state = { method: "line", colorAttr: "traffic", widthAttr: "pedestrians", busStyle: "dash", orientation: "perpendicular" };

  var ns = "http://www.w3.org/2000/svg";

  function tabs(container, options, current, onPick) {
    options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sw-tab";
      btn.textContent = opt.label;
      btn.setAttribute("aria-pressed", opt.key === current ? "true" : "false");
      btn.addEventListener("click", function () { onPick(opt.key); render(); });
      container.appendChild(btn);
    });
  }

  function render() {
    root.innerHTML =
      '<div class="sw-controls">' +
        '<div class="sw-ctrl"><span class="sw-ctrl-label">method（見せ方）</span><div class="sw-tabs" data-role="method"></div></div>' +
        '<div class="sw-ctrl"><span class="sw-ctrl-label">color ← 属性</span><div class="sw-tabs" data-role="color"></div></div>' +
        '<div class="sw-ctrl"><span class="sw-ctrl-label">width/height ← 属性</span><div class="sw-tabs" data-role="width"></div></div>' +
        '<div class="sw-ctrl"><span class="sw-ctrl-label">バス路線の強調</span><div class="sw-tabs" data-role="busstyle"></div></div>' +
        '<div class="sw-ctrl"><span class="sw-ctrl-label">orientation</span><div class="sw-tabs" data-role="orientation"></div></div>' +
      '</div>' +
      '<p class="sw-note" style="display:none">※ matrix では color / width の指定は使われません（各セルがtraffic・noise・pedestriansをそれぞれ個別に表示します）。</p>' +
      '<div class="sw-main">' +
        '<svg id="sw-svg"></svg>' +
        '<div class="sw-spec"><div class="sw-spec-title">現在のグラマー仕様</div><pre id="sw-spec-body"></pre></div>' +
      '</div>' +
      '<div class="sw-legend"></div>';

    if (state.method === "matrix") root.querySelector(".sw-note").style.display = "block";

    tabs(root.querySelector('[data-role="method"]'),
      [{ key: "line", label: "line（線）" }, { key: "rect", label: "rect（棒/剛毛）" }, { key: "matrix", label: "matrix（グリッド）" }],
      state.method, function (v) { state.method = v; });

    tabs(root.querySelector('[data-role="color"]'), ATTRS, state.colorAttr, function (v) { state.colorAttr = v; });
    tabs(root.querySelector('[data-role="width"]'), ATTRS, state.widthAttr, function (v) { state.widthAttr = v; });
    tabs(root.querySelector('[data-role="busstyle"]'),
      [{ key: "none", label: "なし" }, { key: "dash", label: "破線 (dash)" }, { key: "squiggle", label: "波線 (squiggle)" }],
      state.busStyle, function (v) { state.busStyle = v; });
    tabs(root.querySelector('[data-role="orientation"]'),
      [{ key: "perpendicular", label: "perpendicular（垂直）" }, { key: "parallel", label: "parallel（並行）" }],
      state.orientation, function (v) { state.orientation = v; });

    renderMap();
    renderSpec();
    renderLegend();
  }

  function renderSpec() {
    var spec = {
      unit: {
        type: "segment",
        method: state.method,
        color: state.colorAttr === "none" ? undefined : state.colorAttr,
        width: state.widthAttr === "none" ? undefined : state.widthAttr,
        orientation: state.method === "line" ? undefined : state.orientation
      }
    };
    if (state.busStyle !== "none") spec.unit[state.busStyle] = "busRoute";
    Object.keys(spec.unit).forEach(function (k) { if (spec.unit[k] === undefined) delete spec.unit[k]; });
    root.querySelector("#sw-spec-body").textContent = JSON.stringify(spec, null, 2);
  }

  function renderLegend() {
    root.querySelector(".sw-legend").innerHTML =
      '<span><span class="sw-swatch" style="background:linear-gradient(to right, var(--seq-100), var(--seq-700))"></span>色 = 選択した属性の値（低→高）</span>' +
      '<span><span class="sw-dash"></span>破線 = バス路線</span>' +
      '<span><span class="sw-wave">〜</span>波線 = バス路線</span>';
  }

  function attrValue(seg, attrKey) {
    if (attrKey === "none") return 50;
    return seg.attrs[attrKey];
  }

  function midpoint(seg) { return { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 }; }
  function angleOf(seg) { return Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x); }
  function lengthOf(seg) { return Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y); }

  function squigglePath(seg, amplitude) {
    var len = lengthOf(seg), ang = angleOf(seg);
    var steps = Math.max(6, Math.round(len / 10));
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var x = seg.a.x + (seg.b.x - seg.a.x) * t;
      var y = seg.a.y + (seg.b.y - seg.a.y) * t;
      var off = Math.sin(t * Math.PI * 4) * amplitude;
      x += Math.cos(ang + Math.PI / 2) * off;
      y += Math.sin(ang + Math.PI / 2) * off;
      pts.push(x.toFixed(1) + "," + y.toFixed(1));
    }
    return "M" + pts.join(" L");
  }

  function attach(el, seg) {
    el.style.cursor = "help";
    var html = "<strong>" + seg.id + "</strong><br>交通量: " + seg.attrs.traffic + "<br>騒音レベル: " + seg.attrs.noise +
      "<br>歩行者数: " + seg.attrs.pedestrians + "<br>バス路線: " + (seg.busRoute ? "あり" : "なし");
    el.addEventListener("mouseenter", function (e) { showTip(e, html); });
    el.addEventListener("mousemove", function (e) { showTip(e, html); });
    el.addEventListener("mouseleave", hideTip);
  }
  function showTip(evt, html) {
    tooltip.style.opacity = "1";
    tooltip.style.left = evt.clientX + "px";
    tooltip.style.top = evt.clientY + "px";
    tooltip.style.whiteSpace = "normal";
    tooltip.style.maxWidth = "200px";
    tooltip.innerHTML = html;
  }
  function hideTip() { tooltip.style.opacity = "0"; tooltip.style.whiteSpace = "nowrap"; tooltip.style.maxWidth = ""; }

  function renderMap() {
    var svg = root.querySelector("#sw-svg");
    var W = 300, H = 300;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";

    // faint base street network (physical layer)
    SEGMENTS.forEach(function (seg) {
      var base = document.createElementNS(ns, "line");
      base.setAttribute("x1", seg.a.x); base.setAttribute("y1", seg.a.y);
      base.setAttribute("x2", seg.b.x); base.setAttribute("y2", seg.b.y);
      base.setAttribute("stroke", "var(--gridline)");
      base.setAttribute("stroke-width", "6");
      svg.appendChild(base);
    });

    SEGMENTS.forEach(function (seg) {
      var colorVal = attrValue(seg, state.colorAttr);
      var widthVal = attrValue(seg, state.widthAttr);
      var color = state.colorAttr === "none" ? "var(--text-secondary)" : colorFor(colorVal);
      var isDashed = state.busStyle === "dash" && seg.busRoute;
      var isSquiggle = state.busStyle === "squiggle" && seg.busRoute;

      if (state.method === "line") {
        var w = 2 + (widthVal / 100) * 7;
        var el;
        if (isSquiggle) {
          el = document.createElementNS(ns, "path");
          el.setAttribute("d", squigglePath(seg, 4));
          el.setAttribute("fill", "none");
        } else {
          el = document.createElementNS(ns, "line");
          el.setAttribute("x1", seg.a.x); el.setAttribute("y1", seg.a.y);
          el.setAttribute("x2", seg.b.x); el.setAttribute("y2", seg.b.y);
        }
        el.setAttribute("stroke", color);
        el.setAttribute("stroke-width", w.toFixed(1));
        el.setAttribute("stroke-linecap", "round");
        if (isDashed) el.setAttribute("stroke-dasharray", "5 4");
        attach(el, seg);
        svg.appendChild(el);
      } else if (state.method === "rect") {
        var line = document.createElementNS(ns, "line");
        line.setAttribute("x1", seg.a.x); line.setAttribute("y1", seg.a.y);
        line.setAttribute("x2", seg.b.x); line.setAttribute("y2", seg.b.y);
        line.setAttribute("stroke", "var(--text-muted)");
        line.setAttribute("stroke-width", "2");
        if (isDashed) line.setAttribute("stroke-dasharray", "5 4");
        svg.appendChild(line);

        var mid = midpoint(seg), ang = angleOf(seg);
        var barLen = 4 + (widthVal / 100) * 22;
        var perp = ang + Math.PI / 2;
        var dir = state.orientation === "perpendicular" ? perp : ang;
        var hx = Math.cos(dir) * barLen, hy = Math.sin(dir) * barLen;
        var bar = document.createElementNS(ns, "line");
        bar.setAttribute("x1", (mid.x - hx / 2).toFixed(1)); bar.setAttribute("y1", (mid.y - hy / 2).toFixed(1));
        bar.setAttribute("x2", (mid.x + hx / 2).toFixed(1)); bar.setAttribute("y2", (mid.y + hy / 2).toFixed(1));
        bar.setAttribute("stroke", color);
        bar.setAttribute("stroke-width", "5");
        bar.setAttribute("stroke-linecap", "round");
        if (isSquiggle) bar.setAttribute("stroke-dasharray", "1 3");
        attach(bar, seg);
        svg.appendChild(bar);
      } else if (state.method === "matrix") {
        var line2 = document.createElementNS(ns, "line");
        line2.setAttribute("x1", seg.a.x); line2.setAttribute("y1", seg.a.y);
        line2.setAttribute("x2", seg.b.x); line2.setAttribute("y2", seg.b.y);
        line2.setAttribute("stroke", "var(--text-muted)");
        line2.setAttribute("stroke-width", "2");
        if (isDashed) line2.setAttribute("stroke-dasharray", "5 4");
        svg.appendChild(line2);

        var mid2 = midpoint(seg), ang2 = angleOf(seg);
        var dir2 = state.orientation === "perpendicular" ? ang2 + Math.PI / 2 : ang2;
        var cellSize = 7, gapCell = 2, keys = ["traffic", "noise", "pedestrians"];
        var totalLen = keys.length * (cellSize + gapCell) - gapCell;
        keys.forEach(function (k, i) {
          var offset = -totalLen / 2 + i * (cellSize + gapCell) + cellSize / 2;
          var cx = mid2.x + Math.cos(dir2) * offset;
          var cy = mid2.y + Math.sin(dir2) * offset;
          var rect = document.createElementNS(ns, "rect");
          rect.setAttribute("x", (cx - cellSize / 2).toFixed(1));
          rect.setAttribute("y", (cy - cellSize / 2).toFixed(1));
          rect.setAttribute("width", cellSize);
          rect.setAttribute("height", cellSize);
          rect.setAttribute("fill", colorFor(seg.attrs[k]));
          rect.setAttribute("stroke", "var(--surface-1)");
          rect.setAttribute("stroke-width", "0.5");
          attach(rect, seg);
          svg.appendChild(rect);
        });
      }
    });
  }

  render();
})();
