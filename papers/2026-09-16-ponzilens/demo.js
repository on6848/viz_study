// Interactive explorer for the first two visualization modules of
// PonziLens+ (Wen, Nguyen, Ruan, Shen, Sun, Zhu & Wang, arXiv:2412.18470):
//   1) Path Feature Module — a parallel-sets overview of how a smart
//      contract's execution paths are grouped by four "Ponzi features"
//      (Investing / Payment / Loop / Rewarding).
//   2) Path Grouping Module — for a selected group, a merged action-
//      sequence view highlighting where those features occur.
//
// SIMPLIFICATIONS vs. the paper (disclosed on the page too):
// - The paper's Execution Detail Module (single-path view with a two-round
//   Archimedean spiral for loops, storage-slot diagrams) is not implemented
//   here — this demo covers the first two, overview-to-group-summary steps.
// - The five path groups, their action sequences, and their counts below
//   are a hand-authored, fictional toy contract — not bytecode extracted
//   from a real contract, and not one of the paper's case studies.
(function () {
  "use strict";

  var root = document.getElementById("ponzi-demo");
  var tooltip = document.getElementById("tooltip");
  if (!root) return;

  var COLUMNS = [
    { key: "investing", label: "Investing", jp: "投資" },
    { key: "payment", label: "Payment", jp: "送金" },
    { key: "loop", label: "Loop", jp: "ループ" },
    { key: "rewarding", label: "Rewarding", jp: "還元" }
  ];

  var ACTION_META = {
    W: { color: "--series-1", label: "Write Information", jp: "情報を書き込む" },
    P: { color: "--series-8", label: "Invoke Payment", jp: "送金を実行する" },
    C: { color: "--series-4", label: "Check Constraint", jp: "条件を確認する" },
    R: { color: "--text-muted", label: "Read Information", jp: "情報を読み取る" }
  };

  var GROUPS = [
    {
      id: "g1", label: "投資のみ", count: 30, pf: [true, false, false, false],
      blocks: [
        { actions: [{ type: "W", ring: "PF1", tip: "投資額を balances[msg.sender] に書き込む" }] },
        { actions: [{ type: "R", tip: "現在の総投資額を読み取る" }] },
        { actions: [{ type: "C", tip: "最低投資額を満たしているか確認する" }] }
      ]
    },
    {
      id: "g2", label: "投資 + 一括送金", count: 15, pf: [true, true, false, false],
      blocks: [
        { actions: [{ type: "W", ring: "PF1", tip: "投資額を balances[msg.sender] に書き込む" }] },
        { actions: [{ type: "C", tip: "呼び出し元がオーナーか確認する" }] },
        { actions: [{ type: "P", ring: "PF2", tip: "集まった資金をオーナーのアドレスへ送金する" }] }
      ]
    },
    {
      id: "g3", label: "投資 + ループ送金（別スロット）", count: 8, pf: [true, true, true, false],
      blocks: [
        { actions: [{ type: "W", ring: "PF1", tip: "投資額を balances[msg.sender] に書き込む" }] },
        { loop: true, actions: [{ type: "R", tip: "prizeList[i] を読み取る（investors[]とは別の配列）" }] },
        { loop: true, actions: [{ type: "P", ring: "PF2", tip: "prizeList[i] のアドレスへ送金する（investors[]とは無関係）" }] }
      ]
    },
    {
      id: "g4", label: "投資 + ループ送金 + 還元（連鎖）", count: 5, pf: [true, true, true, true],
      blocks: [
        { actions: [{ type: "W", ring: "PF1", rewardLink: "chain1", tip: "投資者アドレスと金額を investors[] に書き込む" }] },
        { loop: true, actions: [{ type: "R", tip: "investors[i] を読み取る" }] },
        { loop: true, actions: [{ type: "P", ring: "PF2", rewardLink: "chain1", tip: "investors[i] のアドレスへ送金する（投資時と同じスロットを参照）" }] }
      ]
    },
    {
      id: "g5", label: "閲覧・チェックのみ", count: 42, pf: [false, false, false, false],
      blocks: [
        { actions: [{ type: "R", tip: "残高を読み取る" }] },
        { actions: [{ type: "C", tip: "コントラクトが一時停止中でないか確認する" }] }
      ]
    }
  ];

  var selectedId = "g4";

  function verdictFor(g) {
    var pf = g.pf;
    if (pf[0] && pf[1] && pf[2] && pf[3]) return "4つの特徴すべてを含む「連鎖型（チェーン）」Ponziスキームの典型パターンです。ループの中で、新しい投資者の資金を過去の投資者へ還元しています。";
    if (pf[0] && pf[1] && pf[2] && !pf[3]) return "投資・送金・ループはありますが、送金先が投資時に書き込んだスロットとは無関係です。ループ送金があっても、必ずしもPonziとは限らない例です。";
    if (pf[0] && pf[1] && !pf[2]) return "投資と送金はありますが、ループ（繰り返し）がありません。1回限りの資金移動で、典型的なPonziパターンとは異なります。";
    if (pf[0] && !pf[1]) return "投資（入金）のみを行う経路です。単体では特に不審な点はありません。";
    return "投資も送金も行わない、閲覧やチェックだけの経路です。";
  }

  var ns = "http://www.w3.org/2000/svg";

  function showTip(evt, html) {
    tooltip.style.opacity = "1";
    tooltip.style.left = evt.clientX + "px";
    tooltip.style.top = evt.clientY + "px";
    tooltip.style.maxWidth = "240px";
    tooltip.style.whiteSpace = "normal";
    tooltip.innerHTML = html;
  }
  function hideTip() {
    tooltip.style.opacity = "0";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.maxWidth = "";
  }

  function render() {
    root.innerHTML =
      '<h3 class="pl-h">Path Feature Module — 経路をPonzi特徴でグループ化した概観</h3>' +
      '<p class="pl-hint">帯（グループ）をクリックすると、下にそのグループの実行パターンが表示されます。帯の色は各列で「その特徴を持つか」を示します（濃緑=あり／薄緑=なし）。</p>' +
      '<svg id="pl-sankey"></svg>' +
      '<h3 class="pl-h">Path Grouping Module — 選択したグループの実行パターン</h3>' +
      '<div class="pl-group-label"></div>' +
      '<div class="pl-verdict"></div>' +
      '<svg id="pl-sequence"></svg>' +
      '<div class="pl-legend"></div>';

    renderSankey();
    renderSequence();
    renderLegend();
  }

  function renderSankey() {
    var svg = root.querySelector("#pl-sankey");
    var W = 500, H = 210, sidePad = 60, padTop = 10, padBottom = 10, gap = 14, barW = 10;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";

    var n = COLUMNS.length;
    var colX = [];
    for (var i = 0; i < n; i++) colX.push(sidePad + (i * (W - 2 * sidePad)) / (n - 1));

    var total = GROUPS.reduce(function (s, g) { return s + g.count; }, 0);
    var usableH = H - padTop - padBottom - gap;
    var scale = usableH / total;

    var segments = {};
    GROUPS.forEach(function (g) { segments[g.id] = []; });

    for (var c = 0; c < n; c++) {
      var trueGroups = GROUPS.filter(function (g) { return g.pf[c]; });
      var falseGroups = GROUPS.filter(function (g) { return !g.pf[c]; });
      var y = padTop;
      trueGroups.forEach(function (g) {
        var h = g.count * scale;
        segments[g.id][c] = { y0: y, y1: y + h, bucket: true };
        y += h;
      });
      y += gap;
      falseGroups.forEach(function (g) {
        var h = g.count * scale;
        segments[g.id][c] = { y0: y, y1: y + h, bucket: false };
        y += h;
      });
    }

    // column node bars + labels
    COLUMNS.forEach(function (col, c) {
      var trueTotal = GROUPS.filter(function (g) { return g.pf[c]; }).reduce(function (s, g) { return s + g.count; }, 0);
      var falseTotal = total - trueTotal;
      var trueH = trueTotal * scale, falseH = falseTotal * scale;

      var rectTrue = document.createElementNS(ns, "rect");
      rectTrue.setAttribute("x", colX[c] - barW / 2);
      rectTrue.setAttribute("y", padTop);
      rectTrue.setAttribute("width", barW);
      rectTrue.setAttribute("height", trueH);
      rectTrue.setAttribute("fill", "var(--series-6)");
      svg.appendChild(rectTrue);

      var rectFalse = document.createElementNS(ns, "rect");
      rectFalse.setAttribute("x", colX[c] - barW / 2);
      rectFalse.setAttribute("y", padTop + trueH + gap);
      rectFalse.setAttribute("width", barW);
      rectFalse.setAttribute("height", falseH);
      rectFalse.setAttribute("fill", "var(--series-6)");
      rectFalse.setAttribute("opacity", "0.28");
      svg.appendChild(rectFalse);

      var label = document.createElementNS(ns, "text");
      label.setAttribute("x", colX[c]);
      label.setAttribute("y", padTop - 2);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "10");
      label.setAttribute("font-weight", "700");
      label.setAttribute("fill", "var(--text-primary)");
      label.textContent = col.label;
      svg.appendChild(label);

      var jp = document.createElementNS(ns, "text");
      jp.setAttribute("x", colX[c]);
      jp.setAttribute("y", H - 2);
      jp.setAttribute("text-anchor", "middle");
      jp.setAttribute("font-size", "9");
      jp.setAttribute("fill", "var(--text-muted)");
      jp.textContent = "(" + col.jp + ")";
      svg.appendChild(jp);
    });

    // ribbons
    GROUPS.forEach(function (g) {
      var isSelected = g.id === selectedId;
      var grp = document.createElementNS(ns, "g");
      grp.style.cursor = "pointer";
      grp.setAttribute("opacity", isSelected ? "1" : "0.55");

      for (var c = 0; c < n - 1; c++) {
        var a = segments[g.id][c], b = segments[g.id][c + 1];
        var x1 = colX[c] + barW / 2, x2 = colX[c + 1] - barW / 2;
        var midx = (x1 + x2) / 2;
        var color = a.bucket ? "var(--series-6)" : "var(--series-6)";
        var opacity = a.bucket ? 0.75 : 0.25;
        var d = "M" + x1 + " " + a.y0 +
          " C " + midx + " " + a.y0 + " " + midx + " " + b.y0 + " " + x2 + " " + b.y0 +
          " L " + x2 + " " + b.y1 +
          " C " + midx + " " + b.y1 + " " + midx + " " + a.y1 + " " + x1 + " " + a.y1 + " Z";
        var path = document.createElementNS(ns, "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", color);
        path.setAttribute("fill-opacity", opacity);
        if (isSelected) { path.setAttribute("stroke", "var(--series-2)"); path.setAttribute("stroke-width", "1"); }
        grp.appendChild(path);
      }

      grp.addEventListener("click", function () { selectedId = g.id; render(); });
      grp.addEventListener("mouseenter", function (e) {
        showTip(e, "<strong>" + g.label + "</strong><br>" + g.count + " 経路");
      });
      grp.addEventListener("mousemove", function (e) {
        showTip(e, "<strong>" + g.label + "</strong><br>" + g.count + " 経路");
      });
      grp.addEventListener("mouseleave", hideTip);
      svg.appendChild(grp);
    });
  }

  function renderSequence() {
    var g = GROUPS.filter(function (x) { return x.id === selectedId; })[0];
    root.querySelector(".pl-group-label").innerHTML = "<strong>" + g.label + "</strong>（" + g.count + " 経路をマージした要約）";
    root.querySelector(".pl-verdict").textContent = verdictFor(g);

    var svg = root.querySelector("#pl-sequence");
    var H = 90, blockPad = 10, actionR = 11, actionGap = 34, blockGap = 14;
    var x = 24;
    var actionPositions = []; // {x, action, blockIndex}
    var blockRanges = [];

    g.blocks.forEach(function (block, bi) {
      var startX = x;
      block.actions.forEach(function (a) {
        actionPositions.push({ x: x, action: a, blockIndex: bi });
        x += actionGap;
      });
      var endX = x - actionGap + actionR + blockPad;
      blockRanges.push({ x0: startX - blockPad, x1: endX, loop: !!block.loop });
      x += blockGap;
    });
    var W = x + 20;

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";

    // basic-block boxes
    blockRanges.forEach(function (r) {
      var rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", r.x0);
      rect.setAttribute("y", 30);
      rect.setAttribute("width", r.x1 - r.x0);
      rect.setAttribute("height", 40);
      rect.setAttribute("rx", 6);
      rect.setAttribute("fill", "var(--surface-1)");
      rect.setAttribute("stroke", "var(--border)");
      svg.appendChild(rect);
    });

    // loop wrapper around contiguous loop blocks
    var loopRanges = blockRanges.filter(function (r) { return r.loop; });
    if (loopRanges.length) {
      var lx0 = Math.min.apply(null, loopRanges.map(function (r) { return r.x0; })) - 4;
      var lx1 = Math.max.apply(null, loopRanges.map(function (r) { return r.x1; })) + 4;
      var wrap = document.createElementNS(ns, "rect");
      wrap.setAttribute("x", lx0);
      wrap.setAttribute("y", 22);
      wrap.setAttribute("width", lx1 - lx0);
      wrap.setAttribute("height", 56);
      wrap.setAttribute("rx", 8);
      wrap.setAttribute("fill", "none");
      wrap.setAttribute("stroke", "var(--series-7)");
      wrap.setAttribute("stroke-dasharray", "4 3");
      wrap.setAttribute("stroke-width", "1.6");
      svg.appendChild(wrap);
    }

    // reward connector line(s)
    var byLink = {};
    actionPositions.forEach(function (p) {
      if (p.action.rewardLink) {
        byLink[p.action.rewardLink] = byLink[p.action.rewardLink] || [];
        byLink[p.action.rewardLink].push(p);
      }
    });
    Object.keys(byLink).forEach(function (key) {
      var pair = byLink[key];
      if (pair.length < 2) return;
      var a1 = pair[0], a2 = pair[pair.length - 1];
      var midx = (a1.x + a2.x) / 2;
      var path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M" + a1.x + " " + 50 + " C " + midx + " 5, " + midx + " 5, " + a2.x + " 50");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "var(--text-primary)");
      path.setAttribute("stroke-width", "1.6");
      svg.appendChild(path);
    });

    // action circles
    actionPositions.forEach(function (p) {
      var meta = ACTION_META[p.action.type];
      if (p.action.ring) {
        var ring = document.createElementNS(ns, "circle");
        ring.setAttribute("cx", p.x); ring.setAttribute("cy", 50); ring.setAttribute("r", actionR + 3);
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", "var(--text-primary)");
        ring.setAttribute("stroke-width", "2");
        svg.appendChild(ring);
      }
      var c = document.createElementNS(ns, "circle");
      c.setAttribute("cx", p.x); c.setAttribute("cy", 50); c.setAttribute("r", actionR);
      c.setAttribute("fill", "var(" + meta.color + ")");
      svg.appendChild(c);

      var t = document.createElementNS(ns, "text");
      t.setAttribute("x", p.x); t.setAttribute("y", 53.5);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "10");
      t.setAttribute("font-weight", "700");
      t.setAttribute("fill", p.action.type === "C" ? "#1a1a19" : "#fff");
      t.textContent = p.action.type;
      svg.appendChild(t);

      var hit = document.createElementNS(ns, "circle");
      hit.setAttribute("cx", p.x); hit.setAttribute("cy", 50); hit.setAttribute("r", actionR + 4);
      hit.setAttribute("fill", "transparent");
      hit.style.cursor = "help";
      var ringNote = p.action.ring ? ("<br><em>Ponzi特徴: " + (p.action.ring === "PF1" ? "Investing" : "Payment") + "</em>") : "";
      hit.addEventListener("mouseenter", function (e) { showTip(e, "<strong>" + meta.label + "</strong>（" + meta.jp + "）<br>" + p.action.tip + ringNote); });
      hit.addEventListener("mousemove", function (e) { showTip(e, "<strong>" + meta.label + "</strong>（" + meta.jp + "）<br>" + p.action.tip + ringNote); });
      hit.addEventListener("mouseleave", hideTip);
      svg.appendChild(hit);
    });
  }

  function renderLegend() {
    var legend = root.querySelector(".pl-legend");
    legend.innerHTML =
      '<span><span class="pl-dot" style="background:var(--series-1)"></span>W: Write Information</span>' +
      '<span><span class="pl-dot" style="background:var(--series-8)"></span>P: Invoke Payment</span>' +
      '<span><span class="pl-dot" style="background:var(--series-4)"></span>C: Check Constraint</span>' +
      '<span><span class="pl-dot" style="background:var(--text-muted)"></span>R: Read Information</span>' +
      '<span><span class="pl-ring"></span>黒い外枠 = Ponzi特徴（Investing/Payment）</span>' +
      '<span><span class="pl-dashed"></span>紫の破線 = ループ（Loop）</span>' +
      '<span><span class="pl-line"></span>黒線 = 同じスロットへの書込/参照（Rewarding）</span>';
  }

  render();
})();
