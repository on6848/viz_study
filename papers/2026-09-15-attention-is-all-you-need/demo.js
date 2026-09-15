// Interactive Self-Attention heatmap demo for "Attention Is All You Need".
//
// IMPORTANT: the attention weights below are SYNTHETIC / hand-designed to
// illustrate the mechanism (Scaled Dot-Product Attention + Multi-Head
// Attention), not the output of an actual trained model. Each head's score
// function is documented so the "story" it tells is transparent.
(function () {
  "use strict";

  var TOKENS = ["The", "cat", "sat", "on", "the", "mat", "because", "it", "was", "tired"];
  var N = TOKENS.length;
  var IT = TOKENS.indexOf("it");
  var CAT = TOKENS.indexOf("cat");
  var BECAUSE = TOKENS.indexOf("because");
  var TIRED = TOKENS.indexOf("tired");

  // softmax over a row of raw scores -> a probability distribution (rows sum to 1),
  // exactly as in the paper: softmax(QK^T / sqrt(d_k)) applied per query row.
  function softmaxRow(scores) {
    var m = Math.max.apply(null, scores);
    var exps = scores.map(function (s) { return Math.exp(s - m); });
    var sum = exps.reduce(function (a, b) { return a + b; }, 0);
    return exps.map(function (e) { return e / sum; });
  }

  function buildMatrix(scoreFn) {
    var matrix = [];
    for (var i = 0; i < N; i++) {
      var scores = [];
      for (var j = 0; j < N; j++) scores.push(scoreFn(i, j));
      matrix.push(softmaxRow(scores));
    }
    return matrix;
  }

  var HEADS = [
    {
      name: "Head 1: 局所パターン",
      desc: "各トークンは主に直前〜近傍のトークンに注目します。構文的な隣接関係（例: 動詞と直前の主語）を学習した場合に近いパターンです。",
      scoreFn: function (i, j) { return -Math.abs(i - j - 1) * 1.6; }
    },
    {
      name: "Head 2: 照応パターン",
      desc: "代名詞 \"it\" が、指している名詞 \"cat\" に強く注目します。照応関係（何を指しているか）を捉えるヘッドのイメージです。",
      scoreFn: function (i, j) {
        if (i === IT) {
          if (j === CAT) return 4.5;
          if (j === i) return 1.2;
          return -Math.abs(i - j) * 0.5;
        }
        return -Math.abs(i - j) * 1.1 + (i === j ? 1.2 : 0);
      }
    },
    {
      name: "Head 3: 文脈・因果パターン",
      desc: "\"it\" が理由節の \"because\" / \"tired\" に注目します。文全体の意味（なぜ疲れているか）を捉えるヘッドのイメージです。",
      scoreFn: function (i, j) {
        if (i === IT) {
          if (j === BECAUSE) return 3.4;
          if (j === TIRED) return 3.8;
          if (j === i) return 1.0;
          return -Math.abs(i - j) * 0.6;
        }
        return -Math.abs(i - j) * 0.9 + (i === j ? 1.0 : 0);
      }
    }
  ];

  var matrices = HEADS.map(function (h) { return buildMatrix(h.scoreFn); });

  var state = { head: 0, query: IT };

  var root = document.getElementById("attention-demo");
  var tooltip = document.getElementById("tooltip");
  if (!root) return;

  root.innerHTML =
    '<div class="head-tabs" role="tablist" aria-label="Attention head を選択"></div>' +
    '<p class="head-desc"></p>' +
    '<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:6px">Queryトークンを選択（該当する行がハイライトされます）:</p>' +
    '<div class="query-picker" role="group" aria-label="Query token を選択"></div>' +
    '<div class="heatmap-wrap"><svg id="heatmap-svg"></svg></div>' +
    '<div class="legend"><span>0</span><div class="legend-ramp"></div><span>1（注目の重み）</span></div>' +
    '<button class="toggle-table-btn" type="button" aria-expanded="false">表で見る（アクセシブル表示）</button>' +
    '<table id="matrix-table"><thead></thead><tbody></tbody></table>';

  var tabsEl = root.querySelector(".head-tabs");
  var descEl = root.querySelector(".head-desc");
  var pickerEl = root.querySelector(".query-picker");
  var svg = root.querySelector("#heatmap-svg");
  var toggleBtn = root.querySelector(".toggle-table-btn");
  var tableEl = root.querySelector("#matrix-table");

  HEADS.forEach(function (h, idx) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "head-tab";
    btn.textContent = h.name;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-pressed", idx === state.head ? "true" : "false");
    btn.addEventListener("click", function () {
      state.head = idx;
      tabsEl.querySelectorAll(".head-tab").forEach(function (b, i) {
        b.setAttribute("aria-pressed", i === idx ? "true" : "false");
      });
      render();
    });
    tabsEl.appendChild(btn);
  });

  TOKENS.forEach(function (tok, idx) {
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "query-chip";
    chip.textContent = tok;
    chip.setAttribute("aria-pressed", idx === state.query ? "true" : "false");
    chip.addEventListener("click", function () {
      state.query = idx;
      pickerEl.querySelectorAll(".query-chip").forEach(function (c, i) {
        c.setAttribute("aria-pressed", i === idx ? "true" : "false");
      });
      render();
    });
    pickerEl.appendChild(chip);
  });

  toggleBtn.addEventListener("click", function () {
    var showing = tableEl.classList.toggle("visible");
    toggleBtn.setAttribute("aria-expanded", showing ? "true" : "false");
    toggleBtn.textContent = showing ? "表を隠す" : "表で見る（アクセシブル表示）";
  });

  // sequential blue ramp steps (from the shared palette) — light -> dark.
  var RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#256abf", "#184f95", "#0d366b"];
  function colorFor(v) {
    var idx = Math.round(v * (RAMP.length - 1));
    return RAMP[Math.max(0, Math.min(RAMP.length - 1, idx))];
  }

  var CELL = 34, LABEL_W = 74, LABEL_H = 60;

  function render() {
    var matrix = matrices[state.head];
    descEl.textContent = HEADS[state.head].desc;

    var w = LABEL_W + N * CELL;
    var h = LABEL_H + N * CELL;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.innerHTML = "";

    var ns = "http://www.w3.org/2000/svg";

    // column labels (key tokens), rotated
    TOKENS.forEach(function (tok, j) {
      var t = document.createElementNS(ns, "text");
      t.setAttribute("x", LABEL_W + j * CELL + CELL / 2);
      t.setAttribute("y", LABEL_H - 10);
      t.setAttribute("text-anchor", "start");
      t.setAttribute("transform", "rotate(-45 " + (LABEL_W + j * CELL + CELL / 2) + " " + (LABEL_H - 10) + ")");
      t.setAttribute("font-size", "11");
      t.setAttribute("fill", "var(--text-muted)");
      t.textContent = tok;
      svg.appendChild(t);
    });

    // row labels (query tokens)
    TOKENS.forEach(function (tok, i) {
      var t = document.createElementNS(ns, "text");
      t.setAttribute("x", LABEL_W - 8);
      t.setAttribute("y", LABEL_H + i * CELL + CELL / 2 + 4);
      t.setAttribute("text-anchor", "end");
      t.setAttribute("font-size", "11");
      t.setAttribute("fill", i === state.query ? "var(--series-2)" : "var(--text-muted)");
      t.setAttribute("font-weight", i === state.query ? "700" : "400");
      t.textContent = tok;
      svg.appendChild(t);
    });

    // cells
    for (var i = 0; i < N; i++) {
      for (var j = 0; j < N; j++) {
        var v = matrix[i][j];
        var rect = document.createElementNS(ns, "rect");
        rect.setAttribute("class", "heatmap-cell");
        rect.setAttribute("tabindex", "0");
        rect.setAttribute("x", LABEL_W + j * CELL + 1);
        rect.setAttribute("y", LABEL_H + i * CELL + 1);
        rect.setAttribute("width", CELL - 2);
        rect.setAttribute("height", CELL - 2);
        rect.setAttribute("rx", 3);
        rect.setAttribute("fill", colorFor(v));
        if (i === state.query) {
          rect.setAttribute("stroke", "var(--series-2)");
          rect.setAttribute("stroke-width", "2");
        }
        (function (i, j, v) {
          function show(evt) {
            tooltip.style.opacity = "1";
            tooltip.style.left = evt.clientX + "px";
            tooltip.style.top = evt.clientY + "px";
            tooltip.textContent = TOKENS[i] + " → " + TOKENS[j] + " : " + v.toFixed(3);
          }
          rect.addEventListener("mousemove", show);
          rect.addEventListener("mouseenter", show);
          rect.addEventListener("mouseleave", function () { tooltip.style.opacity = "0"; });
          rect.addEventListener("focus", function (e) {
            var r = rect.getBoundingClientRect();
            show({ clientX: r.left + r.width / 2, clientY: r.top });
          });
          rect.addEventListener("blur", function () { tooltip.style.opacity = "0"; });
          rect.addEventListener("click", function () {
            state.query = i;
            pickerEl.querySelectorAll(".query-chip").forEach(function (c, ci) {
              c.setAttribute("aria-pressed", ci === i ? "true" : "false");
            });
            render();
          });
        })(i, j, v);
        svg.appendChild(rect);
      }
    }

    renderTable(matrix);
  }

  function renderTable(matrix) {
    var thead = tableEl.querySelector("thead");
    var tbody = tableEl.querySelector("tbody");
    thead.innerHTML = "<tr><th>Query \\ Key</th>" + TOKENS.map(function (t) { return "<th>" + t + "</th>"; }).join("") + "</tr>";
    tbody.innerHTML = TOKENS.map(function (rowTok, i) {
      return "<tr><th>" + rowTok + "</th>" + matrix[i].map(function (v) { return "<td>" + v.toFixed(2) + "</td>"; }).join("") + "</tr>";
    }).join("");
  }

  render();
})();
