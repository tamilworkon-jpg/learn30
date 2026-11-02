import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { expect, test, type Page } from './fixtures';
import { noHorizontalScroll, shot, shotEl, trackConsole } from './helpers';
import { done, progress, readProgress, seed } from './progress-fixtures';

// T066 — export / import / reset (server-backed since Phase 13: readProgress reads GET /api/progress).
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(readFileSync('src/schemas/progress-schema.json', 'utf8')));
const io = (page: Page) => page.locator('[data-progress-io]');

async function open(page: Page) {
  await page.goto('/settings');
  await expect(io(page)).toHaveAttribute('data-ready', 'true');
}

test.describe('settings (T066) @visual', () => {
  test('R8 export downloads schema-valid JSON', async ({ page }) => {
    const problems = trackConsole(page);
    await seed(page, progress({ days: { '1': done(), '2': done() } }));
    await open(page);
    await noHorizontalScroll(page);
    await shot(page, 'settings');
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    const [dl] = await Promise.all([page.waitForEvent('download'), io(page).getByRole('button', { name: 'Export progress' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^aip-progress-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(readFileSync(await dl.path(), 'utf8'));
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(data.days['2'].status).toBe('completed');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('R9 import valid file → summary → confirm replaces (cancel keeps)', async ({ page }) => {
    await seed(page, progress({ days: { '1': done() } }));
    await open(page);
    const incoming = progress({ startedAt: '2026-09-01T08:00:00.000Z', days: { '1': done(), '2': done(), '3': done() } });
    const file = { name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) };

    await io(page).getByLabel('Import progress file').setInputFiles(file);
    const confirm = io(page).locator('[data-import-confirm]');
    await expect(confirm).toContainText('3 days completed');
    await expect(confirm).toContainText('0 quiz attempts');
    await io(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toHaveCount(0);
    expect(Object.keys((await readProgress(page))!.days)).toEqual(['1']);

    await io(page).getByLabel('Import progress file').setInputFiles(file);
    await expect(confirm).toBeVisible();
    await shotEl(io(page), 'import-confirm');
    await io(page).getByRole('button', { name: 'Replace my progress' }).click();
    await expect(io(page).getByRole('status')).toContainText('Progress imported');
    await expect.poll(async () => Object.keys((await readProgress(page))!.days)).toEqual(['1', '2', '3']);
    expect((await readProgress(page))!.startedAt).toBe('2026-09-01T08:00:00.000Z');
  });

  test('R10 malformed and >1 MB files are rejected with a message', async ({ page }) => {
    await seed(page, progress({ days: { '1': done() } }));
    await open(page);
    const input = io(page).getByLabel('Import progress file');
    await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{not json') });
    await expect(io(page).getByRole('alert')).toContainText('not valid JSON');
    await input.setInputFiles({ name: 'wrong.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await expect(io(page).getByRole('alert')).toContainText('does not look like a progress file');
    await input.setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(1024 * 1024 + 10, 32) });
    await expect(io(page).getByRole('alert')).toContainText('larger than 1 MB');
    await expect(io(page).locator('[data-import-confirm]')).toHaveCount(0);
    expect(Object.keys((await readProgress(page))!.days)).toEqual(['1']);
  });

  test('R11 reset needs confirmation', async ({ page }) => {
    await seed(page, progress({ days: { '1': done(), '2': done() } }));
    await open(page);
    await io(page).getByRole('button', { name: 'Reset progress…' }).click();
    await expect(io(page).locator('[data-reset-confirm]')).toBeVisible();
    await io(page).getByRole('button', { name: 'Cancel' }).click();
    expect(Object.keys((await readProgress(page))!.days)).toEqual(['1', '2']);

    await io(page).getByRole('button', { name: 'Reset progress…' }).click();
    await shotEl(io(page), 'reset-confirm');
    await io(page).getByRole('button', { name: 'Yes, delete all progress' }).click();
    await expect(io(page).getByRole('status')).toContainText('Progress reset');
    await expect.poll(async () => (await readProgress(page))!.days).toEqual({});
    await page.goto('/');
    await expect(page.locator('[data-dashboard]')).toContainText('0 of 30 days complete');
  });
});
