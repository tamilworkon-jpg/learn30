import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { parseLesson } from '../../src/lib/lesson-parse';
import { noHorizontalScroll, shot, trackConsole } from './helpers';

// TC-L: one test per authored lesson day.
const lessons = readdirSync('src/content/lessons/aws-ai-practitioner')
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => parseLesson(readFileSync(`src/content/lessons/aws-ai-practitioner/${f}`, 'utf8')))
  .filter((l) => l.frontmatter.kind === 'lesson');

const order = (day: number) => [day === 1 ? 'orientation' : 'recap', 'objectives', 'explanation', 'diagram', 'examples', 'realWorld', 'handsOn', 'examTips', 'summary', 'quiz', 'deepDive'];

test.describe('content day pages (TC-L) @visual', () => {
  for (const l of lessons) {
    const day = l.frontmatter.day as number;
    const dd = String(day).padStart(2, '0');
    test(`day ${dd}`, async ({ page }) => {
      const problems = trackConsole(page);
      await page.goto(`/day/${dd}`);
      // L2 order
      const types = await page.locator('[data-section-type]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section-type')));
      expect(types).toEqual(order(day));
      // L3 diagrams load with captions
      const imgs = page.locator('figure.diagram img');
      expect(await imgs.count()).toBeGreaterThanOrEqual(2);
      await page.locator('details.deep-dive summary').click();
      for (const img of await imgs.all()) {
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
        await expect(img).toHaveAttribute('alt', /.{5,}/);
      }
      expect(await page.locator('details.deep-dive figure.diagram').count()).toBeGreaterThanOrEqual(1);
      // L4 real world + hands-on lab
      await expect(page.locator('#real-world .callout-realWorld')).toHaveCount(1);
      const lab = page.locator('#hands-on');
      await expect(lab).toContainText('No AWS account needed');
      const steps = await lab.locator('.lab-step').count();
      expect(steps).toBeGreaterThanOrEqual(3);
      await expect(lab.locator('.lab-step figure.lab-visual figcaption')).toHaveCount(steps);
      await expect(lab.locator('.lab-outcome')).toBeVisible();
      await expect(lab).toContainText('As of');
      const checks = await lab.locator('.lab-check').count();
      expect(checks).toBeGreaterThanOrEqual(2);
      expect(checks).toBeLessThanOrEqual(3);
      // L5 recap
      if (day > 1) {
        const recap = page.locator('#recap');
        await expect(recap).toContainText(`Day ${day - 1}`);
        expect(await recap.locator('li').count()).toBeGreaterThanOrEqual(3);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await noHorizontalScroll(page);
      await shot(page, `day-${dd}`);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
