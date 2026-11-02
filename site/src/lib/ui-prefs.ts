// T187 — collapsible side bars. State lives on <html data-…> (set before paint by
// public/scripts/ui-prefs.js) and in localStorage under its own aip-ui:* key.
export interface CollapseOptions {
  button: HTMLButtonElement;
  key: string; // localStorage key, e.g. 'aip-ui:sidebar'
  attr: 'sidebar' | 'sections'; // html[data-<attr>="collapsed"]
  labels: { collapse: string; expand: string };
}

export const isCollapsed = (attr: CollapseOptions['attr']) => document.documentElement.dataset[attr] === 'collapsed';

export function bindCollapse({ button, key, attr, labels }: CollapseOptions) {
  const sync = () => {
    const c = isCollapsed(attr);
    button.setAttribute('aria-expanded', String(!c));
    button.setAttribute('aria-label', c ? labels.expand : labels.collapse);
    button.title = c ? labels.expand : labels.collapse;
  };
  button.addEventListener('click', () => {
    const c = !isCollapsed(attr);
    if (c) document.documentElement.dataset[attr] = 'collapsed';
    else delete document.documentElement.dataset[attr];
    try {
      if (c) localStorage.setItem(key, 'collapsed');
      else localStorage.removeItem(key);
    } catch {
      /* private mode: lasts for this page */
    }
    sync();
    document.dispatchEvent(new CustomEvent('layoutchange'));
  });
  sync();
}
