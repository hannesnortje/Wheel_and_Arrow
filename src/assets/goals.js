/* Goal Planning Worksheet – several goals, grouped by life area; fills the localized AcroForm PDF.
   Data: localStorage "goals_worksheet_v1" = { goals: [ {id, name, life_area, started, …, action_N, due_N,
   reviewed_N, done_N, archived} ], activeGoalId } – the same shape as the original page.
   life_area holds a stable area id (ethics, mind, society, body, family, work); old English names are
   mapped on load and on import. Tutorial "don't show again": "goals_tut_skip_v1". */
(function () {
  'use strict';
  var T = window.T || {}, L = T.ex || {};
  var LANG = T._lang || 'en';
  var ROOT = (window.APP && window.APP.root) || '../';
  var KEY = 'goals_worksheet_v1', TUT_KEY = 'goals_tut_skip_v1';
  var ROWS = 15;
  var AREA_IDS = (T._areas || []).map(function (a) { return a[0]; });
  var AREA_NAME = {};
  (T._areas || []).forEach(function (a) { AREA_NAME[a[0]] = a[1]; });
  var ALIAS = T._area_alias || {};
  var LOCALE = { en: 'en-GB', de: 'de-DE', af: 'af-ZA' }[LANG] || LANG;

  var $ = function (id) { return document.getElementById(id); };
  var form = $('gForm');
  var fields = function () { return form.querySelectorAll('[data-field]'); };
  var state = { goals: [], activeGoalId: '' };
  var tab = 'active';
  var shownRows = 3;

  function fmt(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function todayISO() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function active() { return state.goals.find(function (g) { return g.id === state.activeGoalId; }); }

  // ------------------------------------------------------------ data
  function blankGoal() {
    var g = { id: 'goal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), name: '', life_area: '',
      started: todayISO(), target_date: '', achieved_on: '', the_goal: '', why_matters: '', obstacles: '', handling: '',
      who_should_know: '', track_progress: '', worth_value_yes: false, worth_value_no: false, worth_cost_yes: false,
      worth_cost_no: false, worth_cost_later: false, reminders: '', picture_success: '', archived: false };
    for (var i = 1; i <= ROWS; i++) { g['action_' + i] = ''; g['due_' + i] = ''; g['reviewed_' + i] = ''; g['done_' + i] = false; }
    return g;
  }
  function areaId(v) {
    if (!v) return '';
    if (AREA_IDS.indexOf(v) > -1) return v;
    var s = String(v).trim();
    if (ALIAS[s]) return ALIAS[s];
    var low = s.toLowerCase();
    for (var k in ALIAS) if (k.toLowerCase() === low) return ALIAS[k];
    return s;   // unknown text: keep it rather than lose it
  }
  // accepts the current shape, and the original single-goal shape (fields at top level)
  function normalize(data) {
    if (!data || typeof data !== 'object') return null;
    if (!Array.isArray(data.goals)) {
      if (Array.isArray(data)) return null;
      var m = Object.assign({}, data); m.id = m.id || 'migrated_' + Date.now();
      data = { goals: [m], activeGoalId: m.id };
    }
    data.goals = data.goals.filter(function (g) { return g && typeof g === 'object'; });
    data.goals.forEach(function (g, i) {
      if (!g.id) g.id = 'goal_' + Date.now() + '_' + i;
      if (typeof g.archived === 'undefined') g.archived = false;
      g.life_area = areaId(g.life_area);
    });
    return data;
  }
  function ensureGoal() {
    if (!state.goals.length) { var b = blankGoal(); state.goals.push(b); state.activeGoalId = b.id; }
    if (!active()) state.activeGoalId = state.goals[0].id;
  }
  function load() {
    var had = false;
    try {
      var d = normalize(JSON.parse(localStorage.getItem(KEY) || 'null'));
      if (d) { state = d; had = true; }
    } catch (e) {}
    ensureGoal();
    return had;
  }

  // ------------------------------------------------------------ action steps
  var stepsHost = $('gSteps');
  for (var i = 1; i <= ROWS; i++) {
    var li = document.createElement('li');
    li.className = 'g-step';
    li.innerHTML = '<span class="n" aria-hidden="true">' + i + '</span>' +
      '<input class="a" type="text" data-field="action_' + i + '" placeholder="' + esc(fmt(T.step_ph, { n: i })) + '" aria-label="' + esc(L.step + ' ' + i) + '">' +
      '<label class="d"><span class="lt">' + esc(L.due) + '</span><input type="date" data-field="due_' + i + '" aria-label="' + esc(L.due + ' ' + i) + '"></label>' +
      '<label class="r"><span class="lt">' + esc(L.rev) + '</span><input type="date" data-field="reviewed_' + i + '" aria-label="' + esc(L.rev + ' ' + i) + '"></label>' +
      '<label class="x g-check"><input type="checkbox" data-field="done_' + i + '" aria-label="' + esc(L.done + ' ' + i) + '"><span>' + esc(L.done) + '</span></label>';
    stepsHost.appendChild(li);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lastFilledRow(g) {
    var last = 0;
    for (var i = 1; i <= ROWS; i++) if (g['action_' + i] || g['due_' + i] || g['reviewed_' + i] || g['done_' + i]) last = i;
    return last;
  }
  function showRows(n) {
    shownRows = Math.max(1, Math.min(ROWS, n));
    stepsHost.querySelectorAll('.g-step').forEach(function (li, k) { li.hidden = k >= shownRows; });
    $('gAddStep').hidden = shownRows >= ROWS;
  }

  // ------------------------------------------------------------ form <-> goal
  var areaSel = form.querySelector('[data-field="life_area"]');
  function populate(g) {
    // an unknown area text from an old file gets its own option so it isn't lost
    var known = Array.prototype.some.call(areaSel.options, function (o) { return o.value === g.life_area; });
    areaSel.querySelectorAll('option[data-extra]').forEach(function (o) { o.remove(); });
    if (g.life_area && !known) { var o = new Option(g.life_area, g.life_area); o.setAttribute('data-extra', ''); areaSel.add(o); }
    fields().forEach(function (el) {
      var v = g[el.getAttribute('data-field')];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
    });
    showRows(Math.max(3, lastFilledRow(g) + 1));
    $('gArchBanner').hidden = !g.archived;
    $('gArchBtn').hidden = !!g.archived;
    $('gRestBtn').hidden = !g.archived;
    status('');
    renderCurrent();
  }
  function readForm() {
    var g = active(); if (!g) return;
    fields().forEach(function (el) {
      var k = el.getAttribute('data-field');
      g[k] = el.type === 'checkbox' ? el.checked : el.value;
    });
  }
  var savedT;
  function flashSaved() {
    var n = $('gSaved'); n.textContent = T.saved;
    clearTimeout(savedT); savedT = setTimeout(function () { n.textContent = T.autosave; }, 1200);
  }
  function onEdit(e) {
    if (!e.target.hasAttribute || !e.target.hasAttribute('data-field')) return;
    var el = e.target;
    // the Yes/No boxes of each "Worth it?" question behave like one choice (they stay PDF checkboxes)
    if (el.type === 'checkbox' && el.checked) {
      var fs = el.closest('.g-wq');
      if (fs) fs.querySelectorAll('input[type=checkbox]').forEach(function (o) { if (o !== el) o.checked = false; });
    }
    readForm(); save(); flashSaved();
    if (/^(name|the_goal|life_area|target_date)$/.test(el.getAttribute('data-field'))) renderList();
  }
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);
  $('gAddStep').addEventListener('click', function () {
    showRows(shownRows + 1);
    var inp = stepsHost.children[shownRows - 1].querySelector('input');
    if (inp) inp.focus();
  });

  // ------------------------------------------------------------ goal list
  function titleOf(g) {
    var t = String(g.name || '').trim() || String(g.the_goal || '').trim();
    if (!t) return T.untitled;
    return t.length > 60 ? t.slice(0, 58) + '…' : t;
  }
  function shortDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    try { return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return iso; }
  }
  function renderList() {
    var act = state.goals.filter(function (g) { return !g.archived; });
    var arc = state.goals.filter(function (g) { return !!g.archived; });
    $('gCntA').textContent = act.length; $('gCntZ').textContent = arc.length;
    $('gTabA').setAttribute('aria-selected', String(tab === 'active'));
    $('gTabZ').setAttribute('aria-selected', String(tab === 'archived'));
    var list = tab === 'archived' ? arc : act;
    var host = $('gList'); host.innerHTML = '';
    if (!list.length) {
      var p = document.createElement('p'); p.className = 'g-empty';
      p.textContent = tab === 'archived' ? T.no_archived : T.no_goals; host.appendChild(p);
    }
    var groups = AREA_IDS.map(function (id) { return [AREA_NAME[id], list.filter(function (g) { return g.life_area === id; })]; });
    groups.push([T.no_area, list.filter(function (g) { return !g.life_area; })]);
    groups.push([T.other_area, list.filter(function (g) { return g.life_area && AREA_IDS.indexOf(g.life_area) < 0; })]);
    groups.forEach(function (gr) {
      if (!gr[1].length) return;
      var h = document.createElement('h3'); h.textContent = gr[0]; host.appendChild(h);
      var ul = document.createElement('ul');
      gr[1].forEach(function (g) {
        var li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.className = 'g-item';
        if (g.id === state.activeGoalId) b.setAttribute('aria-current', 'true');
        var t = document.createElement('span'); t.className = 't'; t.textContent = titleOf(g); b.appendChild(t);
        if (g.target_date) { var d = document.createElement('span'); d.className = 'd'; d.textContent = L.target + ': ' + shortDate(g.target_date); b.appendChild(d); }
        b.addEventListener('click', function () { select(g.id); closeSheet(); });
        li.appendChild(b); ul.appendChild(li);
      });
      host.appendChild(ul);
    });
    renderCurrent();
  }
  function renderCurrent() {
    var g = active(); if (!g) return;
    $('gCurTitle').textContent = titleOf(g);
    $('gCurCount').textContent = state.goals.filter(function (x) { return !x.archived; }).length;
  }
  function select(id) {
    state.activeGoalId = id; save();
    var g = active(); if (g) { populate(g); renderList(); }
  }
  $('gTabA').addEventListener('click', function () { tab = 'active'; renderList(); });
  $('gTabZ').addEventListener('click', function () { tab = 'archived'; renderList(); });

  // phone bottom sheet
  var side = $('gSide'), backdrop = $('gBackdrop'), opener = $('gOpenList');
  var wide = window.matchMedia('(min-width: 60rem)');
  function openSheet() {
    side.classList.add('open'); backdrop.hidden = false; opener.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('no-scroll');
    var cur = side.querySelector('[aria-current="true"]') || side.querySelector('button');
    if (cur) setTimeout(function () { cur.focus({ preventScroll: true }); }, 50);
  }
  function closeSheet() {
    if (!side.classList.contains('open')) return;
    side.classList.remove('open'); backdrop.hidden = true; opener.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('no-scroll');
    if (!wide.matches) opener.focus({ preventScroll: true });
  }
  opener.addEventListener('click', openSheet);
  backdrop.addEventListener('click', closeSheet);
  $('gSideClose').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeSheet(); if (!$('gTutBg').hidden) closeTut(); } });
  wide.addEventListener && wide.addEventListener('change', function () { if (wide.matches) closeSheet(); });

  // ------------------------------------------------------------ goal actions
  function newGoal(g) {
    tab = 'active';
    g = g || blankGoal();
    state.goals.push(g); state.activeGoalId = g.id; save();
    populate(g); renderList(); closeSheet();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('gNew').addEventListener('click', function () { newGoal(); });
  function archive(on) {
    var g = active(); if (!g) return;
    g.archived = on;
    if (on) {
      var next = state.goals.find(function (x) { return !x.archived; });
      if (next) state.activeGoalId = next.id; else { var b = blankGoal(); state.goals.push(b); state.activeGoalId = b.id; }
      tab = 'active';
    } else tab = 'active';
    save(); populate(active()); renderList();
    if (on) status(T.st_archived);
  }
  function del() {
    var g = active(); if (!g) return;
    if (!confirm(fmt(T.confirm_delete, { title: titleOf(g) }))) return;
    state.goals = state.goals.filter(function (x) { return x.id !== g.id; });
    var next = state.goals.find(function (x) { return !x.archived; }) || state.goals[0];
    state.activeGoalId = next ? next.id : '';
    ensureGoal(); save(); populate(active()); renderList();
  }
  function reset() {
    var g = active(); if (!g || !confirm(T.confirm_reset)) return;
    var b = blankGoal();
    Object.keys(b).forEach(function (k) { if (k !== 'id' && k !== 'archived') g[k] = b[k]; });
    save(); populate(g); renderList(); flashSaved();
  }
  function clearAll() {
    if (!confirm(T.confirm_clear)) return;
    var b = blankGoal(); state = { goals: [b], activeGoalId: b.id }; tab = 'active';
    save(); populate(b); renderList();
  }
  function sample() {
    var g = blankGoal();
    Object.keys(T.sample || {}).forEach(function (k) { g[k] = T.sample[k]; });
    newGoal(g); status(T.st_sample);
  }
  $('gSample').addEventListener('click', sample);
  $('gClear').addEventListener('click', clearAll);
  document.querySelectorAll('.goals [data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var a = b.getAttribute('data-act');
      if (a === 'pdf') downloadPdf(b);
      else if (a === 'print') printPdf(b);
      else if (a === 'archive') archive(true);
      else if (a === 'restore') archive(false);
      else if (a === 'delete') del();
      else if (a === 'reset') reset();
    });
  });

  // ------------------------------------------------------------ backup
  $('gExport').addEventListener('click', function () {
    readForm();
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = T.json_file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  });
  $('gImport').addEventListener('click', function () { $('gFile').click(); });
  $('gFile').addEventListener('change', function (ev) {
    var f = ev.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = normalize(JSON.parse(r.result));
        if (!d || !d.goals.length) throw new Error('format');
        state = d; ensureGoal(); tab = 'active'; save();
        populate(active()); renderList(); status(T.st_loaded);
      } catch (e) { alert(T.err_file); }
    };
    r.readAsText(f);
    ev.target.value = '';
  });

  // ------------------------------------------------------------ status
  var statusT;
  function status(msg) {
    var s = $('gStatus'); s.textContent = msg || '';
    clearTimeout(statusT);
    if (msg) statusT = setTimeout(function () { s.textContent = ''; }, 7000);
  }

  // ------------------------------------------------------------ PDF
  // pdf-lib's standard font encodes WinAnsi (CP1252) only – that covers äöüß and êëôï, but not arrows,
  // emoji etc. Transliterate the common ones and drop the rest so the PDF never fails to build.
  var WINANSI_EXTRA = [0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152,
    0x017D, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x017E, 0x0178];
  var TRANSLIT = { '→': '->', '⇒': '=>', '←': '<-', '↔': '<->', '⟶': '->', '−': '-', '‐': '-', '‑': '-', '‒': '-', '―': '-',
    '⁃': '-', '∙': '-', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '′': "'", '″': '"', '‵': "'", '‶': '"', ' ': ' ',
    ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '‌': '',
    '‍': '', '﻿': '', 'ŉ': "'n" };
  var simplified = false;
  function winAnsi(s) {
    var out = '';
    for (var ch of String(s)) {
      if (Object.prototype.hasOwnProperty.call(TRANSLIT, ch)) { out += TRANSLIT[ch]; simplified = true; continue; }
      var cp = ch.codePointAt(0);
      if (cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp <= 0x7E) || (cp >= 0xA0 && cp <= 0xFF) || WINANSI_EXTRA.indexOf(cp) > -1) out += ch;
      else simplified = true;
    }
    return out;
  }
  function pdfDate(iso, short) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    try {
      // short form for the narrow table columns: 01.10.25 (de) / 01/10/25 (en, af – day first, as in SA)
      if (short) return [m[3], m[2], m[1].slice(2)].join(LANG === 'de' ? '.' : '/');
      return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return iso; }
  }
  var templateBytes = null;
  function getTemplate() {
    if (templateBytes) return Promise.resolve(templateBytes);
    return fetch(ROOT + 'assets/worksheet-' + LANG + '.pdf').then(function (r) {
      if (!r.ok) throw new Error('template ' + r.status);
      return r.arrayBuffer();
    }).then(function (b) { templateBytes = b; return b; });
  }
  function buildPdf() {
    simplified = false;
    readForm();
    var g = active();
    var doc;
    return getTemplate().then(function (bytes) { return PDFLib.PDFDocument.load(bytes); }).then(function (d) {
      doc = d; return doc.embedFont(PDFLib.StandardFonts.Helvetica);
    }).then(function (helv) {
      var f = doc.getForm();
      // shrink the font (down to 6.5pt) until the text fits its box, so nothing hides behind the edge on paper
      var fit = function (field, text, base) {
        var w = field.acroField.getWidgets()[0], r = w.getRectangle(), ml = field.isMultiline();
        var width = r.width - 4, height = r.height - 3, size = base;
        var lines = function (sz) {
          if (!ml) return helv.widthOfTextAtSize(text, sz) <= width ? 1 : Infinity;
          var n = 0;
          text.split(/\n/).forEach(function (para) {
            var line = '';
            para.split(' ').forEach(function (word) {
              var t = line ? line + ' ' + word : word;
              if (helv.widthOfTextAtSize(t, sz) > width && line) { n++; line = word; } else line = t;
            });
            n++;
          });
          return n;
        };
        while (size > 6.5 && lines(size) * size * 1.18 > (ml ? height : Infinity) || (!ml && size > 6.5 && lines(size) === Infinity)) size -= 0.5;
        field.setFontSize(size);
      };
      Object.keys(g).forEach(function (k) {
        var v = g[k], field;
        try { field = f.getField(k); } catch (e) { return; }   // e.g. "name", "id": not on the sheet
        if (field instanceof PDFLib.PDFCheckBox) { v ? field.check() : field.uncheck(); return; }
        if (!(field instanceof PDFLib.PDFTextField)) return;
        if (k === 'life_area') v = AREA_NAME[v] || v;
        else if (/^(started|target_date|achieved_on)$/.test(k)) v = pdfDate(v, false);
        else if (/^(due|reviewed)_\d+$/.test(k)) v = pdfDate(v, true);
        try { field.acroField.dict.delete(PDFLib.PDFName.of('MaxLen')); } catch (e) {}
        var text = v ? winAnsi(v) : '';
        if (text) fit(field, text, /^(due|reviewed)_\d+$/.test(k) ? 9 : 10);
        field.setText(text);
      });
      doc.setTitle(g.name ? T.title + ' – ' + winAnsi(g.name) : T.title);
      return doc.save();
    });
  }
  function fileName() {
    var g = active() || {};
    var part = function (s) { return String(s || '').trim().replace(/[^\p{L}\p{N}\- ]+/gu, '').replace(/\s+/g, '_'); };
    var area = part(AREA_NAME[g.life_area] || g.life_area);
    return T.pdf_file + (area ? '_' + area : '') + (g.name ? '_' + part(g.name) : '') + '.pdf';
  }
  function busy(on) { document.querySelectorAll('.goals [data-act="pdf"], .goals [data-act="print"]').forEach(function (b) { b.disabled = on; }); }
  function downloadPdf() {
    if (typeof PDFLib === 'undefined') { status(T.st_tools_err); return; }
    busy(true); status(T.st_building);
    buildPdf().then(function (bytes) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      status(T.st_downloaded + (simplified ? ' ' + T.st_simplified : ''));
    }).catch(function (err) { console.error(err); status(T.st_pdf_err); })
      .then(function () { busy(false); });
  }
  // print the filled 2-page worksheet itself (not the web page)
  function printPdf() {
    if (typeof PDFLib === 'undefined') { status(T.st_tools_err); return; }
    busy(true); status(T.st_preparing);
    buildPdf().then(function (bytes) {
      var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      var fr = document.createElement('iframe');
      fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      fr.src = url;
      fr.onload = function () {
        setTimeout(function () {
          try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.open(url, '_blank'); }
        }, 400);
        setTimeout(function () { URL.revokeObjectURL(url); fr.remove(); }, 60000);
      };
      document.body.appendChild(fr);
      status(T.st_opening);
    }).catch(function (err) { console.error(err); status(T.st_print_err); })
      .then(function () { busy(false); });
  }

  // ------------------------------------------------------------ tutorial
  var slides = T.tut || [], slide = 0, lastFocus = null;
  function renderTut() {
    var s = slides[slide] || { t: '', b: '' };
    $('gTutTitle').textContent = s.t;
    $('gTutBody').innerHTML = s.b;
    $('gTutDots').innerHTML = slides.map(function (_, k) { return '<span' + (k === slide ? ' class="on"' : '') + '></span>'; }).join('');
    $('gTutPrev').style.visibility = slide === 0 ? 'hidden' : 'visible';
    $('gTutNext').textContent = slide === slides.length - 1 ? T.tut_finish : T.tut_next;
  }
  function openTut(k) {
    slide = k || 0; lastFocus = document.activeElement;
    try { $('gTutSkip').checked = !!localStorage.getItem(TUT_KEY); } catch (e) {}
    renderTut(); $('gTutBg').hidden = false;
    document.documentElement.classList.add('no-scroll');
    $('gTutNext').focus();
  }
  function closeTut() {
    $('gTutBg').hidden = true;
    document.documentElement.classList.remove('no-scroll');
    try {
      if ($('gTutSkip').checked) localStorage.setItem(TUT_KEY, 'true'); else localStorage.removeItem(TUT_KEY);
    } catch (e) {}
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('gTut').addEventListener('click', function () { openTut(0); });
  $('gTutClose').addEventListener('click', closeTut);
  $('gTutPrev').addEventListener('click', function () { if (slide > 0) { slide--; renderTut(); } });
  $('gTutNext').addEventListener('click', function () { if (slide < slides.length - 1) { slide++; renderTut(); } else closeTut(); });
  $('gTutBg').addEventListener('click', function (e) { if (e.target === $('gTutBg')) closeTut(); });

  // ------------------------------------------------------------ init
  if (load()) save();   // writes migrated area ids back
  populate(active());
  renderList();
  try { if (!localStorage.getItem(TUT_KEY)) setTimeout(function () { openTut(0); }, 400); } catch (e) {}
})();
