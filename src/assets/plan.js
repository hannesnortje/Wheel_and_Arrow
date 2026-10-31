/* Whole-Life Goal Plan – port of build/legacy/whole-life.html.
   Data: localStorage "whole_life_goal_plan_v1", shape unchanged from the original:
     { schemaVersion: 2, meta: {name, created, reviewed, mission},
       areas: [ [ {priority, type, goal, date, status, archived}, … ] × 6 ] }
   areas[] is stored BY POSITION in the original order (POS_IDS below); the page shows the
   areas in booklet order (T._areas). type/status keep their original English values as
   stable codes; only the labels are translated. Tutorial "don't show" key: whole_life_tut_skip_v1. */
(function () {
  'use strict';
  var T = window.T || {};
  var KEY = 'whole_life_goal_plan_v1';
  var TUT_KEY = 'whole_life_tut_skip_v1';
  var ROWS = 10;
  // stored position -> area id (original order: Society, Family, Work, Body, Mind, Ethics)
  var POS_IDS = ['society', 'family', 'work', 'body', 'mind', 'ethics'];
  var AREAS = (T._areas || []).map(function (a) { return { id: a[0], name: a[1], desc: a[2], pos: POS_IDS.indexOf(a[0]) }; });
  var TYPES = ['Short-Term', 'Medium-Term', 'Long-Term'];
  var STATUS = ['Not Started', 'In Progress', 'Blocked', 'Completed'];
  var PRIOS = ['1', '2', '3', '4', '5'];

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function blank() { return { priority: '', type: '', goal: '', date: '', status: '', archived: false }; }
  function defaultData() {
    return { schemaVersion: 2, meta: { name: '', created: '', reviewed: '', mission: '' },
      areas: POS_IDS.map(function () { var a = []; for (var i = 0; i < ROWS; i++) a.push(blank()); return a; }) };
  }

  // same migration as the original page (schema 1 -> 2 reordered the areas)
  function normalize(d) {
    if (!d || typeof d !== 'object') return defaultData();
    if (!Array.isArray(d.areas)) d.areas = [];
    if (!d.schemaVersion || d.schemaVersion < 2) {
      var old = d.areas, mapping = { 0: 3, 1: 4, 2: 0, 3: 5, 4: 2, 5: 1 }, na = [[], [], [], [], [], []];
      for (var o = 0; o < 6; o++) na[mapping[o]] = old[o] || [];
      d.areas = na; d.schemaVersion = 2;
    }
    if (!d.meta || typeof d.meta !== 'object') d.meta = { name: '', created: '', reviewed: '', mission: '' };
    d.areas = POS_IDS.map(function (_, i) {
      var a = Array.isArray(d.areas[i]) ? d.areas[i].filter(function (g) { return g && typeof g === 'object'; }) : [];
      while (a.length < ROWS) a.push(blank());
      a.forEach(function (g) {
        if (typeof g.archived === 'undefined') g.archived = false;
        ['priority', 'type', 'goal', 'date', 'status'].forEach(function (k) { if (g[k] == null) g[k] = ''; else g[k] = String(g[k]); });
      });
      return a;
    });
    return d;
  }
  function load() { try { var r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  var data = normalize(load());

  var savedEl = $('#plan-saved'), savedT;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { return; }
    if (!savedEl) return;
    savedEl.textContent = T.saved; clearTimeout(savedT);
    savedT = setTimeout(function () { savedEl.textContent = T.autosave; }, 1200);
  }

  function filled(g) { return ['priority', 'type', 'goal', 'date', 'status'].some(function (k) { return String(g[k] || '').trim() !== ''; }); }

  // ------------------------------------------------------------ meta
  function renderMeta() {
    document.querySelectorAll('[data-meta]').forEach(function (el) {
      el.value = data.meta[el.dataset.meta] || '';
      el.oninput = function () { data.meta[el.dataset.meta] = el.value; save(); };
    });
  }

  // ------------------------------------------------------------ areas
  // Only filled rows + a few blank lines are shown (the stored rows stay padded to 10 as before).
  var extra = {};   // pos -> number of blank lines shown
  function blanksFor(pos) {
    if (extra[pos] == null) {
      var n = data.areas[pos].filter(function (g) { return !g.archived && filled(g); }).length;
      extra[pos] = Math.max(1, 3 - n);
    }
    return extra[pos];
  }
  function options(list, labels, val) {
    var out = '<option value="">' + esc(T.select) + '</option>', has = false;
    list.forEach(function (o) { if (o === val) has = true; out += '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(labels ? (labels[o] || o) : o) + '</option>'; });
    if (val && !has) out += '<option value="' + esc(val) + '" selected>' + esc(labels ? (labels[val] || val) : val) + '</option>';
    return out;
  }
  function th(label, tip) { return '<th scope="col"' + (tip ? ' title="' + esc(tip) + '"' : '') + '>' + esc(label) + (tip ? ' <span class="tip" aria-hidden="true">ⓘ</span>' : '') + '</th>'; }
  function tableHead() {
    return '<thead><tr>' + th(T.col_prio, T.tip_prio) + th(T.col_type, T.tip_type) + th(T.col_goal, T.tip_goal) +
      th(T.col_date, T.tip_date) + th(T.col_status, T.tip_status) + '<th scope="col"><span class="sr">' + esc(T.col_actions) + '</span></th></tr></thead>';
  }

  var uid = 0;
  function rowEl(pos, ri, g) {
    var tr = document.createElement('tr'), id = 'pg' + (++uid);
    tr.className = 'goal-row' + (g.archived ? ' is-archived' : '');
    tr.innerHTML =
      '<td class="c-prio"><label class="cl" for="' + id + 'p">' + esc(T.col_prio) + '</label>' +
        '<select id="' + id + 'p">' + options(PRIOS, null, g.priority) + '</select></td>' +
      '<td class="c-type"><label class="cl" for="' + id + 't">' + esc(T.col_type) + '</label>' +
        '<select id="' + id + 't">' + options(TYPES, T.types, g.type) + '</select></td>' +
      '<td class="c-goal"><label class="cl" for="' + id + 'g">' + esc(T.col_goal) + '</label>' +
        '<textarea id="' + id + 'g" rows="1" placeholder="' + esc(T.goal_ph) + '">' + esc(g.goal) + '</textarea></td>' +
      '<td class="c-date"><label class="cl" for="' + id + 'd">' + esc(T.col_date) + '</label>' +
        '<input type="date" id="' + id + 'd" value="' + esc(g.date) + '"></td>' +
      '<td class="c-status"><label class="cl" for="' + id + 's">' + esc(T.col_status) + '</label>' +
        '<select id="' + id + 's">' + options(STATUS, T.status, g.status) + '</select></td>' +
      '<td class="c-x">' +
        (g.archived
          ? '<button type="button" class="rbtn" data-a="unarchive" title="' + esc(T.unarchive_t) + '" aria-label="' + esc(T.unarchive_t) + '"><span aria-hidden="true">↺</span><span class="bl">' + esc(T.unarchive) + '</span></button>'
          : '<button type="button" class="rbtn" data-a="archive" title="' + esc(T.archive_t) + '" aria-label="' + esc(T.archive_t) + '"><span aria-hidden="true">▤</span><span class="bl">' + esc(T.archive) + '</span></button>') +
        '<button type="button" class="rbtn del" data-a="remove" title="' + esc(T.remove_t) + '" aria-label="' + esc(T.remove_t) + '"><span aria-hidden="true">✕</span><span class="bl">' + esc(T.remove) + '</span></button>' +
      '</td>';
    var goal = tr.querySelector('textarea'), sel = tr.querySelectorAll('select'), date = tr.querySelector('input[type=date]');
    goal.addEventListener('input', function () { g.goal = goal.value; grow(goal); save(); });
    sel[0].addEventListener('change', function () { g.priority = sel[0].value; save(); });
    sel[1].addEventListener('change', function () { g.type = sel[1].value; save(); });
    sel[2].addEventListener('change', function () { g.status = sel[2].value; save(); });
    date.addEventListener('input', function () { g.date = date.value; save(); });
    date.addEventListener('change', function () { g.date = date.value; save(); });
    tr.querySelectorAll('[data-a]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.a, list = data.areas[pos], k = list.indexOf(g);
        if (k < 0) return;
        if (a === 'archive') { g.archived = true; }
        else if (a === 'unarchive') { g.archived = false; }
        else if (a === 'remove') {
          if (filled(g) && !confirm(T.confirm_remove)) return;
          list.splice(k, 1);
          if (!filled(g) && !g.archived) extra[pos] = Math.max(1, blanksFor(pos) - 1);
          if (list.length === 0) list.push(blank());
        }
        save(); renderArea(pos);
      });
    });
    return tr;
  }
  function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 44) + 'px'; }

  function renderArea(pos) {
    var sec = document.querySelector('.plan-area[data-pos="' + pos + '"]');
    if (!sec) return;
    var act = $('.act-body', sec), arc = $('.arc-body', sec), list = data.areas[pos];
    act.innerHTML = ''; arc.innerHTML = '';
    var nb = blanksFor(pos), shownBlanks = 0, archived = 0;
    list.forEach(function (g, ri) {
      if (g.archived) { archived++; arc.appendChild(rowEl(pos, ri, g)); return; }
      if (!filled(g)) { if (shownBlanks >= nb) return; shownBlanks++; }
      act.appendChild(rowEl(pos, ri, g));
    });
    var det = $('.arc', sec);
    det.hidden = archived === 0;
    $('.arc-count', sec).textContent = archived;
    sec.querySelectorAll('textarea').forEach(grow);
  }

  function renderAreas() {
    var host = $('#plan-areas');
    host.innerHTML = '';
    AREAS.forEach(function (a, i) {
      var sec = document.createElement('section');
      sec.className = 'plan-area'; sec.dataset.pos = a.pos; sec.dataset.area = a.id;
      sec.setAttribute('aria-labelledby', 'area-' + a.id);
      sec.innerHTML =
        '<h3 class="band" id="area-' + a.id + '">' + (i + 1) + '. ' + esc(a.name) + '</h3>' +
        '<p class="desc">' + esc(a.desc) + '</p>' +
        '<table class="goals-t">' + tableHead() + '<tbody class="act-body"></tbody></table>' +
        '<div class="addrow"><button type="button" class="tbtn ghost add">' + esc(T.add) + '</button></div>' +
        '<details class="arc"><summary>' + esc(T.archived_h) + ' (<span class="arc-count">0</span>)</summary>' +
        '<table class="goals-t">' + tableHead() + '<tbody class="arc-body"></tbody></table></details>';
      host.appendChild(sec);
      $('.add', sec).addEventListener('click', function () {
        var list = data.areas[a.pos];
        var blanks = list.filter(function (g) { return !g.archived && !filled(g); }).length;
        extra[a.pos] = blanksFor(a.pos) + 1;
        if (blanks < extra[a.pos]) list.push(blank());
        save(); renderArea(a.pos);
        var rows = sec.querySelectorAll('.act-body textarea');
        for (var r = 0; r < rows.length; r++) if (!rows[r].value) { rows[r].focus(); break; }
      });
      renderArea(a.pos);
    });
  }

  // ------------------------------------------------------------ print
  function fmtDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return v || '';
    return (T.date_fmt || 'DD/MM/YYYY').replace('DD', m[3]).replace('MM', m[2]).replace('YYYY', m[1]);
  }
  function buildPrint() {
    var host = $('#plan-print'), M = data.meta, h = '';
    h += '<h1>' + esc(T.h1) + '</h1>';
    if (M.name || M.created || M.reviewed) {
      h += '<p class="pmeta">' + esc(T.print_meta).replace('{name}', esc(M.name || '—'))
        .replace('{created}', esc(fmtDate(M.created) || '—')).replace('{reviewed}', esc(fmtDate(M.reviewed) || '—')) + '</p>';
    }
    h += '<h2>' + esc(T.mission_h) + ' <small>' + esc(T.mission_small) + '</small></h2>';
    h += '<div class="pmission">' + (M.mission ? esc(M.mission).replace(/\n/g, '<br>') : '&nbsp;') + '</div>';
    h += '<div class="phabits">' + $('#plan-habits').innerHTML + '</div>';
    h += '<h2>' + esc(T.areas_h) + '</h2>';
    AREAS.forEach(function (a, i) {
      var rows = data.areas[a.pos].filter(function (g) { return !g.archived && filled(g); });
      while (rows.length < 3) rows.push(blank());
      h += '<section class="parea"><h3>' + (i + 1) + '. ' + esc(a.name) + '</h3><p class="pdesc">' + esc(a.desc) + '</p>' +
        '<table><colgroup><col class="w-p"><col class="w-t"><col><col class="w-d"><col class="w-s"></colgroup>' +
        '<thead><tr><th>' + esc(T.col_prio) + '</th><th>' + esc(T.col_type) + '</th><th>' + esc(T.col_goal) + '</th><th>' +
        esc(T.col_date) + '</th><th>' + esc(T.col_status) + '</th></tr></thead><tbody>' +
        rows.map(function (g) {
          return '<tr><td class="pc">' + esc(g.priority) + '</td><td>' + esc((T.types || {})[g.type] || g.type) + '</td><td>' +
            esc(g.goal).replace(/\n/g, '<br>') + '</td><td>' + esc(fmtDate(g.date)) + '</td><td>' + esc((T.status || {})[g.status] || g.status) + '</td></tr>';
        }).join('') + '</tbody></table></section>';
    });
    host.innerHTML = h;
  }
  window.addEventListener('beforeprint', buildPrint);

  // ------------------------------------------------------------ export / import / clear
  function exportJSON() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = T.file_name || 'my-goal-plan.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  var imp = $('#plan-imp');
  imp.addEventListener('change', function () {
    var f = imp.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d || typeof d !== 'object' || (!d.meta && !Array.isArray(d.areas))) throw new Error('shape');
        data = normalize(d); extra = {}; renderMeta(); renderAreas(); save();
      } catch (e) { alert(T.import_error); }
    };
    r.readAsText(f); imp.value = '';
  });
  function clearAll() {
    if (!confirm(T.confirm_clear)) return;
    data = defaultData(); extra = {}; renderMeta(); renderAreas(); save();
  }

  // ------------------------------------------------------------ tutorial
  var tut = $('#plan-tut'), slides = T.tut || [], si = 0, lastFocus = null;
  function areaList() {
    return '<ul>' + AREAS.map(function (a) { return '<li><b>' + esc(a.name) + '</b> – ' + esc(a.desc) + '</li>'; }).join('') + '</ul>';
  }
  function renderSlide() {
    var s = slides[si];
    $('#plan-tut-title').textContent = s.title;
    $('#plan-tut-body').innerHTML = s.html.replace('{areas}', areaList());
    $('#plan-tut-dots').innerHTML = slides.map(function (_, i) { return '<span class="' + (i === si ? 'on' : '') + '"></span>'; }).join('');
    $('[data-tut=prev]', tut).hidden = si === 0;
    $('[data-tut=next]', tut).textContent = si === slides.length - 1 ? T.tut_finish : T.tut_next;
  }
  function openTut(i) {
    si = i || 0; lastFocus = document.activeElement;
    try { $('#plan-tut-skip').checked = localStorage.getItem(TUT_KEY) === 'true'; } catch (e) {}
    renderSlide(); tut.hidden = false;
    document.documentElement.classList.add('no-scroll');
    $('[data-tut=next]', tut).focus({ preventScroll: true });
  }
  function closeTut() {
    tut.hidden = true;
    document.documentElement.classList.remove('no-scroll');
    try {
      if ($('#plan-tut-skip').checked) localStorage.setItem(TUT_KEY, 'true');
      else localStorage.removeItem(TUT_KEY);
    } catch (e) {}
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  tut.addEventListener('click', function (e) {
    if (e.target === tut) { closeTut(); return; }
    var b = e.target.closest('[data-tut]'); if (!b) return;
    var a = b.dataset.tut;
    if (a === 'close') closeTut();
    else if (a === 'prev' && si > 0) { si--; renderSlide(); }
    else if (a === 'next') { if (si < slides.length - 1) { si++; renderSlide(); } else closeTut(); }
  });
  document.addEventListener('keydown', function (e) {
    if (tut.hidden) return;
    if (e.key === 'Escape') closeTut();
    else if (e.key === 'ArrowRight' && si < slides.length - 1 && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { si++; renderSlide(); }
    else if (e.key === 'ArrowLeft' && si > 0) { si--; renderSlide(); }
  });

  // ------------------------------------------------------------ toolbar
  document.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var a = b.dataset.act;
      if (a === 'tutorial') openTut(0);
      else if (a === 'print') { buildPrint(); window.print(); }
      else if (a === 'export') exportJSON();
      else if (a === 'import') imp.click();
      else if (a === 'clear') clearAll();
    });
  });

  renderMeta();
  renderAreas();
  try { if (!localStorage.getItem(TUT_KEY)) setTimeout(function () { openTut(0); }, 400); } catch (e) {}
})();
