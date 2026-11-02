import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { ROUTES } from './routes';

// T177 — security review checks: CSP on every route, zero external requests, no CSP violations,
// no raw-HTML sinks in source (ESLint also bans innerHTML/outerHTML; import validation is T017).
test.describe('security (T177)', () => {
  for (const r of ROUTES) {
    test(`${r.name}: CSP present, same-origin requests only, no violations`, async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const external: string[] = [];
      const violations: string[] = [];
      page.on('request', (req) => {
        const u = req.url();
        if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
      });
      page.on('console', (m) => /Content Security Policy/i.test(m.text()) && violations.push(m.text()));
      await page.goto(r.path);
      await page.waitForLoadState('networkidle');
      const csp = await page.locator('meta[http-equiv="content-security-policy" i]').getAttribute('content');
      expect(csp).toContain("default-src 'self'");
      expect(csp).not.toContain("'unsafe-inline'");
      expect(external).toEqual([]);
      expect(violations).toEqual([]);
    });
  }

  test('no raw-HTML sinks or eval in source', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(astro|tsx?|mdx)$/.test(f)) {
          const src = readFileSync(p, 'utf8');
          for (const pat of [/set:html/, /dangerouslySetInnerHTML/, /\.innerHTML\s*=/, /\.outerHTML\s*=/, /insertAdjacentHTML/, /\beval\(/, /new Function\(/]) {
            if (pat.test(src)) offenders.push(`${p}: ${pat}`);
          }
        }
      }
    };
    walk('src');
    expect(offenders).toEqual([]);
  });
});
