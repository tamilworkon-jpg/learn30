/* global localStorage, sessionStorage, document, setTimeout */
// T182/T189 — runs synchronously before the lesson article is parsed (a same-origin file, so the strict CSP
// allows it): decide the lesson view first so the long page doesn't flash before it is paged.
// Signed in → UiState.lessonView from #aip-bootstrap; signed out → this browser's aip-ui:lesson-view.
(function () {
  var v = 'slides';
  var boot = null;
  try {
    var el = document.getElementById('aip-bootstrap');
    if (el && el.type === 'application/json') boot = JSON.parse(el.textContent || 'null');
  } catch {
    boot = null;
  }
  if (boot && boot.user && typeof boot.user === 'object') {
    var ui = boot.ui || {};
    try {
      ui = JSON.parse(sessionStorage.getItem('aip-handoff:ui:' + boot.user.id) || 'null') || ui; // see ui-prefs.js
    } catch {
      /* use the bootstrap */
    }
    if (ui.lessonView === 'full') v = 'full';
  } else {
    try {
      if (localStorage.getItem('aip-ui:lesson-view') === 'full') v = 'full';
    } catch {
      /* storage blocked: default view */
    }
  }
  var r = document.documentElement;
  r.dataset.lessonView = v;
  // Safety net: if the pager never starts, show the full page.
  setTimeout(function () {
    if (!r.dataset.deckReady) r.dataset.lessonView = 'full';
  }, 6000);
})();
