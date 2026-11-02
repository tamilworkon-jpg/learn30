import { beforeEach, describe, expect, it } from 'vitest';
import { bindCollapse, isCollapsed } from '../../src/lib/ui-prefs';

// T187 — collapsible side bars: html data attribute + localStorage + button state.
describe('bindCollapse', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.sidebar;
    document.body.replaceChildren(Object.assign(document.createElement('button'), { id: 'b', type: 'button' }));
  });
  const opts = () => ({ button: document.getElementById('b') as HTMLButtonElement, key: 'aip-ui:sidebar', attr: 'sidebar' as const, labels: { collapse: 'Collapse navigation', expand: 'Expand navigation' } });

  it('starts expanded and labels the button', () => {
    bindCollapse(opts());
    const b = document.getElementById('b')!;
    expect(b.getAttribute('aria-expanded')).toBe('true');
    expect(b.getAttribute('aria-label')).toBe('Collapse navigation');
  });

  it('toggles, persists and announces a layout change', () => {
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
    expect(localStorage.getItem('aip-ui:sidebar')).toBeNull();
    expect(changes).toBe(2);
  });

  it('reflects a state applied before paint', () => {
    document.documentElement.dataset.sidebar = 'collapsed';
    bindCollapse(opts());
    expect(document.getElementById('b')!.getAttribute('aria-expanded')).toBe('false');
  });
});
