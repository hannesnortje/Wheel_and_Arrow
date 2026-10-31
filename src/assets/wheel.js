/* Wheel of Life – interactive tool (part of The Wheel and the Arrow app).
   Data: localStorage "wheel_of_life_v1" – the same key and shape as the original page:
     { name, date, scores: [6 numbers] }
   The original stored `scores` by POSITION in its own drawing order
   (Society, Family, Work, Body, Mind, Ethics). We keep writing that array in exactly that
   order (so old and new files stay interchangeable) and add `byArea` { ethics: n, … } keyed by
   the stable area ids. On load `byArea` wins; without it, `scores` is mapped by LEGACY_ORDER.
   Tutorial "don't show again": localStorage "index_tut_skip_v1" (as in the original). */
(function () {
  'use strict';
  var T = window.T || {};
  var AREAS = T._areas || [];                 // [[id, name, description], …] booklet order
  var IDS = AREAS.map(function (a) { return a[0]; });
  var LEGACY_ORDER = ['society', 'family', 'work', 'body', 'mind', 'ethics'];
  var KEY = 'wheel_of_life_v1', TUT_KEY = 'index_tut_skip_v1';
  var STEPS = 10, HUB = 0.18;                 // hub radius as a share of the rim (original 42/232)
  var NS = 'http://www.w3.org/2000/svg';
  var LOCALE = { en: 'en-GB', de: 'de-DE', af: 'af-ZA' }[T._lang] || T._lang || 'en';

  var $ = function (id) { return document.getElementById(id); };
  var nameIn = $('wName'), dateIn = $('wDate'), host = $('wWheel'), controls = $('wControls');
  var scores = {};
  IDS.forEach(function (id) { scores[id] = 5; });
  var selected = -1;

  function fmt(s, map) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return k in map ? map[k] : m; }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clampScore(v) {
    var n = Math.round(Number(v));
    return isFinite(n) ? Math.max(1, Math.min(STEPS, n)) : null;
  }

  // ------------------------------------------------------------ data (migration-aware)
  /* Accepts data shaped like the original page's saves/exports ({name, date, scores:[…]},
     exports also carry schemaVersion: 1) and our own ({…, byArea:{id:n}}). Returns a score map. */
  function scoresFrom(data) {
    var out = {}, any = false;
    if (data && data.byArea && typeof data.byArea === 'object') {
      IDS.forEach(function (id) { var v = clampScore(data.byArea[id]); if (v !== null) { out[id] = v; any = true; } });
    }
    if (data && Array.isArray(data.scores)) {
      LEGACY_ORDER.forEach(function (id, i) {
        if (out[id] !== undefined || i >= data.scores.length) return;
        var v = clampScore(data.scores[i]); if (v !== null) { out[id] = v; any = true; }
      });
    }
    return any ? out : null;
  }
  function apply(data) {
    if (!data || typeof data !== 'object') return false;
    var s = scoresFrom(data);
    if (typeof data.name === 'string') nameIn.value = data.name;
    if (typeof data.date === 'string') dateIn.value = data.date;
    if (s) IDS.forEach(function (id) { if (s[id] !== undefined) scores[id] = s[id]; });
    return !!s || typeof data.name === 'string' || typeof data.date === 'string';
  }
  function snapshot() {
    var by = {};
    IDS.forEach(function (id) { by[id] = scores[id]; });
    return { name: nameIn.value, date: dateIn.value, scores: LEGACY_ORDER.map(function (id) { return scores[id]; }), byArea: by };
  }

  var savedTimer;
  function status(msg, ms) {
    var n = $('wSaved'); n.textContent = msg;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { n.textContent = T.saved_idle; }, ms || 1200);
  }
  function save(quiet) {
    try { localStorage.setItem(KEY, JSON.stringify(snapshot())); if (!quiet) status(T.saved); } catch (e) {}
  }
  function load() {
    try { var r = localStorage.getItem(KEY); if (r) apply(JSON.parse(r)); } catch (e) {}
  }

  // ------------------------------------------------------------ layout (shared by screen + PNG)
  var mctx = document.createElement('canvas').getContext('2d');
  function measurer(font) { return function (s) { mctx.font = font; return mctx.measureText(s).width; }; }
  function nameLines(name) {
    var p = name.split(' & ');
    return p.length === 2 ? [p[0] + ' &', p[1]] : [name];
  }
  function angleOf(i) { return -Math.PI / 2 + i * 2 * Math.PI / AREAS.length; }

  /* Wheel radius R, centre and label boxes for a drawing W px wide with fs px labels.
     Labels sit outside the rim; if a label would leave the drawing it is pulled inwards and then
     pushed up/down until it clears the circle. The largest R whose drawing stays roughly square wins. */
  function layout(W, fs, measure, measureScore) {
    var pad = 6, gap = Math.round(fs * .6), lh = Math.round(fs * 1.25);
    var info = AREAS.map(function (a, i) {
      var lines = nameLines(a[1]);
      // the labels straight above/below the wheel stay on one line when there is room
      if (Math.abs(Math.cos(angleOf(i))) < .25 && measure(a[1]) + measureScore(' 10') + 4 <= W * .62) lines = [a[1]];
      var w = 0;
      lines.forEach(function (l, j) { w = Math.max(w, measure(l) + (j === lines.length - 1 ? measureScore(' 10') + 4 : 0)); });
      return { lines: lines, w: Math.ceil(w), h: lines.length * lh };
    });
    function place(R) {
      var boxes = info.map(function (b, i) {
        var a = angleOf(i), ux = Math.cos(a), uy = Math.sin(a);
        var px = W / 2 + (R + gap) * ux, py = (R + gap) * uy;
        var x0 = ux > .25 ? px : ux < -.25 ? px - b.w : px - b.w / 2;
        var y0 = uy < -.25 ? py - b.h : uy > .25 ? py : py - b.h / 2;
        x0 = Math.max(pad, Math.min(W - pad - b.w, x0));
        var dir = uy < -.05 ? -1 : 1, guard = 0;
        while (guard++ < 400) {
          var qx = Math.max(x0, Math.min(W / 2, x0 + b.w)), qy = Math.max(y0, Math.min(0, y0 + b.h));
          if (Math.hypot(qx - W / 2, qy) >= R + gap * .6) break;
          y0 += dir * 2;
        }
        return { x0: x0, y0: y0, w: b.w, h: b.h, ux: ux, uy: uy, dir: dir };
      });
      // the labels straight above/below move further out if they touch a neighbour
      boxes.forEach(function (b, i) {
        if (Math.abs(b.ux) > .25) return;
        var guard = 0;
        while (guard++ < 200 && boxes.some(function (o, j) {
          return j !== i && o.x0 < b.x0 + b.w + 6 && b.x0 < o.x0 + o.w + 6 && o.y0 < b.y0 + b.h + 2 && b.y0 < o.y0 + o.h + 2;
        })) b.y0 += b.dir * 2;
      });
      var minY = -R, maxY = R;
      boxes.forEach(function (b) { minY = Math.min(minY, b.y0); maxY = Math.max(maxY, b.y0 + b.h); });
      minY -= pad; maxY += pad;
      var cy = -minY;
      boxes.forEach(function (b) { b.y0 += cy; });
      return { W: W, H: Math.ceil(maxY - minY), R: R, cx: W / 2, cy: cy, hub: R * HUB, fs: fs, lh: lh, boxes: boxes, info: info };
    }
    var Rmax = Math.min(W / 2 - pad, 215), Rmin = W * .22, L = null;
    for (var R = Rmax; R >= Rmin; R -= 2) {
      L = place(R);
      if (L.H <= W * (W < 480 ? 1.3 : 1.12)) break;
    }
    return L;
  }
  function scoreR(L, s) { return L.hub + (s / STEPS) * (L.R - L.hub); }
  function pt(L, a, r) { return [L.cx + r * Math.cos(a), L.cy + r * Math.sin(a)]; }
  function wedgePath(L, i, r) {
    var c = angleOf(i), h = Math.PI / AREAS.length;
    var p1 = pt(L, c - h, r), p2 = pt(L, c + h, r);
    return 'M' + L.cx.toFixed(1) + ' ' + L.cy.toFixed(1) + 'L' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) +
      'A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + 'Z';
  }
  function labelX(b) { return b.ux > .25 ? b.x0 : b.ux < -.25 ? b.x0 + b.w : b.x0 + b.w / 2; }
  function labelAnchor(b) { return b.ux > .25 ? 'start' : b.ux < -.25 ? 'end' : 'middle'; }

  // ------------------------------------------------------------ screen drawing (SVG)
  var L = null, svg = null, plotG = null, lastW = 0;
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function render() {
    var W = Math.floor(host.clientWidth);
    if (!W) return;
    lastW = W;
    var fs = W < 420 ? 14 : 15;
    L = layout(W, fs, measurer('600 ' + fs + 'px Inter, sans-serif'), measurer('700 ' + fs + 'px Inter, sans-serif'));
    host.innerHTML = '';
    svg = el('svg', { viewBox: '0 0 ' + L.W + ' ' + L.H, width: L.W, height: L.H, role: 'img', class: 'w-svg' }, host);
    var labs = el('g', { class: 'w-labs' }, svg);   // under the wedges: where a label's tap area meets the rim, the wedge wins
    var segs = el('g', { class: 'w-segs' }, svg);
    AREAS.forEach(function (a, i) {
      el('path', { d: wedgePath(L, i, L.R), class: 'w-seg w-seg-' + i + (i === selected ? ' sel' : ''), 'data-i': i }, segs);
    });
    var deco = el('g', { class: 'w-deco', 'pointer-events': 'none' }, svg);
    for (var s = 1; s <= STEPS; s++) el('circle', { cx: L.cx, cy: L.cy, r: scoreR(L, s).toFixed(1), class: 'w-ring' + (s === 5 ? ' mid' : '') }, deco);
    AREAS.forEach(function (a, i) {
      var p = pt(L, angleOf(i) - Math.PI / AREAS.length, L.R);
      el('line', { x1: L.cx, y1: L.cy, x2: p[0].toFixed(1), y2: p[1].toFixed(1), class: 'w-spoke' }, deco);
    });
    el('circle', { cx: L.cx, cy: L.cy, r: L.hub.toFixed(1), class: 'w-hub' }, deco);
    if (selected >= 0) el('path', { d: wedgePath(L, selected, L.R), class: 'w-selring' }, deco);
    plotG = el('g', { class: 'w-plot', 'pointer-events': 'none' }, svg);
    L.boxes.forEach(function (b, i) {
      var g = el('g', { class: 'w-lab' + (i === selected ? ' sel' : ''), 'data-i': i, tabindex: 0, role: 'button', 'aria-label': AREAS[i][1] }, labs);
      var hy = Math.max(0, (44 - b.h) / 2);
      el('rect', { x: b.x0 - 4, y: b.y0 - hy, width: b.w + 8, height: b.h + 2 * hy, class: 'w-hit' }, g);
      var t = el('text', { x: labelX(b), y: b.y0 + L.fs, 'text-anchor': labelAnchor(b), 'font-size': L.fs }, g);
      var lines = L.info[i].lines;
      lines.forEach(function (line, j) {
        var ts = el('tspan', { x: labelX(b), dy: j ? L.lh : 0 }, t);
        ts.textContent = line;
        if (j === lines.length - 1) {
          var sc = el('tspan', { class: 'w-labscore', dx: 4 }, t);
          sc.textContent = scores[IDS[i]];
        }
      });
    });
    drawPlot();
  }
  function drawPlot() {
    if (!plotG) return;
    plotG.innerHTML = '';
    var pts = IDS.map(function (id, i) { return pt(L, angleOf(i), scoreR(L, scores[id])); });
    el('polygon', { points: pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '), class: 'w-poly' }, plotG);
    pts.forEach(function (p) { el('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: L.W < 420 ? 5.5 : 6.5, class: 'w-pt' }, plotG); });
    svg.querySelectorAll('.w-labscore').forEach(function (n, i) { n.textContent = scores[IDS[i]]; });
    svg.setAttribute('aria-label', fmt(T.wheel_label, { list: AREAS.map(function (a) { return a[1] + ' ' + scores[a[0]] + T.out_of; }).join(', ') }));
  }

  // ------------------------------------------------------------ controls
  function buildControls() {
    controls.innerHTML = '';
    AREAS.forEach(function (a, i) {
      var id = a[0];
      var row = document.createElement('div');
      row.className = 'w-ctl'; row.dataset.i = i;
      row.innerHTML =
        '<div class="w-ctl-top"><label class="w-ctl-name" for="wR' + i + '"><span class="w-swatch w-sw-' + i + '" aria-hidden="true"></span>' + esc(a[1]) + '</label>' +
        '<output class="w-val" for="wR' + i + '"></output></div>' +
        '<div class="w-ctl-row"><button type="button" class="tbtn ghost icon w-step" data-d="-1" aria-label="' + esc(fmt(T.minus, { area: a[1] })) + '">−</button>' +
        '<input type="range" id="wR' + i + '" min="1" max="10" step="1">' +
        '<button type="button" class="tbtn ghost icon w-step" data-d="1" aria-label="' + esc(fmt(T.plus, { area: a[1] })) + '">+</button></div>';
      var rng = row.querySelector('input');
      rng.addEventListener('input', function () { setScore(i, +rng.value, true); });
      rng.addEventListener('focus', function () { select(i); });
      row.querySelectorAll('.w-step').forEach(function (b) {
        b.addEventListener('click', function () { setScore(i, scores[id] + +b.dataset.d); select(i); });
      });
      controls.appendChild(row);
    });
    syncControls();
  }
  function syncControls() {
    controls.querySelectorAll('.w-ctl').forEach(function (row, i) {
      var v = scores[IDS[i]];
      row.querySelector('input').value = v;
      row.querySelector('output').textContent = v + T.out_of;
      row.querySelectorAll('.w-step')[0].disabled = v <= 1;
      row.querySelectorAll('.w-step')[1].disabled = v >= STEPS;
      row.classList.toggle('sel', i === selected);
    });
    var list = $('wPrintList');
    list.innerHTML = AREAS.map(function (a) { return '<li><span>' + esc(a[1]) + '</span><b>' + scores[a[0]] + T.out_of + '</b></li>'; }).join('');
    var meta = [nameIn.value.trim(), dateIn.value.trim()].filter(Boolean).join(' · ');
    $('wPrintMeta').textContent = meta;
    showInfo();
  }
  function setScore(i, v, fromSlider) {
    var c = clampScore(v);
    if (c === null) return;
    scores[IDS[i]] = c;
    if (fromSlider) {
      var row = controls.children[i];
      row.querySelector('output').textContent = c + T.out_of;
    }
    syncControls(); drawPlot(); save();
  }
  function select(i) {
    if (i === selected) return;
    selected = i;
    render(); syncControls();
  }
  function showInfo() {
    var box = $('wInfo');
    if (selected < 0) { box.innerHTML = '<p class="hint">' + esc(T.pick_hint) + '</p>'; return; }
    var a = AREAS[selected];
    box.innerHTML = '<p class="w-info-h"><span class="w-swatch w-sw-' + selected + '" aria-hidden="true"></span>' + esc(a[1]) +
      ' <b>' + scores[a[0]] + T.out_of + '</b></p><p class="w-info-d">' + esc(a[2] || '') + '</p>';
  }

  // tap on the wheel: the wedge sets the area, the distance from the centre sets the score
  host.addEventListener('click', function (e) {
    if (!svg || !L) return;
    var lab = e.target.closest && e.target.closest('.w-lab');
    if (lab) { select(+lab.dataset.i); return; }
    var r = svg.getBoundingClientRect();
    var x = (e.clientX - r.left) * (L.W / r.width) - L.cx, y = (e.clientY - r.top) * (L.H / r.height) - L.cy;
    var d = Math.hypot(x, y);
    if (d > L.R + 4) return;
    var n = AREAS.length, a = Math.atan2(y, x) + Math.PI / 2;
    var i = ((Math.round(a / (2 * Math.PI / n)) % n) + n) % n;
    var s = Math.round((d - L.hub) / (L.R - L.hub) * STEPS);
    selected = i;
    scores[IDS[i]] = Math.max(1, Math.min(STEPS, s));
    render(); syncControls(); save();
  });
  host.addEventListener('keydown', function (e) {
    var lab = e.target.closest && e.target.closest('.w-lab');
    if (lab && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(+lab.dataset.i); var r = $('wR' + lab.dataset.i); if (r) r.focus(); }
  });

  // ------------------------------------------------------------ PNG (light background, localized)
  var PNG_COLORS = ['#16465a', '#21607a', '#2e7a93', '#4a95aa', '#74b0c0', '#a3cbd5'];
  function fileBase() {
    var n = nameIn.value.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');
    return (n ? n + '_' : '') + (T.file_base || 'Wheel_of_Life');
  }
  function download(blob, file) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function makePng(cb) {
    var W = 760, fs = 21, scale = 2, side = 44;
    var lab = '600 ' + fs + 'px Inter, sans-serif', labB = '700 ' + fs + 'px Inter, sans-serif';
    var P = layout(W, fs, measurer(lab), measurer(labB));
    var name = nameIn.value.trim(), date = dateIn.value.trim();
    var top = 96, bottom = 30;
    var c = document.createElement('canvas');
    c.width = (W + side * 2) * scale; c.height = (P.H + top + bottom) * scale;
    var x = c.getContext('2d');
    x.scale(scale, scale);
    x.fillStyle = '#fffdf9'; x.fillRect(0, 0, W + side * 2, P.H + top + bottom);
    x.fillStyle = '#1d2a31'; x.font = '600 30px Literata, Georgia, serif'; x.textBaseline = 'alphabetic';
    x.fillText(T.png_title, side, 52);
    if (name || date) {
      x.font = '400 18px Inter, sans-serif'; x.fillStyle = '#4d5b62';
      x.fillText([name, date].filter(Boolean).join('  ·  '), side, 80);
    }
    x.translate(side, top);
    AREAS.forEach(function (a, i) {
      x.fillStyle = PNG_COLORS[i]; x.fill(new Path2D(wedgePath(P, i, P.R)));
    });
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1;
    for (var s = 1; s <= STEPS; s++) { x.beginPath(); x.arc(P.cx, P.cy, scoreR(P, s), 0, 2 * Math.PI); x.stroke(); }
    x.strokeStyle = '#ffffff'; x.lineWidth = 2;
    AREAS.forEach(function (a, i) {
      var p = pt(P, angleOf(i) - Math.PI / AREAS.length, P.R);
      x.beginPath(); x.moveTo(P.cx, P.cy); x.lineTo(p[0], p[1]); x.stroke();
    });
    x.fillStyle = '#fffdf9'; x.beginPath(); x.arc(P.cx, P.cy, P.hub, 0, 2 * Math.PI); x.fill();
    var pts = IDS.map(function (id, i) { return pt(P, angleOf(i), scoreR(P, scores[id])); });
    x.beginPath(); pts.forEach(function (p, i) { i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }); x.closePath();
    x.fillStyle = 'rgba(181,72,46,.30)'; x.fill();
    x.strokeStyle = '#b5482e'; x.lineWidth = 3.5; x.lineJoin = 'round'; x.stroke();
    pts.forEach(function (p) {
      x.beginPath(); x.arc(p[0], p[1], 7, 0, 2 * Math.PI); x.fillStyle = '#b5482e'; x.fill();
      x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.stroke();
    });
    P.boxes.forEach(function (b, i) {
      var lines = P.info[i].lines, anchor = labelAnchor(b), lx = labelX(b);
      lines.forEach(function (line, j) {
        var y = b.y0 + P.fs + j * P.lh, last = j === lines.length - 1;
        var sc = ' ' + scores[IDS[i]];
        x.font = lab; var wl = x.measureText(line).width;
        x.font = labB; var ws = last ? x.measureText(sc).width + 4 : 0;
        var start = anchor === 'start' ? lx : anchor === 'end' ? lx - wl - ws : lx - (wl + ws) / 2;
        if (anchor === 'middle' && !last) start = lx - wl / 2;
        x.textAlign = 'left';
        x.font = lab; x.fillStyle = '#1d2a31'; x.fillText(line, start, y);
        if (last) { x.font = labB; x.fillStyle = '#b5482e'; x.fillText(sc, start + wl + 4, y); }
      });
    });
    c.toBlob(cb, 'image/png');
  }
  function pngClick() {
    var go = function () { makePng(function (b) { if (b) download(b, fileBase() + '.png'); }); };
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('600 21px Inter'), document.fonts.load('700 21px Inter'), document.fonts.load('600 30px Literata'), document.fonts.load('400 18px Inter')])
        .then(go, go);
    } else go();
  }

  // ------------------------------------------------------------ export / import
  function exportJSON() {
    var d = snapshot();
    var out = { schemaVersion: 1, name: d.name, date: d.date, scores: d.scores, byArea: d.byArea };
    download(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), fileBase() + '.json');
  }
  function importJSON(ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        if (!data || typeof data !== 'object' || !(scoresFrom(data) || 'name' in data || 'date' in data)) throw new Error('shape');
        apply(data);
        render(); syncControls(); save(true); status(T.imported, 2000);
      } catch (e) { alert(T.bad_file); }
    };
    r.readAsText(f);
    ev.target.value = '';
  }

  // ------------------------------------------------------------ tutorial
  var tutIdx = 0, tutLastFocus = null;
  var SLIDES = (T.tut || []).map(function (s) {
    var map = {};
    AREAS.forEach(function (a) { map[a[0]] = esc(a[1]); });
    return [s[0], fmt(s[1], map)];
  });
  function renderTut() {
    var s = SLIDES[tutIdx];
    $('wTutTitle').textContent = s[0];
    $('wTutBody').innerHTML = s[1];
    $('wTutDots').innerHTML = SLIDES.map(function (_, i) { return '<span class="' + (i === tutIdx ? 'on' : '') + '"></span>'; }).join('');
    $('wTutPrev').style.visibility = tutIdx === 0 ? 'hidden' : 'visible';
    $('wTutNext').textContent = tutIdx === SLIDES.length - 1 ? T.tut_done : T.tut_next;
  }
  function openTut(i) {
    if (!SLIDES.length) return;
    tutIdx = i || 0; tutLastFocus = document.activeElement;
    try { $('wTutDont').checked = !!localStorage.getItem(TUT_KEY); } catch (e) {}
    renderTut(); $('wTutModal').hidden = false;
    document.documentElement.classList.add('no-scroll');
    $('wTutNext').focus();
  }
  function closeTut() {
    $('wTutModal').hidden = true;
    document.documentElement.classList.remove('no-scroll');
    try {
      if ($('wTutDont').checked) localStorage.setItem(TUT_KEY, 'true'); else localStorage.removeItem(TUT_KEY);
    } catch (e) {}
    if (tutLastFocus && tutLastFocus.focus) tutLastFocus.focus();
  }
  $('wTutNext').addEventListener('click', function () { if (tutIdx < SLIDES.length - 1) { tutIdx++; renderTut(); } else closeTut(); });
  $('wTutPrev').addEventListener('click', function () { if (tutIdx > 0) { tutIdx--; renderTut(); } });
  $('wTutX').addEventListener('click', closeTut);
  $('wTutModal').addEventListener('click', function (e) { if (e.target === this) closeTut(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('wTutModal').hidden) closeTut(); });

  // ------------------------------------------------------------ buttons
  $('wPng').addEventListener('click', pngClick);
  $('wPrint').addEventListener('click', function () { syncControls(); window.print(); });
  $('wTut').addEventListener('click', function () { openTut(0); });
  $('wExport').addEventListener('click', exportJSON);
  $('wImport').addEventListener('click', function () { $('wFile').click(); });
  $('wFile').addEventListener('change', importJSON);
  $('wSample').addEventListener('click', function () {
    var sample = [7, 6, 8, 4, 7, 5];             // the original sample, in its LEGACY_ORDER positions
    LEGACY_ORDER.forEach(function (id, i) { scores[id] = sample[i]; });
    if (!nameIn.value.trim()) nameIn.value = T.sample_name;
    render(); syncControls(); save(true); status(T.sample_loaded, 3000);
  });
  $('wClear').addEventListener('click', function () {
    if (!confirm(T.confirm_clear)) return;
    IDS.forEach(function (id) { scores[id] = 5; });
    nameIn.value = ''; dateIn.value = today(); selected = -1;
    render(); syncControls(); save();
  });
  nameIn.addEventListener('input', function () { save(); syncControls(); });
  dateIn.addEventListener('input', function () { save(); syncControls(); });
  window.addEventListener('beforeprint', syncControls);

  function today() {
    try { return new Date().toLocaleDateString(LOCALE); } catch (e) { return new Date().toLocaleDateString(); }
  }

  // ------------------------------------------------------------ init
  load();
  if (!dateIn.value) dateIn.value = today();
  buildControls();
  render();
  if (window.ResizeObserver) new ResizeObserver(function () { if (Math.floor(host.clientWidth) !== lastW) render(); }).observe(host);
  else window.addEventListener('resize', render);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  try { if (!localStorage.getItem(TUT_KEY)) setTimeout(function () { openTut(0); }, 400); } catch (e) {}

  // test hook (used by the automated checks; harmless otherwise)
  window.__wheel = { scoresFrom: scoresFrom, snapshot: snapshot, LEGACY_ORDER: LEGACY_ORDER };
})();
