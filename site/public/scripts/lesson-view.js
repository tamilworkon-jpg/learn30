/* global localStorage, document, setTimeout */
// T182 — runs synchronously before the lesson article is parsed (a same-origin file, so the strict CSP
// allows it): decide the lesson view first so the long page doesn't flash before it is paged.
(function () {
  var v = 'slides';
  try {
    if (localStorage.getItem('aip-ui:lesson-view') === 'full') v = 'full';
  } catch {
    /* storage blocked: default view */
  }
  var r = document.documentElement;
  r.dataset.lessonView = v;
  // Safety net: if the pager never starts, show the full page.
  setTimeout(function () {
    if (!r.dataset.deckReady) r.dataset.lessonView = 'full';
  }, 6000);
})();
