import { describe, expect, it } from 'vitest';
import { isVisual, missingScreenshots, parseTasks, screenshotNames, testFilesOf } from '../../scripts/audit-lib';

const md = `
## Phase X
- [x] T050 [P] [US2] E2E site/tests/e2e/quiz.spec.ts (\`@visual\`)
  - TC: Q-E1 … screenshots
  - Verify: also tests/unit/quiz-state.test.ts
- [ ] T051 Create a component
- [x] T052 Plain task without tests

Some paragraph.
`;

describe('audit tasks (T180)', () => {
  it('A3 parses tasks with sub-lines and checked state', () => {
    const t = parseTasks(md);
    expect(t.map((x) => [x.id, x.done])).toEqual([
      ['T050', true],
      ['T051', false],
      ['T052', true],
    ]);
    expect(t[0].text).toContain('Verify: also');
    expect(t[2].text).not.toContain('Some paragraph');
  });

  it('A2 finds referenced test files (with or without site/ prefix)', () => {
    const [t] = parseTasks(md);
    expect(testFilesOf(t).sort()).toEqual(['tests/e2e/quiz.spec.ts', 'tests/unit/quiz-state.test.ts']);
    expect(isVisual(t)).toBe(true);
  });

  it('A1 extracts shot names, expanding template parts to wildcards', () => {
    const src = "await shot(page, 'lesson-nav'); await shotEl(quiz(page), \"quiz-single\"); await shot(page, `day-${dd}`);";
    const pats = screenshotNames(src);
    expect(pats.map((p) => p.test('lesson-nav'))).toEqual([true, false, false]);
    expect(pats[2].test('day-07')).toBe(true);
    expect(pats[2].test('day-')).toBe(false);
  });

  it('A1 requires desktop and mobile captures for each name', () => {
    const pats = screenshotNames("shot(page, 'a'); shot(page, `day-${d}`)");
    expect(missingScreenshots(pats, ['a-desktop.png', 'a-mobile.png', 'day-01-desktop.png'])).toEqual(['day-[\\w-]+-mobile.png']);
    expect(missingScreenshots(pats, ['a-desktop.png', 'a-mobile.png', 'day-01-desktop.png', 'day-02-mobile.png'])).toEqual([]);
  });
});
