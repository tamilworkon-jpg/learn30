import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import tokens from '../../design/tokens.json';

const css = readFileSync(resolve(__dirname, '../../src/styles/theme.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim().toLowerCase();
  return vars;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

describe('theme.css mirrors tokens.json (F42)', () => {
  const light = block("[data-theme='light']");
  const dark = block("[data-theme='dark']");

  it('brand and domain colours match', () => {
    expect(light['brand-purple']).toBe(tokens.brand.purple.toLowerCase());
    expect(light['brand-orange']).toBe(tokens.brand.orange.toLowerCase());
    for (const [k, v] of Object.entries(tokens.domains)) expect(light[k.toLowerCase()]).toBe(v.toLowerCase());
  });

  for (const [name, vars] of [['light', light], ['dark', dark]] as const) {
    it(`${name} theme values match`, () => {
      for (const [k, v] of Object.entries(tokens.themes[name])) {
        expect(vars[kebab(k)], `${name} --${kebab(k)}`).toBe(v.toLowerCase());
      }
    });
  }
});
