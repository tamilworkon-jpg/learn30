/* global localStorage, sessionStorage, document */
// T187/T189 — applied before first paint on every page (same-origin file, so the strict CSP allows it).
// Loaded at the very start of <body>: the server's #aip-bootstrap JSON sits at the end of <head>, so it
// is parsed by now. Signed in → the account's theme (progress.settings) and UiState; signed out → this
// browser's fallback keys (aip-ui:*). Also marks html[data-auth] for the signed-out banner.
(function () {
  var r = document.documentElement;
  var boot = null;
  try {
    var el = document.getElementById('aip-bootstrap');
    if (el && el.type === 'application/json') boot = JSON.parse(el.textContent || 'null');
  } catch {
    boot = null;
  }
  var user = boot && boot.user && typeof boot.user === 'object' ? boot.user : null;
  r.dataset.auth = user ? 'in' : 'out';
  var theme, sidebar, sections;
  if (user) {
    var p = boot.progress || {};
    var ui = boot.ui || {};
    // A change flushed by the previous page of this tab may not have reached the server before this
    // page was requested (src/lib/api.ts hand-off): prefer it.
    try {
      p = JSON.parse(sessionStorage.getItem('aip-handoff:progress:' + user.id) || 'null') || p;
      ui = JSON.parse(sessionStorage.getItem('aip-handoff:ui:' + user.id) || 'null') || ui;
    } catch {
      /* use the bootstrap */
    }
    theme = p.settings && p.settings.theme;
    sidebar = ui.sidebar;
    sections = ui.sections;
  } else {
    try {
      theme = localStorage.getItem('aip-ui:theme');
      sidebar = localStorage.getItem('aip-ui:sidebar');
      sections = localStorage.getItem('aip-ui:sections');
    } catch {
      /* storage blocked: defaults */
    }
  }
  if (theme === 'dark') r.dataset.theme = 'dark';
  if (sidebar === 'collapsed') r.dataset.sidebar = 'collapsed';
  if (sections === 'collapsed') r.dataset.sections = 'collapsed';
})();
