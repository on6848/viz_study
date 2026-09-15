// Interactive miniature "Large Neighborhood Search for layered networks"
// demo, illustrating the core loop of Wilson, Crnovrsanin, Puerta & Dunne,
// "Fast and Readable Layered Network Visualizations Using Large
// Neighborhood Search" (IEEE TVCG 2025):
//   1) pick a candidate node, 2) collect a small neighborhood around it,
//   3) exactly re-optimize just that neighborhood's ordering, 4) repeat.
//
// SIMPLIFICATIONS vs. the paper (disclosed on the page too):
// - The paper's real solver is an ILP over the whole model; here, since our
//   neighborhoods are small (<=4 nodes), we brute-force all permutations of
//   the neighborhood, which is exact for a problem this size.
// - Neighborhoods here are restricted to a window within a single layer
//   (closest to the paper's "layer-by-layer" neighborhood). The paper also
//   studies neighborhoods that span multiple layers (BFS / degree-centrality
//   subgraphs) and five candidate-selection methods; this demo implements 3.
// - The toy "control-flow-graph-like" network and its initial (bad) layout
//   are fixed/synthetic, not from the paper's evaluation or case study.
(function () {
  "use strict";

  var root = document.getElementById("lns-demo");
  var tooltip = document.getElementById("tooltip");
  if (!root) return;

  // ---- toy network (a small DAG, laid out in layers like a simplified,
  // cycle-free control-flow graph) --------------------------------------
  var NODES = [
    { id: "entry", layer: 0 },
    { id: "B1", layer: 1 }, { id: "B2", layer: 1 },
    { id: "B3", layer: 2 }, { id: "B4", layer: 2 }, { id: "B5", layer: 2 },
    { id: "B6", layer: 3 }, { id: "B7", layer: 3 }, { id: "B8", layer: 3 }, { id: "B9", layer: 3 },
    { id: "B10", layer: 4 }, { id: "B11", layer: 4 }, { id: "B12", layer: 4 },
    { id: "exit", layer: 5 }
  ];
  var EDGES_RAW = [
    ["entry", "B1"], ["entry", "B2"],
    ["B1", "B3"], ["B1", "B4"], ["B2", "B4"], ["B2", "B5"],
    ["B3", "B6"], ["B4", "B7"], ["B5", "B9"],
    ["B10", "exit"], ["B11", "exit"], ["B12", "exit"],
    ["B6", "B10"], ["B7", "B10"], ["B8", "B11"], ["B9", "B12"],
    ["B3", "B7"], ["B4", "B6"], ["B4", "B9"],
    ["B6", "B11"], ["B6", "B12"], ["B7", "B12"], ["B9", "B11"]
  ];
  var NUM_LAYERS = 6;

  var nodeLayer = {};
  NODES.forEach(function (n) { nodeLayer[n.id] = n.layer; });

  var EDGES = EDGES_RAW.map(function (e, i) {
    return { id: i, from: e[0], to: e[1], boundary: nodeLayer[e[0]] };
  });

  var edgesByBoundary = [];
  for (var b = 0; b < NUM_LAYERS - 1; b++) edgesByBoundary.push(EDGES.filter(function (e) { return e.boundary === b; }));

  var degree = {};
  NODES.forEach(function (n) { degree[n.id] = 0; });
  EDGES.forEach(function (e) { degree[e.from]++; degree[e.to]++; });

  // Deliberately shuffled (poor) starting order per layer.
  var INITIAL_ORDER = [
    ["entry"],
    ["B2", "B1"],
    ["B5", "B3", "B4"],
    ["B9", "B6", "B8", "B7"],
    ["B12", "B10", "B11"],
    ["exit"]
  ];

  var order, history, lastCandidateId, highlight, autoTimer;
  var candidateMode = "crossings";
  var windowSize = 3;

  function resetState() {
    order = INITIAL_ORDER.map(function (layerArr) { return layerArr.slice(); });
    history = [];
    lastCandidateId = null;
    highlight = null;
    stopAuto();
    var c0 = totalCrossings().count;
    history.push({ label: "初期配置", crossings: c0 });
  }

  // ---- crossing counting -------------------------------------------------
  function boundaryCrossings(orderL, orderR, edgesLR) {
    var posL = {}, posR = {};
    orderL.forEach(function (id, i) { posL[id] = i; });
    orderR.forEach(function (id, i) { posR[id] = i; });
    var count = 0;
    var flags = edgesLR.map(function () { return false; });
    for (var i = 0; i < edgesLR.length; i++) {
      for (var j = i + 1; j < edgesLR.length; j++) {
        var e1 = edgesLR[i], e2 = edgesLR[j];
        var a1 = posL[e1.from], a2 = posL[e2.from], b1 = posR[e1.to], b2 = posR[e2.to];
        if ((a1 - a2) * (b1 - b2) < 0) { count++; flags[i] = true; flags[j] = true; }
      }
    }
    return { count: count, flags: flags };
  }

  function totalCrossings(customOrder) {
    var ord = customOrder || order;
    var count = 0;
    var edgeFlag = {};
    for (var b = 0; b < NUM_LAYERS - 1; b++) {
      var res = boundaryCrossings(ord[b], ord[b + 1], edgesByBoundary[b]);
      count += res.count;
      edgesByBoundary[b].forEach(function (e, i) { edgeFlag[e.id] = res.flags[i]; });
    }
    return { count: count, edgeFlag: edgeFlag };
  }

  function nodeCrossingScore(id, edgeFlag) {
    var s = 0;
    EDGES.forEach(function (e) {
      if ((e.from === id || e.to === id) && edgeFlag[e.id]) s++;
    });
    return s;
  }

  // ---- barycenter initial-layout heuristic (Sugiyama-style) --------------
  function neighborsInLayer(id, otherLayer) {
    var out = [];
    EDGES.forEach(function (e) {
      if (e.from === id && nodeLayer[e.to] === otherLayer) out.push(e.to);
      if (e.to === id && nodeLayer[e.from] === otherLayer) out.push(e.from);
    });
    return out;
  }

  function barycenterSweep(dir) {
    var layers = [];
    for (var i = 0; i < NUM_LAYERS; i++) layers.push(i);
    if (dir === "up") layers.reverse();
    layers.forEach(function (L) {
      var otherL = dir === "down" ? L - 1 : L + 1;
      if (otherL < 0 || otherL >= NUM_LAYERS) return;
      var otherOrder = order[otherL];
      var posOf = {};
      otherOrder.forEach(function (id, i) { posOf[id] = i; });
      var withScore = order[L].map(function (id, idx) {
        var neigh = neighborsInLayer(id, otherL);
        var score = neigh.length ? neigh.reduce(function (s, n) { return s + posOf[n]; }, 0) / neigh.length : idx;
        return { id: id, score: score, idx: idx };
      });
      withScore.sort(function (a, b) { return a.score - b.score || a.idx - b.idx; });
      order[L] = withScore.map(function (w) { return w.id; });
    });
  }

  function runBarycenter() {
    barycenterSweep("down");
    highlight = null;
    lastCandidateId = null;
    history.push({ label: "重心法", crossings: totalCrossings().count });
    render();
  }

  // ---- LNS step: pick candidate, collect window neighborhood, brute-force
  // re-optimize it exactly (small enough to enumerate) --------------------
  function eligibleNodeIds() {
    return NODES.filter(function (n) { return order[n.layer].length > 1; }).map(function (n) { return n.id; });
  }

  function pickCandidate() {
    var pool = eligibleNodeIds();
    if (candidateMode === "degree") {
      var byDegree = pool.slice().sort(function (a, b) { return degree[b] - degree[a]; });
      for (var i = 0; i < byDegree.length; i++) if (byDegree[i] !== lastCandidateId) return byDegree[i];
      return byDegree[0];
    }
    if (candidateMode === "crossings") {
      var edgeFlag = totalCrossings().edgeFlag;
      var scored = pool.map(function (id) { return { id: id, score: nodeCrossingScore(id, edgeFlag) }; });
      scored.sort(function (a, b) { return b.score - a.score; });
      if (scored[0].score > 0) {
        for (var j = 0; j < scored.length; j++) if (scored[j].id !== lastCandidateId && scored[j].score > 0) return scored[j].id;
      }
      // no crossings left touch anything — fall back to random
    }
    var candidates = pool.filter(function (id) { return id !== lastCandidateId; });
    if (candidates.length === 0) candidates = pool;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      var rest = arr.slice(0, i).concat(arr.slice(i + 1));
      permutations(rest).forEach(function (p) { result.push([arr[i]].concat(p)); });
    }
    return result;
  }

  function windowAround(anchorId, layer, size) {
    var arr = order[layer];
    var eff = Math.min(size, arr.length);
    var idx = arr.indexOf(anchorId);
    var start = Math.max(0, Math.min(idx - Math.floor((eff - 1) / 2), arr.length - eff));
    return { start: start, ids: arr.slice(start, start + eff) };
  }

  function spliceIn(arr, start, len, replacement) {
    return arr.slice(0, start).concat(replacement).concat(arr.slice(start + len));
  }

  // A neighborhood spans the candidate's layer plus (when possible) a window
  // in one adjacent layer connected to it — reordering a single layer in
  // isolation gets stuck in local optima that barycenter already reached, so
  // this mirrors the paper's finding that neighborhoods spanning connected
  // nodes across layers (BFS / degree-centrality) outperform a pure
  // layer-by-layer sweep.
  function lnsStep() {
    if (eligibleNodeIds().length === 0) return false;
    var candidateId = pickCandidate();
    var layerA = nodeLayer[candidateId];
    var winA = windowAround(candidateId, layerA, windowSize);

    var layerB = null, winB = null;
    var tryLayers = [layerA + 1, layerA - 1].filter(function (l) { return l >= 0 && l < NUM_LAYERS && order[l].length > 1; });
    for (var t = 0; t < tryLayers.length; t++) {
      var neigh = neighborsInLayer(candidateId, tryLayers[t]);
      if (neigh.length > 0) { layerB = tryLayers[t]; winB = windowAround(neigh[0], layerB, windowSize); break; }
    }

    var permsA = permutations(winA.ids);
    var permsB = winB ? permutations(winB.ids) : [null];

    var bestA = winA.ids, bestB = winB ? winB.ids : null;
    var bestCount = totalCrossings().count;
    permsA.forEach(function (permA) {
      permsB.forEach(function (permB) {
        var trialOrder = order.slice();
        trialOrder[layerA] = spliceIn(order[layerA], winA.start, winA.ids.length, permA);
        if (layerB !== null) trialOrder[layerB] = spliceIn(order[layerB], winB.start, winB.ids.length, permB);
        var c = totalCrossings(trialOrder).count;
        if (c < bestCount) { bestCount = c; bestA = permA; bestB = permB; }
      });
    });

    order[layerA] = spliceIn(order[layerA], winA.start, winA.ids.length, bestA);
    if (layerB !== null) order[layerB] = spliceIn(order[layerB], winB.start, winB.ids.length, bestB);

    lastCandidateId = candidateId;
    var windows = [{ layer: layerA, ids: winA.ids }];
    if (layerB !== null) windows.push({ layer: layerB, ids: winB.ids });
    highlight = { candidateId: candidateId, windows: windows };
    history.push({ label: "LNS #" + history.filter(function (h) { return h.label.indexOf("LNS") === 0; }).length, crossings: bestCount });
    return true;
  }

  function stopAuto() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  // ---- rendering ----------------------------------------------------------
  var ns = "http://www.w3.org/2000/svg";
  var W = 300, H = 300, TOP = 20, LEFT = 20, LAYER_GAP = (H - 2 * TOP) / (NUM_LAYERS - 1), NODE_GAP = 46, R = 9;

  function nodeXY(id) {
    var layer = nodeLayer[id];
    var arr = order[layer];
    var idx = arr.indexOf(id);
    var layerWidth = (arr.length - 1) * NODE_GAP;
    var x = LEFT + (W - 2 * LEFT - layerWidth) / 2 + idx * NODE_GAP;
    var y = TOP + layer * LAYER_GAP;
    return { x: x, y: y };
  }

  function render() {
    root.innerHTML =
      '<div class="lns-toolbar">' +
        '<div class="lns-group"><span class="lns-group-label">候補ノードの選び方</span><div class="lns-tabs" data-role="candidate-tabs"></div></div>' +
        '<div class="lns-group"><span class="lns-group-label">近傍（窓）のサイズ</span><div class="lns-tabs" data-role="window-tabs"></div></div>' +
      '</div>' +
      '<div class="lns-actions">' +
        '<button type="button" data-action="reset">初期化（シャッフル配置に戻す）</button>' +
        '<button type="button" data-action="barycenter">重心法で整列</button>' +
        '<button type="button" data-action="step">LNSを1ステップ実行</button>' +
        '<button type="button" data-action="auto">LNSを8回自動実行</button>' +
        '<button type="button" data-action="stop" style="display:none">停止</button>' +
      '</div>' +
      '<div class="lns-main">' +
        '<div class="lns-graph-wrap"><svg id="lns-svg"></svg>' +
          '<div class="lns-legend">' +
            '<span><span class="dot" style="background:var(--series-1)"></span>ノード（基本ブロック）</span>' +
            '<span><span class="dot ring" style="border-color:var(--series-2)"></span>候補ノード</span>' +
            '<span><span class="swatch dashed"></span>最適化対象の近傍</span>' +
            '<span><span class="line" style="background:var(--series-8)"></span>交差している辺</span>' +
          '</div>' +
        '</div>' +
        '<div class="lns-stats">' +
          '<div class="lns-stat-value"></div>' +
          '<div class="lns-stat-sub"></div>' +
          '<svg id="lns-trend"></svg>' +
        '</div>' +
      '</div>';

    var candidateTabs = root.querySelector('[data-role="candidate-tabs"]');
    [["crossings", "交差数が最大"], ["degree", "次数が最大"], ["random", "ランダム"]].forEach(function (pair) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lns-tab";
      btn.textContent = pair[1];
      btn.setAttribute("aria-pressed", candidateMode === pair[0] ? "true" : "false");
      btn.addEventListener("click", function () { candidateMode = pair[0]; render(); });
      candidateTabs.appendChild(btn);
    });

    var windowTabs = root.querySelector('[data-role="window-tabs"]');
    [[2, "小 (2)"], [3, "中 (3)"], [4, "大 (4)"]].forEach(function (pair) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lns-tab";
      btn.textContent = pair[1];
      btn.setAttribute("aria-pressed", windowSize === pair[0] ? "true" : "false");
      btn.addEventListener("click", function () { windowSize = pair[0]; render(); });
      windowTabs.appendChild(btn);
    });

    root.querySelector('[data-action="reset"]').addEventListener("click", function () { resetState(); render(); });
    root.querySelector('[data-action="barycenter"]').addEventListener("click", runBarycenter);
    root.querySelector('[data-action="step"]').addEventListener("click", function () { lnsStep(); render(); });
    root.querySelector('[data-action="auto"]').addEventListener("click", function () { runAuto(8); });
    root.querySelector('[data-action="stop"]').addEventListener("click", function () { stopAuto(); render(); });
    if (autoTimer) {
      root.querySelector('[data-action="auto"]').style.display = "none";
      root.querySelector('[data-action="stop"]').style.display = "";
    }

    renderGraph();
    renderStats();
    renderTrend();
  }

  function runAuto(remaining) {
    stopAuto();
    var btnAuto = root.querySelector('[data-action="auto"]');
    var btnStop = root.querySelector('[data-action="stop"]');
    if (btnAuto) btnAuto.style.display = "none";
    if (btnStop) btnStop.style.display = "";
    function tick(n) {
      if (n <= 0 || eligibleNodeIds().length === 0) { autoTimer = null; render(); return; }
      lnsStep();
      renderGraph();
      renderStats();
      renderTrend();
      autoTimer = setTimeout(function () { tick(n - 1); }, 450);
    }
    tick(remaining);
  }

  function renderGraph() {
    var svg = root.querySelector("#lns-svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";

    if (highlight) {
      highlight.windows.forEach(function (win) {
        var wArr = order[win.layer];
        var idxs = win.ids.map(function (id) { return wArr.indexOf(id); });
        var minIdx = Math.min.apply(null, idxs), maxIdx = Math.max.apply(null, idxs);
        var p0 = nodeXY(wArr[minIdx]), p1 = nodeXY(wArr[maxIdx]);
        var rect = document.createElementNS(ns, "rect");
        rect.setAttribute("x", p0.x - R - 6);
        rect.setAttribute("y", p0.y - R - 6);
        rect.setAttribute("width", (p1.x - p0.x) + 2 * (R + 6));
        rect.setAttribute("height", 2 * (R + 6));
        rect.setAttribute("rx", 6);
        rect.setAttribute("fill", "var(--series-2)");
        rect.setAttribute("fill-opacity", "0.12");
        rect.setAttribute("stroke", "var(--series-2)");
        rect.setAttribute("stroke-dasharray", "4 3");
        svg.appendChild(rect);
      });
    }

    var flags = totalCrossings().edgeFlag;
    EDGES.forEach(function (e) {
      var a = nodeXY(e.from), b = nodeXY(e.to);
      var line = document.createElementNS(ns, "line");
      line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
      var crossing = flags[e.id];
      line.setAttribute("stroke", crossing ? "var(--series-8)" : "var(--text-muted)");
      line.setAttribute("stroke-width", crossing ? "1.8" : "1.2");
      line.setAttribute("opacity", crossing ? "0.85" : "0.55");
      svg.appendChild(line);
    });

    NODES.forEach(function (n) {
      var p = nodeXY(n.id);
      var isCandidate = highlight && highlight.candidateId === n.id;
      var circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", p.x);
      circle.setAttribute("cy", p.y);
      circle.setAttribute("r", isCandidate ? R + 3 : R);
      circle.setAttribute("fill", "var(--series-1)");
      if (isCandidate) {
        circle.setAttribute("stroke", "var(--series-2)");
        circle.setAttribute("stroke-width", "2.5");
      }
      circle.style.cursor = "default";
      circle.addEventListener("mouseenter", function (evt) { showTip(evt, n.id); });
      circle.addEventListener("mousemove", function (evt) { showTip(evt, n.id); });
      circle.addEventListener("mouseleave", function () { tooltip.style.opacity = "0"; });
      svg.appendChild(circle);
    });

    function showTip(evt, id) {
      var edgeFlag = totalCrossings().edgeFlag;
      tooltip.style.opacity = "1";
      tooltip.style.left = evt.clientX + "px";
      tooltip.style.top = evt.clientY + "px";
      tooltip.textContent = id + " (次数 " + degree[id] + ", 交差する辺 " + nodeCrossingScore(id, edgeFlag) + ")";
    }
  }

  function renderStats() {
    var c = totalCrossings().count;
    var c0 = history[0].crossings;
    var pct = c0 === 0 ? 0 : Math.round((1 - c / c0) * 100);
    root.querySelector(".lns-stat-value").textContent = c + " 交差";
    root.querySelector(".lns-stat-sub").textContent = c0 + " → " + c + "（初期比 " + (pct >= 0 ? "-" + pct : "+" + (-pct)) + "%）・" + (history.length - 1) + " 手順実行済み";
  }

  function renderTrend() {
    var svg = root.querySelector("#lns-trend");
    var w = 300, h = 110, pad = 24;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.innerHTML = "";
    var values = history.map(function (h) { return h.crossings; });
    var maxV = Math.max.apply(null, values.concat([1]));
    function xFor(i) { return pad + (i * (w - 2 * pad)) / Math.max(1, history.length - 1); }
    function yFor(v) { return h - pad + 4 - (v / maxV) * (h - pad - 10); }

    var baseline = document.createElementNS(ns, "line");
    baseline.setAttribute("x1", pad); baseline.setAttribute("x2", w - pad);
    baseline.setAttribute("y1", yFor(values[0])); baseline.setAttribute("y2", yFor(values[0]));
    baseline.setAttribute("stroke", "var(--gridline)");
    baseline.setAttribute("stroke-dasharray", "3 3");
    svg.appendChild(baseline);

    var path = "";
    history.forEach(function (h, i) {
      path += (i === 0 ? "M" : "L") + xFor(i).toFixed(1) + " " + yFor(h.crossings).toFixed(1) + " ";
    });
    var pathEl = document.createElementNS(ns, "path");
    pathEl.setAttribute("d", path);
    pathEl.setAttribute("fill", "none");
    pathEl.setAttribute("stroke", "var(--series-1)");
    pathEl.setAttribute("stroke-width", "2");
    pathEl.setAttribute("stroke-linejoin", "round");
    svg.appendChild(pathEl);

    history.forEach(function (hpt, i) {
      var cx = xFor(i), cy = yFor(hpt.crossings);
      var dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("r", 3.2);
      dot.setAttribute("fill", i === history.length - 1 ? "var(--series-2)" : "var(--series-1)");
      dot.addEventListener("mousemove", function (evt) {
        tooltip.style.opacity = "1";
        tooltip.style.left = evt.clientX + "px";
        tooltip.style.top = evt.clientY + "px";
        tooltip.textContent = hpt.label + ": 交差 " + hpt.crossings;
      });
      dot.addEventListener("mouseleave", function () { tooltip.style.opacity = "0"; });
      svg.appendChild(dot);
    });

    var yLabel = document.createElementNS(ns, "text");
    yLabel.setAttribute("x", pad);
    yLabel.setAttribute("y", 12);
    yLabel.setAttribute("font-size", "9");
    yLabel.setAttribute("fill", "var(--text-muted)");
    yLabel.textContent = "交差数の推移（手順ごと）";
    svg.appendChild(yLabel);
  }

  resetState();
  render();
})();
