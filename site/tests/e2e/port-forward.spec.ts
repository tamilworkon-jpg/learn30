import { expect, test } from './fixtures';
import { shot } from './helpers';
import { done, progress, seed } from './progress-fixtures';

// T179 / Phase 13 — moving between origins. A VS Code forwarded URL is a different origin from localhost, so the
// browser keeps separate cookies and storage; since progress lives on the server, signing in on the second origin
// with the same account shows the same progress (no export → import needed). `127.0.0.1` is a distinct origin from
// `localhost` on the same server, so it reproduces that situation automatically. The final manual step (open the
// real forwarded URL from VS Code's Ports panel) is listed in quickstart.md.
test.describe('port forwarding (T179) @visual', () => {
  test('progress is shared across origins once signed in; server reachable by IP', async ({ page, browser, baseURL, account }) => {
    const local = new URL(baseURL!);
    expect(local.hostname).toBe('localhost');
    await seed(page, progress({ days: { '1': done(), '2': done() } }));
    await page.goto('/');
    await expect(page.locator('[data-dashboard]')).toContainText('2 of 30 days complete');

    // Second origin (no cookie there yet), same server — like the forwarded URL.
    const other = `${local.protocol}//127.0.0.1:${local.port}`;
    const ctx = await browser.newContext({ baseURL: other, viewport: page.viewportSize() ?? undefined });
    const remote = await ctx.newPage();
    await remote.goto('/');
    await expect(remote).toHaveURL(/\/login\?next=(%2F|\/)$/);

    const form = remote.locator('[data-login-form]');
    await form.getByLabel('Username').fill(account.username);
    await form.getByLabel('Password').fill(account.password);
    await form.getByRole('button', { name: 'Sign in' }).click();
    await expect(remote).toHaveURL(`${other}/`);
    await expect(remote.locator('[data-dashboard]')).toHaveAttribute('data-ready', 'true');
    await expect(remote.locator('[data-dashboard]')).toContainText('2 of 30 days complete');
    await shot(remote, 'port-forward');
    await ctx.close();
  });
});
