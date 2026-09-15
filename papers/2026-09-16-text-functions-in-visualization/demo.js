// Interactive explorer for the text-function framework of Stokes,
// Arunkumar, Hearst & Padilla, "An Analysis of Text Functions in
// Information Visualization" (arXiv:2507.12334).
//
// Mirrors the paper's own Fig. 2 example: the SAME underlying chart data,
// presented two ways — a "Narrative Framing" (Factor 4) design that leans
// on an editorializing title/subtitle and a single callout, versus an
// "Annotation-Centric" (Factor 2) design that drops the axis in favor of
// direct value labels on every point. Every text element is tagged with
// the text function(s) it performs from the paper's 10-function taxonomy,
// so clicking an element or a function in the legend shows the mapping.
//
// IMPORTANT: the chart title/subtitle/data/country name are entirely
// invented for this demo — not the paper's real example or data.
(function () {
  "use strict";

  var root = document.getElementById("textfn-demo");
  var tooltip = document.getElementById("tooltip");
  if (!root) return;

  var YEARS = ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"];
  var MAIN = [-1.0, -1.5, -2.0, -2.5, -3.0, -9.3, -6.0, -5.0, -6.2, -6.8];
  var REF = [-3.0, -3.0, -3.1, -3.0, -3.0, -3.4, -3.2, -3.1, -3.0, -3.0];

  var FUNCTIONS = [
    { tag: "identifyMappings", label: "Identify Mappings", jp: "対応関係を示す", def: "データと視覚要素（位置・色・形など）の対応を伝える。軸やレジェンドの本来の役割。" },
    { tag: "identifyValues", label: "Identify Values", jp: "値を示す", def: "個々のデータ点の値やカテゴリをそのまま書き出し、正確な値の参照先になる。" },
    { tag: "presentMetadata", label: "Present Metadata", jp: "メタ情報を示す", def: "出典・加工方法・作成者など、データそのものではない背景情報を伝える。" },
    { tag: "replaceMappings", label: "Replace Mappings", jp: "対応関係を代替する", def: "軸やレジェンドなど従来の要素を省略し、テキストでその役割を代替する。" },
    { tag: "compareMappings", label: "Compare Mappings", jp: "対応関係を言い換える", def: "専門的・抽象的な対応関係を、より身近で分かりやすい言葉に言い換える。" },
    { tag: "compareValues", label: "Compare Values", jp: "値を比較する", def: "複数のデータ点やグループ間の関係を直接比較して述べる。" },
    { tag: "summarizeValues", label: "Summarize Values", jp: "値を要約する", def: "平均・合計などの演算によってデータ点同士の関係を説明する。" },
    { tag: "summarizeConcepts", label: "Summarize Concepts", jp: "概念を要約する", def: "チャート全体の要点をまとめる。解釈を加える「Synthesis」と、変数を列挙する「Variables」の2種がある。", tags: ["summarizeConcepts:synthesis", "summarizeConcepts:variables"] },
    { tag: "presentContext", label: "Present Context", jp: "文脈を示す", def: "チャートに表れない背景知識（社会・経済・歴史的文脈など）を補う。" },
    { tag: "presentValencedSubtext", label: "Present Valenced Subtext", jp: "感情的なニュアンスを持たせる", def: "中立的な言い方に書き換え可能かを目安に、感情や価値判断を含む表現を使う。" }
  ].map(function (f) { return { tag: f.tag, label: f.label, jp: f.jp, def: f.def, tags: f.tags || [f.tag] }; });

  var MODES = {
    narrative: {
      label: "F4: Narrative Framing",
      desc: "物語的な枠付け：編集的なタイトルと1つの要約的な注釈で、データの「意味」を強く方向づける。",
      showAxis: false,
      showAllPointLabels: false,
      title: { text: "エコノミア、財政危機の淵に", tags: ["summarizeConcepts:synthesis", "presentValencedSubtext"] },
      subtitle: { text: "この10年で財政赤字は悪化を続け、2020年には近隣諸国平均を大きく下回った", tags: ["presentContext", "compareValues"] },
      caption: { text: "データ: エコノミア財務省（本デモ用の架空データです）", tags: ["presentMetadata"] },
      callout: { yearIndex: 5, text: "-9.3%（この10年で最悪）", tags: ["identifyValues", "summarizeValues", "replaceMappings"] },
      refLineLabel: { text: "近隣諸国平均", tags: ["identifyMappings"] }
    },
    annotation: {
      label: "F2: Annotation-Centric Design",
      desc: "注釈中心デザイン：軸を省き、各データ点に直接値を添えることで、詳細をチャートの中に埋め込む。",
      showAxis: false,
      showAllPointLabels: true,
      title: { text: "エコノミアの財政収支（対GDP比、%）2015–2024", tags: ["summarizeConcepts:variables", "identifyMappings"] },
      subtitle: null,
      caption: { text: "データ: エコノミア財務省（本デモ用の架空データです）", tags: ["presentMetadata"] },
      compareAnnotation: { text: "2015年比 -5.8pt", tags: ["compareValues"] },
      refLineLabel: { text: "近隣諸国平均", tags: ["identifyMappings"] }
    }
  };

  var mode = "narrative";
  var activeFilter = null;

  function elementsFor(m) {
    var els = [];
    if (m.title) els.push({ id: "title", text: m.title.text, tags: m.title.tags });
    if (m.subtitle) els.push({ id: "subtitle", text: m.subtitle.text, tags: m.subtitle.tags });
    if (m.caption) els.push({ id: "caption", text: m.caption.text, tags: m.caption.tags });
    if (m.callout) els.push({ id: "callout", text: m.callout.text, tags: m.callout.tags });
    if (m.compareAnnotation) els.push({ id: "compareAnnotation", text: m.compareAnnotation.text, tags: m.compareAnnotation.tags });
    if (m.refLineLabel) els.push({ id: "refLineLabel", text: m.refLineLabel.text, tags: m.refLineLabel.tags });
    if (m.showAllPointLabels) {
      MAIN.forEach(function (v, i) { els.push({ id: "point" + i, text: v.toFixed(1) + "%", tags: ["identifyValues", "replaceMappings"] }); });
    }
    return els;
  }

  function matches(tags, filterTags) {
    if (!filterTags) return false;
    return tags.some(function (t) { return filterTags.indexOf(t) !== -1; });
  }

  function showInfo(evt, text, tags) {
    var lines = tags.map(function (t) {
      var base = t.split(":")[0];
      var f = FUNCTIONS.filter(function (fn) { return fn.tags.indexOf(t) !== -1 || fn.tag === base; })[0];
      return f ? f.label + "（" + f.jp + "）: " + f.def : t;
    });
    tooltip.style.opacity = "1";
    tooltip.style.left = evt.clientX + "px";
    tooltip.style.top = evt.clientY + "px";
    tooltip.style.maxWidth = "260px";
    tooltip.style.whiteSpace = "normal";
    tooltip.innerHTML = '<strong>「' + text + '」</strong><br>' + lines.join("<br>");
  }
  function hideInfo() {
    tooltip.style.opacity = "0";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.maxWidth = "";
  }

  function textEl(tag, text, tags, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    el.classList.add("tf-tagged");
    if (activeFilter && matches(tags, activeFilter)) el.classList.add("tf-highlight");
    else if (activeFilter) el.classList.add("tf-dim");
    el.addEventListener("mouseenter", function (e) { showInfo(e, text, tags); });
    el.addEventListener("mousemove", function (e) { showInfo(e, text, tags); });
    el.addEventListener("mouseleave", hideInfo);
    return el;
  }

  var ns = "http://www.w3.org/2000/svg";

  function render() {
    var m = MODES[mode];
    root.innerHTML =
      '<div class="tf-mode-tabs"></div>' +
      '<p class="tf-mode-desc"></p>' +
      '<div class="tf-chart-card">' +
        '<div class="tf-text-top"></div>' +
        '<svg id="tf-svg"></svg>' +
        '<div class="tf-text-bottom"></div>' +
      '</div>' +
      '<h3 class="tf-legend-title">文章の10機能（クリックで該当箇所をハイライト）</h3>' +
      '<div class="tf-legend"></div>';

    var tabs = root.querySelector(".tf-mode-tabs");
    Object.keys(MODES).forEach(function (key) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tf-tab";
      btn.textContent = MODES[key].label;
      btn.setAttribute("aria-pressed", key === mode ? "true" : "false");
      btn.addEventListener("click", function () { mode = key; render(); });
      tabs.appendChild(btn);
    });
    root.querySelector(".tf-mode-desc").textContent = m.desc;

    var top = root.querySelector(".tf-text-top");
    if (m.title) top.appendChild(textEl("div", m.title.text, m.title.tags, "tf-title"));
    if (m.subtitle) top.appendChild(textEl("div", m.subtitle.text, m.subtitle.tags, "tf-subtitle"));

    renderChart(m);

    var bottom = root.querySelector(".tf-text-bottom");
    if (m.caption) bottom.appendChild(textEl("div", m.caption.text, m.caption.tags, "tf-caption"));

    var legend = root.querySelector(".tf-legend");
    var currentTags = elementsFor(m).reduce(function (acc, el) { return acc.concat(el.tags); }, []);
    FUNCTIONS.forEach(function (f) {
      var count = currentTags.filter(function (t) { return f.tags.indexOf(t) !== -1; }).length;
      var row = document.createElement("button");
      row.type = "button";
      row.className = "tf-legend-row" + (count === 0 ? " tf-legend-row-empty" : "");
      row.setAttribute("aria-pressed", activeFilter === f.tags ? "true" : "false");
      row.innerHTML =
        '<span class="tf-legend-label">' + f.label + "（" + f.jp + "）</span>" +
        '<span class="tf-legend-def">' + f.def + "</span>" +
        '<span class="tf-legend-count">' + count + " 箇所</span>";
      row.addEventListener("click", function () {
        activeFilter = activeFilter === f.tags ? null : f.tags;
        render();
      });
      legend.appendChild(row);
    });
  }

  function renderChart(m) {
    var svg = root.querySelector("#tf-svg");
    var W = 460, H = 220, padL = 18, padR = 18, padT = 20, padB = 28;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";

    var all = MAIN.concat(REF);
    var min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    var range = max - min || 1;
    function xFor(i) { return padL + (i * (W - padL - padR)) / (YEARS.length - 1); }
    function yFor(v) { return padT + (H - padT - padB) * (1 - (v - min) / range); }

    var zeroY = yFor(0);
    var zeroLine = document.createElementNS(ns, "line");
    zeroLine.setAttribute("x1", padL); zeroLine.setAttribute("x2", W - padR);
    zeroLine.setAttribute("y1", zeroY); zeroLine.setAttribute("y2", zeroY);
    zeroLine.setAttribute("stroke", "var(--gridline)");
    svg.appendChild(zeroLine);

    function pathFor(values) {
      return values.map(function (v, i) { return (i === 0 ? "M" : "L") + xFor(i).toFixed(1) + " " + yFor(v).toFixed(1); }).join(" ");
    }

    var refPath = document.createElementNS(ns, "path");
    refPath.setAttribute("d", pathFor(REF));
    refPath.setAttribute("fill", "none");
    refPath.setAttribute("stroke", "var(--text-muted)");
    refPath.setAttribute("stroke-width", "1.5");
    refPath.setAttribute("stroke-dasharray", "4 3");
    svg.appendChild(refPath);

    var mainPath = document.createElementNS(ns, "path");
    mainPath.setAttribute("d", pathFor(MAIN));
    mainPath.setAttribute("fill", "none");
    mainPath.setAttribute("stroke", "var(--series-1)");
    mainPath.setAttribute("stroke-width", "2.5");
    mainPath.setAttribute("stroke-linejoin", "round");
    svg.appendChild(mainPath);

    MAIN.forEach(function (v, i) {
      var c = document.createElementNS(ns, "circle");
      c.setAttribute("cx", xFor(i)); c.setAttribute("cy", yFor(v)); c.setAttribute("r", 3);
      c.setAttribute("fill", "var(--series-1)");
      svg.appendChild(c);

      if (m.showAllPointLabels) {
        var tags = ["identifyValues", "replaceMappings"];
        var t = document.createElementNS(ns, "text");
        t.setAttribute("x", xFor(i));
        t.setAttribute("y", yFor(v) - 8);
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("font-size", "9");
        t.setAttribute("fill", "var(--text-secondary)");
        t.textContent = v.toFixed(1);
        t.classList.add("tf-tagged");
        if (activeFilter && matches(tags, activeFilter)) t.classList.add("tf-highlight");
        else if (activeFilter) t.classList.add("tf-dim");
        t.addEventListener("mouseenter", function (e) { showInfo(e, v.toFixed(1) + "%", tags); });
        t.addEventListener("mousemove", function (e) { showInfo(e, v.toFixed(1) + "%", tags); });
        t.addEventListener("mouseleave", hideInfo);
        svg.appendChild(t);
      }
    });

    if (m.showAxis) {
      YEARS.forEach(function (y, i) {
        if (i % 2 !== 0) return;
        var t = document.createElementNS(ns, "text");
        t.setAttribute("x", xFor(i)); t.setAttribute("y", H - 8);
        t.setAttribute("text-anchor", "middle"); t.setAttribute("font-size", "9");
        t.setAttribute("fill", "var(--text-muted)");
        t.textContent = y;
        svg.appendChild(t);
      });
    } else {
      var xLbl = document.createElementNS(ns, "text");
      xLbl.setAttribute("x", padL); xLbl.setAttribute("y", H - 6);
      xLbl.setAttribute("font-size", "8"); xLbl.setAttribute("fill", "var(--text-muted)");
      xLbl.textContent = YEARS[0] + " – " + YEARS[YEARS.length - 1];
      svg.appendChild(xLbl);
    }

    // reference line label (acts as the legend, since none is shown)
    var refLabel = m.refLineLabel;
    var rl = document.createElementNS(ns, "text");
    rl.setAttribute("x", xFor(YEARS.length - 1) - 4);
    rl.setAttribute("y", yFor(REF[REF.length - 1]) - 6);
    rl.setAttribute("text-anchor", "end");
    rl.setAttribute("font-size", "9");
    rl.setAttribute("fill", "var(--text-muted)");
    rl.textContent = refLabel.text;
    rl.classList.add("tf-tagged");
    if (activeFilter && matches(refLabel.tags, activeFilter)) rl.classList.add("tf-highlight");
    else if (activeFilter) rl.classList.add("tf-dim");
    rl.addEventListener("mouseenter", function (e) { showInfo(e, refLabel.text, refLabel.tags); });
    rl.addEventListener("mousemove", function (e) { showInfo(e, refLabel.text, refLabel.tags); });
    rl.addEventListener("mouseleave", hideInfo);
    svg.appendChild(rl);

    if (m.callout) {
      var idx = m.callout.yearIndex;
      var px = xFor(idx), py = yFor(MAIN[idx]);
      var leader = document.createElementNS(ns, "line");
      leader.setAttribute("x1", px); leader.setAttribute("y1", py);
      leader.setAttribute("x2", px + 40); leader.setAttribute("y2", py - 30);
      leader.setAttribute("stroke", "var(--series-2)");
      svg.appendChild(leader);

      var box = document.createElementNS(ns, "text");
      box.setAttribute("x", Math.min(px + 42, W - padR - 4));
      box.setAttribute("y", py - 34);
      box.setAttribute("text-anchor", px + 42 > W - padR - 60 ? "end" : "start");
      box.setAttribute("font-size", "10");
      box.setAttribute("font-weight", "700");
      box.setAttribute("fill", "var(--series-2)");
      box.textContent = m.callout.text;
      box.classList.add("tf-tagged");
      if (activeFilter && matches(m.callout.tags, activeFilter)) box.classList.add("tf-highlight");
      else if (activeFilter) box.classList.add("tf-dim");
      box.addEventListener("mouseenter", function (e) { showInfo(e, m.callout.text, m.callout.tags); });
      box.addEventListener("mousemove", function (e) { showInfo(e, m.callout.text, m.callout.tags); });
      box.addEventListener("mouseleave", hideInfo);
      svg.appendChild(box);
    }

    if (m.compareAnnotation) {
      var lastX = xFor(MAIN.length - 1), lastY = yFor(MAIN[MAIN.length - 1]);
      var cmp = document.createElementNS(ns, "text");
      cmp.setAttribute("x", lastX);
      cmp.setAttribute("y", lastY + 16);
      cmp.setAttribute("text-anchor", "end");
      cmp.setAttribute("font-size", "9.5");
      cmp.setAttribute("fill", "var(--series-8)");
      cmp.textContent = m.compareAnnotation.text;
      cmp.classList.add("tf-tagged");
      if (activeFilter && matches(m.compareAnnotation.tags, activeFilter)) cmp.classList.add("tf-highlight");
      else if (activeFilter) cmp.classList.add("tf-dim");
      cmp.addEventListener("mouseenter", function (e) { showInfo(e, m.compareAnnotation.text, m.compareAnnotation.tags); });
      cmp.addEventListener("mousemove", function (e) { showInfo(e, m.compareAnnotation.text, m.compareAnnotation.tags); });
      cmp.addEventListener("mouseleave", hideInfo);
      svg.appendChild(cmp);
    }
  }

  render();
})();
