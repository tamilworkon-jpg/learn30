import { beforeEach, describe, expect, it } from 'vitest';
import { bindCollapse, isCollapsed } from '../../src/lib/ui-prefs';
import { createUiState } from '../../src/lib/ui-state';

// T187/T189 — collapsible side bars: html data attribute + UiState (signed out: localStorage) + button state.
describe('bindCollapse', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.sidebar;
    document.body.replaceChildren(Object.assign(document.createElement('button'), { id: 'b', type: 'button' }));
  });
  const opts = (ui = createUiState({ signedIn: false, storage: localStorage })) => ({
    button: document.getElementById('b') as HTMLButtonElement,
    attr: 'sidebar' as const,
    labels: { collapse: 'Collapse navigation', expand: 'Expand navigation' },
    ui,
  });

  it('starts expanded and labels the button', () => {
    bindCollapse(opts());
    const b = document.getElementById('b')!;
    expect(b.getAttribute('aria-expanded')).toBe('true');
    expect(b.getAttribute('aria-label')).toBe('Collapse navigation');
  });

  it('toggles, persists (signed out: localStorage) and announces a layout change', () => {
    let changes = 0;
    document.addEventListener('layoutchange', () => changes++);
    bindCollapse(opts());
    const b = document.getElementById('b')!;
    b.click();
    expect(isCollapsed('sidebar')).toBe(true);
    expect(localStorage.getItem('aip-ui:sidebar')).toBe('collapsed');
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.getAttribute('aria-label')).toBe('Expand navigation');
    b.click();
    expect(isCollapsed('sidebar')).toBe(false);
    expect(localStorage.getItem('aip-ui:sidebar')).toBe('expanded'); // explicit choice (narrow-window defaults never override it)
    expect(changes).toBe(2);
  });

  it('signed in: the choice goes to UiState, not localStorage', () => {
    const ui = createUiState({ signedIn: true, fetchImpl: (async () => new Response(null, { status: 204 })) as typeof fetch });
    bindCollapse(opts(ui));
    document.getElementById('b')!.click();
    expect(ui.get().sidebar).toBe('collapsed');
    expect(localStorage.getItem('aip-ui:sidebar')).toBeNull();
  });

  it('reflects a state applied before paint', () => {
    document.documentElement.dataset.sidebar = 'collapsed';
    bindCollapse(opts());
    expect(document.getElementById('b')!.getAttribute('aria-expanded')).toBe('false');
  });
});
