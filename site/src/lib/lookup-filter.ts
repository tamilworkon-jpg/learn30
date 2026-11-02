/**
 * Client-side filter for the glossary and services cheat sheet (no HTML injection: toggles `hidden` only).
 * Markup contract inside `root`:
 *   input[data-filter-input]                      free-text filter
 *   button[data-facet="<value>"][aria-pressed]    one facet group; value "" = all
 *   [data-entry][data-search][data-facets]        filterable items (data-facets: space-separated)
 *   [data-group]                                  optional containers hidden when all their entries are hidden
 *   [data-filter-count] / [data-empty]            live count / empty-state message
 */
export function setupFilter(root: HTMLElement, noun: [string, string]) {
  const input = root.querySelector<HTMLInputElement>('[data-filter-input]');
  const facets = [...root.querySelectorAll<HTMLButtonElement>('button[data-facet]')];
  const entries = [...root.querySelectorAll<HTMLElement>('[data-entry]')];
  const groups = [...root.querySelectorAll<HTMLElement>('[data-group]')];
  const count = root.querySelector<HTMLElement>('[data-filter-count]');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  let facet = '';

  const apply = () => {
    const words = (input?.value ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const e of entries) {
      const text = e.dataset.search ?? '';
      const ok = (!facet || (e.dataset.facets ?? '').split(' ').includes(facet)) && words.every((w) => text.includes(w));
      e.hidden = !ok;
      if (ok) shown++;
    }
    for (const g of groups) g.hidden = !g.querySelector('[data-entry]:not([hidden])');
    if (count) count.textContent = `${shown} of ${entries.length} ${entries.length === 1 ? noun[0] : noun[1]}`;
    if (empty) empty.hidden = shown > 0;
  };

  const select = (value: string) => {
    facet = value;
    for (const b of facets) b.setAttribute('aria-pressed', String(b.dataset.facet === value));
    apply();
  };

  input?.addEventListener('input', apply);
  for (const b of facets) b.addEventListener('click', () => select(b.dataset.facet ?? ''));

  // Deep links: ?facet=D3 preselects; #anchor to a hidden entry clears filters so the target is visible.
  const params = new URLSearchParams(location.search);
  const pre = params.get('facet') ?? params.get('domain') ?? '';
  select(facets.some((b) => b.dataset.facet === pre) ? pre : '');
  const reveal = () => {
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target?.closest('[hidden]')) {
      if (input) input.value = '';
      select('');
      target.scrollIntoView();
    }
  };
  window.addEventListener('hashchange', reveal);
  reveal();
}
