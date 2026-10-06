/* Krish Patel portfolio: shared behaviour (theme, menu, lightbox, copy, scope + diagram drawings) */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  var redrawers = [];
  function onThemeChange(fn) { redrawers.push(fn); }
  function fireTheme() { redrawers.forEach(function (fn) { try { fn(); } catch (e) {} }); }
  new MutationObserver(fireTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", fireTheme);
  }

  /* ---------- theme toggle ---------- */
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    function label() { btn.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme"); }
    label();
    btn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("kp-theme", next); } catch (e) {}
      label();
    });
  });

  /* ---------- mobile menu ---------- */
  var menuBtn = document.querySelector("[data-menu]");
  var links = document.getElementById("nav-links");
  if (menuBtn && links) {
    menuBtn.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) { links.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ---------- copy buttons ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      var original = btn.textContent;
      function done(msg) { btn.textContent = msg; setTimeout(function () { btn.textContent = original; }, 1800); }
      function fallback() {
        var target = document.getElementById(btn.getAttribute("data-copy-target"));
        if (target) {
          var r = document.createRange(); r.selectNodeContents(target);
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          done("Selected");
        }
      }
      try {
        navigator.clipboard.writeText(text).then(function () { done("Copied"); }, fallback);
      } catch (e) { fallback(); }
    });
  });

  /* ---------- lightbox ---------- */
  var box = document.getElementById("lightbox");
  if (box && typeof box.showModal === "function") {
    var bImg = box.querySelector("img"), bCap = box.querySelector("p");
    document.querySelectorAll("[data-full]").forEach(function (b) {
      b.addEventListener("click", function () {
        bImg.src = b.getAttribute("data-full");
        bImg.alt = b.querySelector("img") ? b.querySelector("img").alt : "";
        bCap.textContent = b.getAttribute("data-caption") || "";
        box.showModal();
      });
    });
    box.addEventListener("click", function (e) { if (e.target === box || e.target.closest(".close")) box.close(); });
  }

  /* ---------- helpers for canvases ---------- */
  function fitCanvas(c) {
    var r = c.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    var ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: r.width, h: r.height };
  }
  function whenVisible(el, cb) {
    if (!("IntersectionObserver" in window)) { cb(true); return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { cb(e.isIntersecting); }); }, { rootMargin: "80px" }).observe(el);
  }
  function animate(el, draw) {
    var visible = true, raf = 0, t0 = performance.now();
    function frame(now) { draw((now - t0) / 1000); if (visible && !reduceMotion) raf = requestAnimationFrame(frame); }
    whenVisible(el, function (v) { visible = v; cancelAnimationFrame(raf); if (v) raf = requestAnimationFrame(frame); });
    draw(0.35);
    onThemeChange(function () { draw((performance.now() - t0) / 1000); });
    window.addEventListener("resize", function () { draw((performance.now() - t0) / 1000); });
  }

  /* ---------- hero scope: input vs level-shifted output ---------- */
  var scope = document.getElementById("scope-canvas");
  if (scope) {
    animate(scope, function (t) {
      var f = fitCanvas(scope), ctx = f.ctx, w = f.w, h = f.h;
      var divX = 10, divY = 8, dx = w / divX, dy = h / divY;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = css("--screen-grid"); ctx.lineWidth = 1;
      for (var i = 1; i < divX; i++) { ctx.beginPath(); ctx.moveTo(i * dx + 0.5, 0); ctx.lineTo(i * dx + 0.5, h); ctx.stroke(); }
      for (var j = 1; j < divY; j++) { ctx.beginPath(); ctx.moveTo(0, j * dy + 0.5); ctx.lineTo(w, j * dy + 0.5); ctx.stroke(); }
      // minor ticks on center axes
      ctx.beginPath();
      for (var k = 0; k < divX * 5; k++) { var x = k * dx / 5; ctx.moveTo(x, h / 2 - 3); ctx.lineTo(x, h / 2 + 3); }
      for (var m = 0; m < divY * 5; m++) { var y = m * dy / 5; ctx.moveTo(w / 2 - 3, y); ctx.lineTo(w / 2 + 3, y); }
      ctx.stroke();
      // 1 V/div, 0 V at centre
      function yv(v) { return h / 2 - v * dy; }
      var ink = css("--screen-ink");
      ctx.setLineDash([5, 5]); ctx.strokeStyle = css("--trace-2"); ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(0, yv(1.65)); ctx.lineTo(w, yv(1.65)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      var cycles = 2.5, phase = t * 1.4;
      function trace(color, offset, width) {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowColor = color; ctx.shadowBlur = 8;
        ctx.beginPath();
        for (var px = 0; px <= w; px += 2) {
          var th = (px / w) * cycles * Math.PI * 2 - phase;
          var v = offset + 1.65 * Math.sin(th);
          if (px === 0) ctx.moveTo(px, yv(v)); else ctx.lineTo(px, yv(v));
        }
        ctx.stroke(); ctx.shadowBlur = 0;
      }
      trace(css("--trace"), 0, 2);
      trace(css("--trace-2"), 1.65, 2);
      ctx.font = "500 11px " + css("--f-mono");
      ctx.fillStyle = ink; ctx.textBaseline = "middle";
      // ground markers
      function marker(v, color, label) {
        var y = yv(v); ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(0, y - 6); ctx.lineTo(10, y); ctx.lineTo(0, y + 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = ink; ctx.fillText(label, 14, y - 9);
      }
      marker(0, css("--trace"), "0 V");
      ctx.fillStyle = css("--trace-2");
      ctx.textAlign = "right"; ctx.fillText("1.65 V axis", w - 8, yv(1.65) - 10);
      ctx.fillStyle = ink; ctx.fillText("3.3 V", w - 8, yv(3.3) - 10);
      ctx.textAlign = "left";
    });
  }

  /* ---------- small waveform glyphs inside flowchart nodes ---------- */
  function wavePath(kind) {
    var W = 120, H = 34, pts = [], n = 60, i, x, v;
    for (i = 0; i <= n; i++) {
      x = (i / n) * W;
      var th = (i / n) * Math.PI * 4;
      v = Math.sin(th);
      if (kind === "raw") pts.push([x, 17 - v * 13]);
      else if (kind === "shift" || kind === "check" || kind === "window") pts.push([x, 17 - v * 13]);
      else if (kind === "gain") { var s = Math.max(-0.35, Math.min(0.35, v)) / 0.35; pts.push([x, 17 - s * 15]); }
      else if (kind === "digital" || kind === "fine") {
        var steps = kind === "digital" ? 7 : 22; var q = Math.round(v * steps) / steps; pts.push([x, 17 - q * 13]);
      } else pts.push([x, 17 - v * 13]);
    }
    var d = "";
    if (kind === "digital" || kind === "fine") {
      for (i = 0; i < pts.length; i++) {
        d += (i ? "L" : "M") + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1);
        if (i < pts.length - 1) d += "L" + pts[i + 1][0].toFixed(1) + " " + pts[i][1].toFixed(1);
      }
    } else {
      pts.forEach(function (p, idx) { d += (idx ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); });
    }
    return d;
  }
  document.querySelectorAll("[data-wave]").forEach(function (el) {
    var kind = el.getAttribute("data-wave");
    var extra = "";
    if (kind === "raw") extra = '<line x1="0" y1="17" x2="120" y2="17" style="stroke:var(--ink-3)" stroke-dasharray="3 3" stroke-width="1"/>';
    if (kind === "shift") extra = '<line x1="0" y1="33" x2="120" y2="33" style="stroke:var(--ink-3)" stroke-width="1"/><line x1="0" y1="17" x2="120" y2="17" style="stroke:var(--wire)" stroke-dasharray="3 3" stroke-width="1"/>';
    if (kind === "check") extra = '<line x1="0" y1="2" x2="120" y2="2" style="stroke:var(--fault)" stroke-dasharray="4 3" stroke-width="1.2"/>';
    if (kind === "window") extra = '<rect x="0" y="11" width="120" height="12" style="fill:var(--wire-soft)"/><rect x="0" y="6" width="120" height="22" style="fill:none;stroke:var(--ink-3)" stroke-dasharray="2 3" stroke-width="0.8"/>';
    el.innerHTML = '<svg viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true">' + extra +
      '<path d="' + wavePath(kind) + '" style="fill:none;stroke:var(--wire)" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
  });

  /* ---------- level shift before / after ---------- */
  document.querySelectorAll("[data-shift]").forEach(function (svg) {
    var mode = svg.getAttribute("data-shift");
    var W = 320, H = 200, top = 20, bot = 180;
    function y(v) { return mode === "raw" ? 100 - (v / 1.65) * 75 : bot - (v / 3.3) * 150 - 5; }
    var d = "", n = 120;
    for (var i = 0; i <= n; i++) {
      var x = 62 + (i / n) * 250, th = (i / n) * Math.PI * 4;
      var v = mode === "raw" ? 1.65 * Math.sin(th) : 1.65 + 1.65 * Math.sin(th);
      d += (i ? "L" : "M") + x.toFixed(1) + " " + y(v).toFixed(1);
    }
    var labels = mode === "raw" ? [[1.65, "+1.65 V"], [0, "0 V"], [-1.65, "−1.65 V"]] : [[3.3, "3.3 V"], [1.65, "1.65 V"], [0, "0 V"]];
    var axis = mode === "raw" ? 0 : 1.65;
    var g = "";
    labels.forEach(function (l) {
      var yy = y(l[0]).toFixed(1);
      g += '<line x1="62" x2="312" y1="' + yy + '" y2="' + yy + '" style="stroke:var(--screen-grid)" stroke-width="1"/>';
      g += '<text x="56" y="' + yy + '" text-anchor="end" dominant-baseline="middle" style="fill:var(--screen-ink);font:500 11px var(--f-mono)">' + l[1] + "</text>";
    });
    var ay = y(axis).toFixed(1);
    g += '<line x1="62" x2="312" y1="' + ay + '" y2="' + ay + '" style="stroke:' + (mode === "raw" ? "var(--trace)" : "var(--trace-2)") + '" stroke-dasharray="5 5" stroke-width="1.2" opacity="0.7"/>';
    if (mode === "raw") g += '<rect x="62" y="' + y(0).toFixed(1) + '" width="250" height="' + (y(-1.65) - y(0)).toFixed(1) + '" style="fill:var(--scr-fault)" opacity="0.1"/>';
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = g + '<path d="' + d + '" style="fill:none;stroke:' + (mode === "raw" ? "var(--trace)" : "var(--trace-2)") + '" stroke-width="2.2"/>';
  });

  /* ---------- auto-range lab (oscilloscope page) ---------- */
  var lab = document.getElementById("lab");
  if (lab) {
    var amp = document.getElementById("amp"), out = document.getElementById("amp-out");
    var cA = document.getElementById("plot-in"), cB = document.getElementById("plot-adc");
    var W1 = [1.35, 1.95], W2 = [0.95, 2.35], G1 = 3.3 / 0.6, G2 = 3.3 / 1.4, FS = 3.3;
    function classify(v) {
      if (v > FS || v < 0) return "fault";
      if (v >= W1[0] && v <= W1[1]) return "w1";
      if (v >= W2[0] && v <= W2[1]) return "w2";
      return "full";
    }
    function adcOut(v, c) {
      if (c === "w1") return (v - W1[0]) * G1;
      if (c === "w2") return (v - W2[0]) * G2;
      return Math.max(0, Math.min(FS, v));
    }
    function colors() { return { w1: css("--scr-w1"), w2: css("--scr-w2"), full: css("--scr-full"), fault: css("--scr-fault"), grid: css("--screen-grid"), ink: css("--screen-ink") }; }
    function frac(x, A) { return x >= A ? 1 : (2 / Math.PI) * Math.asin(x / A); }
    function setReadouts(A) {
      var f1 = frac(0.3, A), f2 = frac(0.7, A) - f1, f0 = frac(1.65, A) - frac(0.7, A), ff = 1 - frac(1.65, A);
      function pct(x) { return Math.round(Math.max(0, x) * 100) + "%"; }
      document.getElementById("ro-w1").textContent = pct(f1);
      document.getElementById("ro-w2").textContent = pct(f2);
      document.getElementById("ro-full").textContent = pct(f0);
      document.getElementById("ro-fault").textContent = pct(ff);
      var codes = Math.min(4096, Math.round((2 * Math.min(A, 1.65) / FS) * 4096));
      var note = document.getElementById("ro-note");
      if (note) note.textContent = A <= 0.3
        ? "This whole signal fits in window 1, so every sample is amplified 5.5×. Read directly (version 2), the same signal would span only about " + codes + " of the ADC's 4,096 codes."
        : A <= 0.7 ? "Samples near the 1.65 V axis use window 1 (5.5×), the rest use window 2 (2.36×). Read directly, this signal would span about " + codes + " of 4,096 codes."
        : A <= 1.65 ? "The peaks leave both windows, so those samples are read at 1× while the middle of each swing still gets amplified."
        : "Part of this signal is beyond ±1.65 V. The over-voltage comparator disables the mux, and the clipped samples are flagged.";
    }
    function axes(ctx, w, h, y, ticks, col) {
      ctx.strokeStyle = col.grid; ctx.lineWidth = 1; ctx.font = "500 10px " + css("--f-mono"); ctx.fillStyle = col.ink; ctx.textBaseline = "middle"; ctx.textAlign = "right";
      ticks.forEach(function (t) { var yy = Math.round(y(t[0])) + 0.5; ctx.beginPath(); ctx.moveTo(44, yy); ctx.lineTo(w - 6, yy); ctx.stroke(); ctx.fillText(t[1], 40, yy); });
    }
    function drawSeg(ctx, pts, col) {
      var cur = null;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (p.c !== cur) {
          if (cur) ctx.stroke();
          cur = p.c; ctx.strokeStyle = col[cur]; ctx.lineWidth = 2.2; ctx.beginPath();
          var prev = pts[i - 1]; ctx.moveTo(prev ? prev.x : p.x, prev ? prev.y : p.y);
        }
        ctx.lineTo(p.x, p.y);
      }
      if (cur) ctx.stroke();
    }
    var phase = 0;
    function draw(t) {
      var A = parseFloat(amp.value); phase = t * 0.9;
      var col = colors();
      // plot A: level-shifted input with windows
      var a = fitCanvas(cA), ctx = a.ctx, w = a.w, h = a.h;
      ctx.clearRect(0, 0, w, h);
      var vmin = -0.45, vmax = 3.75;
      function ya(v) { return 10 + (vmax - v) / (vmax - vmin) * (h - 20); }
      ctx.fillStyle = col.fault; ctx.globalAlpha = 0.1;
      ctx.fillRect(44, ya(vmax), w - 50, ya(3.3) - ya(vmax)); ctx.fillRect(44, ya(0), w - 50, ya(vmin) - ya(0));
      ctx.globalAlpha = 0.16; ctx.fillStyle = col.w2; ctx.fillRect(44, ya(W2[1]), w - 50, ya(W2[0]) - ya(W2[1]));
      ctx.globalAlpha = 0.22; ctx.fillStyle = col.w1; ctx.fillRect(44, ya(W1[1]), w - 50, ya(W1[0]) - ya(W1[1]));
      ctx.globalAlpha = 1;
      axes(ctx, w, h, ya, [[3.3, "3.3"], [2.35, "2.35"], [1.95, "1.95"], [1.65, "1.65"], [1.35, "1.35"], [0.95, "0.95"], [0, "0 V"]], col);
      var n = 360, ptsA = [], ptsB = [], samples = [];
      for (var i = 0; i <= n; i++) {
        var x = 44 + (i / n) * (w - 50), th = (i / n) * Math.PI * 2.5 - phase;
        var v = 1.65 + A * Math.sin(th), c = classify(v);
        ptsA.push({ x: x, y: ya(Math.max(vmin, Math.min(vmax, v))), c: c });
        ptsB.push({ v: v, c: c, x: x });
        if (i % 9 === 0) samples.push({ x: x, v: v, c: c });
      }
      drawSeg(ctx, ptsA, col);
      // reconstructed samples
      ctx.fillStyle = col.ink;
      samples.forEach(function (s) {
        if (s.c === "fault") return;
        var o = adcOut(s.v, s.c), lo = s.c === "w1" ? W1[0] : s.c === "w2" ? W2[0] : 0, g = s.c === "w1" ? G1 : s.c === "w2" ? G2 : 1;
        var rec = o / g + lo; ctx.beginPath(); ctx.arc(s.x, ya(rec), 2.4, 0, Math.PI * 2); ctx.fill();
      });
      // plot B: what the ADC sees
      var b = fitCanvas(cB); ctx = b.ctx; w = b.w; h = b.h;
      ctx.clearRect(0, 0, w, h);
      function yb(v) { return 12 + (3.45 - v) / 3.6 * (h - 24); }
      axes(ctx, w, h, yb, [[3.3, "3.3"], [1.65, "1.65"], [0, "0 V"]], col);
      var pb = ptsB.map(function (p) { var x = 44 + ((p.x - 44) / (a.w - 50)) * (w - 50); return { x: x, y: yb(adcOut(p.v, p.c)), c: p.c }; });
      // draw with breaks where band changes (gain switching jumps)
      var cur = null;
      for (var k = 0; k < pb.length; k++) {
        var p = pb[k];
        if (p.c !== cur) { if (cur) ctx.stroke(); cur = p.c; ctx.strokeStyle = col[cur]; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(p.x, p.y); }
        else ctx.lineTo(p.x, p.y);
      }
      if (cur) ctx.stroke();
      ctx.fillStyle = col.ink; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.font = "500 10px " + css("--f-mono");
      ctx.fillText("ADC full scale", w - 8, yb(3.3) - 5);
    }
    function sync() { out.textContent = "±" + parseFloat(amp.value).toFixed(2) + " V"; setReadouts(parseFloat(amp.value)); }
    amp.addEventListener("input", function () {
      sync();
      lab.querySelectorAll(".presets button").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-amp") === amp.value ? "true" : "false"); });
      if (reduceMotion) draw(0.6);
    });
    lab.querySelectorAll(".presets button").forEach(function (b) {
      b.addEventListener("click", function () { amp.value = b.getAttribute("data-amp"); amp.dispatchEvent(new Event("input")); });
    });
    sync();
    animate(lab, draw);
  }
})();
