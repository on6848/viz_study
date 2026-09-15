// Interactive miniature "drillboard" builder, illustrating the core mechanism
// of Drillboards (Shin, Na & Elmqvist, 2024/2025, arXiv:2410.12744):
// merge chart atoms into a hierarchy using a small vocabulary of aggregation
// operators (Label / Summarize / Archetype / Juxtaposition / Overlay), then
// navigate that hierarchy by drilling down / rolling up.
//
// IMPORTANT: the six-region monthly dataset below is SYNTHETIC, made up for
// this demo — not data or results from the paper.
(function () {
  "use strict";

  var root = document.getElementById("drillboard-demo");
  if (!root) return;

  var REGIONS = [
    { name: "北エリア", color: "--series-1", values: [82, 85, 88, 90, 95, 100, 105, 108, 112, 118, 123, 128] },
    { name: "南エリア", color: "--series-2", values: [100, 98, 95, 90, 85, 88, 95, 105, 115, 120, 118, 110] },
    { name: "東エリア", color: "--series-3", values: [95, 97, 94, 96, 98, 97, 99, 101, 98, 100, 102, 99] },
    { name: "西エリア", color: "--series-4", values: [130, 125, 120, 115, 108, 102, 98, 95, 90, 88, 85, 82] },
    { name: "中央エリア", color: "--series-5", values: [70, 75, 82, 90, 98, 108, 118, 128, 135, 142, 148, 155] },
    { name: "沿岸エリア", color: "--series-7", values: [100, 115, 90, 120, 95, 130, 105, 140, 110, 125, 100, 135] }
  ];

  var OPS = {
    label:      { code: "LBL", name: "Label", jp: "ラベル化", desc: "代表値（平均）1つに要約", min: 1 },
    summarize:  { code: "SUM", name: "Summarize", jp: "要約（平均）", desc: "系列を平均して1本の線に", min: 2 },
    archetype:  { code: "ARCH", name: "Archetype", jp: "代表選択", desc: "1つを選んで全体の代表に", min: 2 },
    juxtapose:  { code: "JUX", name: "Juxtaposition", jp: "並置", desc: "小さく並べて1枠にまとめる", min: 2 },
    overlay:    { code: "OVL", name: "Overlay", jp: "重ね合わせ", desc: "同じ座標系に重ねて描く", min: 2 }
  };

  var idc = 0;
  function nextId() { return "n" + (idc++); }

  function mean(arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; }
  function meanSeries(list) {
    var n = list[0].length, out = [];
    for (var i = 0; i < n; i++) out.push(mean(list.map(function (s) { return s[i]; })));
    return out;
  }
  function leafAtoms(node) {
    return node.type === "atom" ? [node] : node.children.reduce(function (acc, c) { return acc.concat(leafAtoms(c)); }, []);
  }

  function makeAtom(region) {
    return { id: nextId(), type: "atom", name: region.name, color: region.color, values: region.values };
  }

  function makePile(opKey, selected) {
    var leaves = selected.reduce(function (acc, n) { return acc.concat(leafAtoms(n)); }, []);
    var repSeries = meanSeries(leaves.map(function (l) { return l.values; }));
    var pile = {
      id: nextId(),
      type: "pile",
      op: opKey,
      children: selected.slice(),
      expanded: false,
      repSeries: repSeries,
      leafCount: leaves.length,
      label: leaves.map(function (l) { return l.name; }).join("、")
    };
    if (opKey === "archetype") {
      var best = leaves[0];
      leaves.forEach(function (l) { if (mean(l.values) > mean(best.values)) best = l; });
      pile.archetype = best;
    }
    return pile;
  }

  // ---- sparkline rendering -------------------------------------------------
  var ns = "http://www.w3.org/2000/svg";

  function scaleBuilder(seriesList, w, h, pad) {
    var all = [].concat.apply([], seriesList);
    var min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    var range = (max - min) || 1;
    var n = seriesList[0].length;
    var step = (w - 2 * pad) / (n - 1);
    return function (i, v) {
      return { x: pad + i * step, y: pad + (h - 2 * pad) * (1 - (v - min) / range) };
    };
  }

  function pathFor(values, scale) {
    return values.map(function (v, i) {
      var p = scale(i, v);
      return (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1);
    }).join(" ");
  }

  function svgEl(w, h) {
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    return svg;
  }

  function lineChart(seriesList, colors, w, h, opts) {
    opts = opts || {};
    var svg = svgEl(w, h);
    var scale = scaleBuilder(seriesList, w, h, 6);
    seriesList.forEach(function (values, idx) {
      var path = document.createElementNS(ns, "path");
      path.setAttribute("d", pathFor(values, scale));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-width", opts.ghost && idx < seriesList.length - 1 ? "1.5" : "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      var col = colors[idx] || "--text-muted";
      var isGhost = opts.ghost && idx !== opts.highlightIndex;
      path.setAttribute("style", "stroke:" + (isGhost ? "var(--text-muted)" : "var(" + col + ")") + (isGhost ? ";opacity:0.35" : ""));
      svg.appendChild(path);
    });
    return svg;
  }

  function miniGrid(children, w, h) {
    var wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "repeat(" + Math.min(3, children.length) + ", 1fr)";
    wrap.style.gap = "3px";
    children.forEach(function (c) {
      var cellW = Math.floor(w / Math.min(3, children.length)) - 4;
      var cellH = 34;
      wrap.appendChild(svgFor(c, cellW, cellH));
    });
    return wrap;
  }

  function svgFor(node, w, h) {
    if (node.type === "atom") return lineChart([node.values], [node.color], w, h);
    return lineChart([node.repSeries], ["--text-muted"], w, h);
  }

  // ---- card rendering -------------------------------------------------------
  function opBadge(opKey) {
    var op = OPS[opKey];
    var b = document.createElement("span");
    b.className = "db-badge";
    b.title = op.name + "（" + op.jp + "）: " + op.desc;
    b.textContent = op.code;
    b.style.background = "var(--text-primary)";
    b.style.color = "var(--surface-1)";
    return b;
  }

  function buildCardBody(node) {
    var frag = document.createDocumentFragment();
    if (node.type === "atom") {
      var title = document.createElement("div");
      title.className = "db-title";
      title.textContent = node.name;
      frag.appendChild(title);
      frag.appendChild(lineChart([node.values], [node.color], 128, 46));
      var sub = document.createElement("div");
      sub.className = "db-sub";
      sub.textContent = "月次データ（12ヶ月）";
      frag.appendChild(sub);
      return frag;
    }

    frag.appendChild(opBadge(node.op));
    if (node.op === "label") {
      var stat = document.createElement("div");
      stat.className = "db-stat";
      stat.textContent = Math.round(mean(node.repSeries));
      frag.appendChild(stat);
      var sub1 = document.createElement("div");
      sub1.className = "db-sub";
      sub1.textContent = node.leafCount + "件の平均値: " + node.label;
      frag.appendChild(sub1);
    } else if (node.op === "summarize") {
      frag.appendChild(lineChart([node.repSeries], ["--series-1"], 128, 46));
      var sub2 = document.createElement("div");
      sub2.className = "db-sub";
      sub2.textContent = node.leafCount + "件の平均: " + node.label;
      frag.appendChild(sub2);
    } else if (node.op === "archetype") {
      var leaves = leafAtoms(node);
      var seriesList = leaves.map(function (l) { return l.values; }).concat([node.archetype.values]);
      var highlightIndex = seriesList.length - 1;
      frag.appendChild(lineChart(seriesList, leaves.map(function (l) { return l.color; }).concat([node.archetype.color]), 128, 46, { ghost: true, highlightIndex: highlightIndex }));
      var sub3 = document.createElement("div");
      sub3.className = "db-sub";
      sub3.textContent = "代表: " + node.archetype.name + "（他" + (node.leafCount - 1) + "件を代表）";
      frag.appendChild(sub3);
    } else if (node.op === "juxtapose") {
      frag.appendChild(miniGrid(node.children, 128, 46));
      var sub4 = document.createElement("div");
      sub4.className = "db-sub";
      sub4.style.marginTop = "3px";
      sub4.textContent = node.leafCount + "件を並置: " + node.label;
      frag.appendChild(sub4);
    } else if (node.op === "overlay") {
      var leaves2 = leafAtoms(node);
      frag.appendChild(lineChart(leaves2.map(function (l) { return l.values; }), leaves2.map(function (l) { return l.color; }), 128, 46));
      var legend = document.createElement("div");
      legend.className = "db-legend-list";
      legend.style.marginTop = "2px";
      leaves2.forEach(function (l) {
        var s = document.createElement("span");
        var dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = "var(" + l.color + ")";
        s.appendChild(dot);
        s.appendChild(document.createTextNode(l.name));
        legend.appendChild(s);
      });
      frag.appendChild(legend);
    }
    return frag;
  }

  // ================= AUTHOR MODE ================================
  var authorNodes = REGIONS.map(makeAtom);
  var selected = new Set();
  var history = [];

  var mode = "author"; // 'author' | 'reader'
  var readerRoot = null;

  function render() {
    root.innerHTML = "";

    var tabs = document.createElement("div");
    tabs.className = "db-mode-tabs";
    var authorTab = document.createElement("button");
    authorTab.type = "button";
    authorTab.textContent = "Author モード（組み立てる）";
    authorTab.setAttribute("aria-pressed", mode === "author" ? "true" : "false");
    authorTab.addEventListener("click", function () { mode = "author"; render(); });
    var readerTab = document.createElement("button");
    readerTab.type = "button";
    readerTab.textContent = "Reader モード（ドリルダウン／ロールアップ）";
    readerTab.setAttribute("aria-pressed", mode === "reader" ? "true" : "false");
    readerTab.disabled = !readerRoot;
    readerTab.title = readerRoot ? "" : "先にAuthorモードでルートが1つになるまで統合してください";
    readerTab.addEventListener("click", function () { if (readerRoot) { mode = "reader"; render(); } });
    tabs.appendChild(authorTab);
    tabs.appendChild(readerTab);
    root.appendChild(tabs);

    if (mode === "author") renderAuthor(); else renderReader();

    var treeBox = document.createElement("div");
    treeBox.className = "db-tree";
    var heading = document.createElement("div");
    heading.style.marginBottom = "6px";
    heading.style.color = "var(--text-muted)";
    heading.textContent = "階層ツリー（オレンジ色 = 現在Readerモードで表示中のフロンティア）";
    treeBox.appendChild(heading);
    var visibleSet = mode === "reader" && readerRoot ? new Set(currentFrontier(readerRoot).map(function (n) { return n.id; })) : new Set(authorNodes.map(function (n) { return n.id; }));
    treeBox.appendChild(buildTreeEl(mode === "reader" && readerRoot ? readerRoot : (authorNodes.length === 1 ? authorNodes[0] : { type: "pile", op: null, id: "virtual-root", children: authorNodes, label: "（複数ルート）" }), visibleSet));
    root.appendChild(treeBox);
  }

  function renderAuthor() {
    var toolbar = document.createElement("div");
    toolbar.className = "db-toolbar";
    Object.keys(OPS).forEach(function (key) {
      var op = OPS[key];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "db-op-btn";
      btn.innerHTML = "<strong>" + op.jp + "</strong><span>" + op.desc + "</span>";
      btn.disabled = selected.size < op.min;
      btn.addEventListener("click", function () { applyOp(key); });
      toolbar.appendChild(btn);
    });
    root.appendChild(toolbar);

    var hint = document.createElement("div");
    hint.className = "db-status";
    hint.textContent = selected.size === 0
      ? "チャートをクリックして選択してください（複数選択可）。選ぶと使える演算子が有効になります。"
      : selected.size + "件選択中。上の演算子ボタンで統合できます。";
    root.appendChild(hint);

    var rowWrap = document.createElement("div");
    rowWrap.className = "db-row";
    authorNodes.forEach(function (node) {
      rowWrap.appendChild(makeCard(node, {
        selectable: true,
        onClick: function () {
          if (selected.has(node.id)) selected.delete(node.id); else selected.add(node.id);
          render();
        }
      }));
    });
    root.appendChild(rowWrap);

    var controls = document.createElement("div");
    controls.className = "db-controls";
    var undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.textContent = "元に戻す";
    undoBtn.disabled = history.length === 0;
    undoBtn.addEventListener("click", function () {
      if (history.length) { authorNodes = history.pop(); selected.clear(); render(); }
    });
    var resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "リセット";
    resetBtn.addEventListener("click", function () {
      authorNodes = REGIONS.map(makeAtom);
      selected.clear();
      history = [];
      readerRoot = null;
      render();
    });
    controls.appendChild(undoBtn);
    controls.appendChild(resetBtn);
    if (authorNodes.length === 1) {
      var toReader = document.createElement("button");
      toReader.type = "button";
      toReader.className = "primary";
      toReader.textContent = "ルート完成 → Reader モードで開く";
      toReader.addEventListener("click", function () {
        readerRoot = authorNodes[0];
        readerRoot.expanded = false;
        mode = "reader";
        render();
      });
      controls.appendChild(toReader);
    }
    root.appendChild(controls);
  }

  function applyOp(key) {
    var selectedNodes = authorNodes.filter(function (n) { return selected.has(n.id); });
    if (selectedNodes.length < OPS[key].min) return;
    history.push(authorNodes.slice());
    var pile = makePile(key, selectedNodes);
    var firstIdx = authorNodes.findIndex(function (n) { return selected.has(n.id); });
    var next = authorNodes.filter(function (n) { return !selected.has(n.id); });
    next.splice(firstIdx, 0, pile);
    authorNodes = next;
    selected.clear();
    render();
  }

  function makeCard(node, opts) {
    opts = opts || {};
    var card = document.createElement("div");
    card.className = "db-card " + (node.type === "atom" ? "is-atom" : "is-pile");
    if (opts.selectable && selected.has(node.id)) card.classList.add("is-selected");
    card.tabIndex = 0;
    card.appendChild(buildCardBody(node));
    if (opts.onClick) {
      card.addEventListener("click", opts.onClick);
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onClick(); } });
    }
    return card;
  }

  // ================= READER MODE ================================
  function currentFrontier(node) {
    if (node.type === "atom" || !node.expanded) return [node];
    return node.children.reduce(function (acc, c) { return acc.concat(currentFrontier(c)); }, []);
  }

  function renderReader() {
    var hint = document.createElement("p");
    hint.className = "db-status";
    hint.textContent = "パイル（束になったカード）をクリックするとドリルダウン（詳細展開）。展開した枠の「ロールアップ」ボタンで元に戻せます。";
    root.appendChild(hint);

    var container = document.createElement("div");
    container.className = "db-row";
    renderFrontier(readerRoot, container);
    root.appendChild(container);
  }

  function renderFrontier(node, container) {
    if (node.type === "atom" || !node.expanded) {
      var card = makeCard(node, {
        onClick: node.type === "pile" ? function () { node.expanded = true; render(); } : null
      });
      if (node.type === "pile") {
        var chev = document.createElement("div");
        chev.className = "db-sub";
        chev.style.marginTop = "2px";
        chev.textContent = "▼ クリックでドリルダウン";
        card.appendChild(chev);
      }
      container.appendChild(card);
      return;
    }
    var wrap = document.createElement("div");
    wrap.className = "db-group-wrap";
    var head = document.createElement("div");
    head.className = "db-group-head";
    var label = document.createElement("span");
    label.textContent = OPS[node.op].jp + " で統合されたグループ（" + node.children.length + "件）";
    var rollup = document.createElement("button");
    rollup.type = "button";
    rollup.className = "db-rollup-btn";
    rollup.textContent = "▲ ロールアップ";
    rollup.addEventListener("click", function () { node.expanded = false; render(); });
    head.appendChild(label);
    head.appendChild(rollup);
    wrap.appendChild(head);
    var inner = document.createElement("div");
    inner.className = "db-row";
    node.children.forEach(function (c) { renderFrontier(c, inner); });
    wrap.appendChild(inner);
    container.appendChild(wrap);
  }

  // ================= TREE OUTLINE ================================
  function buildTreeEl(node, visibleSet) {
    var ul = document.createElement("ul");
    var li = document.createElement("li");
    if (visibleSet.has(node.id)) li.className = "visible";
    var lbl = document.createElement("span");
    lbl.className = "db-tree-label";
    lbl.textContent = node.type === "atom" ? node.name : (node.op ? OPS[node.op].jp + "(" + node.children.length + ")" : node.label);
    li.appendChild(lbl);
    if (node.type === "pile" && node.children) {
      node.children.forEach(function (c) { li.appendChild(buildTreeEl(c, visibleSet)); });
    }
    ul.appendChild(li);
    return ul;
  }

  render();
})();
