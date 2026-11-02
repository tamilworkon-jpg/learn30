import { expect, test } from '@playwright/test';
import { shot } from './helpers';
import { done, progress, seed } from './progress-fixtures';

// T179 — moving progress between origins. A VS Code forwarded URL is a different origin from localhost, so
// localStorage is not shared and learners move progress with export → import. `127.0.0.1` is a distinct origin
// from `localhost` on the same preview server, so it reproduces that situation automatically. The final manual
// step (open the real forwarded URL from VS Code's Ports panel) is listed in quickstart.md.
test.describe('port forwarding (T179) @visual', () => {
  test('export on localhost → import on a second origin; server reachable by IP', async ({ page, browser, baseURL }) => {
    const local = new URL(baseURL!);
    expect(local.hostname).toBe('localhost');
    await seed(page, progress({ days: { '1': done(), '2': done() } }));
    await page.goto('/settings');
    const io = page.locator('[data-progress-io]');
    await expect(io).toHaveAttribute('data-ready', 'true');
    const [dl] = await Promise.all([page.waitForEvent('download'), io.getByRole('button', { name: 'Export progress' }).click()]);
    const file = await dl.path();

    // Second origin (fresh storage), same server — like the forwarded URL.
    const other = `${local.protocol}//127.0.0.1:${local.port}`;
    const ctx = await browser.newContext({ baseURL: other, viewport: page.viewportSize() ?? undefined });
    const remote = await ctx.newPage();
    await remote.goto('/');
    await expect(remote.locator('[data-dashboard]')).toHaveAttribute('data-ready', 'true');
    await expect(remote.locator('[data-dashboard]')).toContainText('0 of 30 days complete');

    await remote.goto('/settings');
    const rio = remote.locator('[data-progress-io]');
    await expect(rio).toHaveAttribute('data-ready', 'true');
    await rio.getByLabel('Import progress file').setInputFiles(file);
    await expect(rio.locator('[data-import-confirm]')).toBeVisible();
    await rio.getByRole('button', { name: 'Replace my progress' }).click();
    await expect(rio.getByRole('status')).toContainText('Progress imported');

    await remote.goto('/');
    await expect(remote.locator('[data-dashboard]')).toContainText('2 of 30 days complete');
    await shot(remote, 'port-forward');
    await ctx.close();
  });
});
