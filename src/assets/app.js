/* The Wheel and the Arrow – app shell: language memory, menu, offline + automatic updates.
   Shell state lives in localStorage key "wa-state" = { lang }.
   The tools keep their own keys (wheel_of_life_v1, goals_worksheet_v1, whole_life_goal_plan_v1). */
(function () {
  'use strict';
  var APP = window.APP || {};
  var ROOT = APP.root || '';
  var LANGS = APP.langs || ['de', 'en', 'af'];
  var KEY = 'wa-state';

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function detectLang() {
    var list = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var c = String(list[i]).slice(0, 2).toLowerCase();
      if (LANGS.indexOf(c) > -1) return c;
    }
    return 'en';
  }
  var state = load();

  // routers: index.html, and the old addresses goals.html / whole-life.html
  if (APP.page === 'router') {
    location.replace(ROOT + (state.lang || detectLang()) + '/' + (APP.target || 'index.html') + location.hash);
    return;
  }

  if (APP.lang) { state.lang = APP.lang; save(state); }
  document.querySelectorAll('[data-set-lang]').forEach(function (a) {
    a.addEventListener('click', function () { state.lang = a.getAttribute('data-set-lang'); save(state); });
  });

  var tip = document.querySelector('[data-install-tip]');
  if (tip && ((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone)) tip.hidden = true;

  // ---------------------------------------------------------------- menu
  var drawer = document.getElementById('drawer');
  var menuBtn = document.querySelector('.menu-btn');
  var overlay = document.querySelector('.drawer-overlay');
  function openDrawer() {
    drawer.removeAttribute('inert'); drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('open'); overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    menuBtn.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('no-scroll');
    var cur = drawer.querySelector('[aria-current="page"]') || drawer.querySelector('a');
    if (cur) cur.focus({ preventScroll: true });
  }
  function closeDrawer() {
    drawer.classList.remove('open'); overlay.classList.remove('show');
    drawer.setAttribute('aria-hidden', 'true'); drawer.setAttribute('inert', '');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('no-scroll');
    setTimeout(function () { overlay.hidden = true; }, 250);
    menuBtn.focus({ preventScroll: true });
  }
  if (drawer && menuBtn) {
    menuBtn.addEventListener('click', function () { drawer.classList.contains('open') ? closeDrawer() : openDrawer(); });
    document.querySelectorAll('[data-drawer-close]').forEach(function (el) { el.addEventListener('click', closeDrawer); });
    drawer.querySelectorAll('a[href^="#"]').forEach(function (a) { a.addEventListener('click', closeDrawer); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });
  }

  // ---------------------------------------------------------------- offline support
  // Pages come fresh from the network when online; the service worker keeps an offline copy.
  // An installed app is often resumed rather than reloaded, so check for updates whenever it
  // comes back to the foreground. Tools save every keystroke, so a reload never loses input.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    var hadController = !!navigator.serviceWorker.controller, resumedAt = Date.now(), reloading = false;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(ROOT + 'sw.js').then(function (reg) {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') { resumedAt = Date.now(); reg.update().catch(function () {}); }
        });
        setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
      }).catch(function () {});
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      if (reloading) return;
      var busy = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      var justResumed = Date.now() - resumedAt < 8000, atTop = window.scrollY < 300;
      if (!busy && (justResumed || atTop)) { reloading = true; location.reload(); return; }
      var toast = document.querySelector('[data-update]');
      if (toast) { toast.hidden = false; toast.addEventListener('click', function () { location.reload(); }); }
    });
  }
})();
