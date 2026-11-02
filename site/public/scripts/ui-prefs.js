/* global localStorage, document */
// T187 — applied before first paint on every page (same-origin file, so the strict CSP allows it):
// collapsed primary navigation rail and collapsed "Today's sections" aside, remembered per browser.
(function () {
  var r = document.documentElement;
  try {
    if (localStorage.getItem('aip-ui:sidebar') === 'collapsed') r.dataset.sidebar = 'collapsed';
    if (localStorage.getItem('aip-ui:sections') === 'collapsed') r.dataset.sections = 'collapsed';
  } catch {
    /* storage blocked: expanded */
  }
})();
