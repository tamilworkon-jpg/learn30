// T187 — collapsible side bars. State lives on <html data-…> (set before paint by
// public/scripts/ui-prefs.js) and, since T189, in the account's UiState (signed out: localStorage).
import { getUiState, type Bar, type UiStateStore } from './ui-state';

export interface CollapseOptions {
  button: HTMLButtonElement;
  attr: Bar; // html[data-<attr>="collapsed"]
  labels: { collapse: string; expand: string };
  ui?: UiStateStore;
}

export const isCollapsed = (attr: Bar) => document.documentElement.dataset[attr] === 'collapsed';

export function bindCollapse({ button, attr, labels, ui }: CollapseOptions) {
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
    (ui ?? getUiState()).setCollapsed(attr, c);
    sync();
    document.dispatchEvent(new CustomEvent('layoutchange'));
  });
  sync();
}
