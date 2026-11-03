import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AttemptHistory from '../../src/components/quiz/AttemptHistory';
import { attemptsFor, formatDuration } from '../../src/lib/attempt-history';
import { getStore, resetStoreSingleton } from '../../src/lib/progress/store';
import type { Attempt, Question } from '../../src/lib/types';
import { setBootstrap } from './client-helpers';

// Attempt history: numbered attempts (#1 oldest), best/latest, mock pass flag, read-only review.
let seq = 0;
const att = (o: Partial<Attempt> & Pick<Attempt, 'submittedAt'>): Attempt => ({
  id: `a${++seq}`,
  assessmentId: 'day-02',
  kind: 'daily',
  startedAt: new Date(Date.parse(o.submittedAt) - 10 * 60_000).toISOString(),
  answers: {},
  flagged: [],
  score: { correct: 10, total: 20, percent: 50 },
  byDomain: {},
  autoSubmitted: false,
  ...o,
} as Attempt);

const Q: Question[] = [
  {
    id: 'q-day-02-001',
    set: 'day-02',
    domain: 'D1',
    taskStatement: '1.1',
    lessonRef: 'day-02#explanation',
    type: 'single',
    stem: 'Which value is learned during training?',
    options: [
      { id: 'a', text: 'Model parameters', explanation: 'Correct. Weights are learned.' },
      { id: 'b', text: 'Hyperparameters', explanation: 'Incorrect. Set before training.' },
    ],
    answer: ['a'],
    explanation: 'Parameters are learned; hyperparameters are set by a person.',
  } as unknown as Question,
];

describe('attemptsFor', () => {
  it('numbers attempts oldest first, marks best and latest, ignores other sets', () => {
    const h = attemptsFor(
      {
        attempts: [
          att({ submittedAt: '2026-11-03T10:00:00.000Z', score: { correct: 15, total: 20, percent: 75 } }),
          att({ submittedAt: '2026-11-01T10:00:00.000Z', score: { correct: 8, total: 20, percent: 40 } }),
          att({ assessmentId: 'day-03', submittedAt: '2026-11-02T10:00:00.000Z' }),
          att({ submittedAt: '2026-11-02T10:00:00.000Z', score: { correct: 15, total: 20, percent: 75 } }),
        ],
      },
      'day-02',
    );
    expect(h.rows.map((r) => [r.number, r.percent])).toEqual([
      [1, 40],
      [2, 75],
      [3, 75],
    ]);
    expect(h.best?.number).toBe(2); // earliest of the tied best scores
    expect(h.latest?.number).toBe(3);
    expect(h.rows.filter((r) => r.isBest)).toHaveLength(1);
    expect(h.rows[0].durationMs).toBe(10 * 60_000);
    expect(h.rows[0].scaled).toBeUndefined();
  });

  it('mock attempts carry the scaled score and pass at 700', () => {
    const h = attemptsFor(
      {
        attempts: [
          att({ assessmentId: 'mock-1', kind: 'mock', submittedAt: '2026-11-01T10:00:00.000Z', score: { correct: 40, total: 65, percent: 61.5, scaled: 654 } }),
          att({ assessmentId: 'mock-1', kind: 'mock', submittedAt: '2026-11-02T10:00:00.000Z', score: { correct: 52, total: 65, percent: 80 } }),
        ],
      },
      'mock-1',
    );
    expect(h.rows.map((r) => [r.scaled, r.passed])).toEqual([
      [654, false],
      [820, true], // computed from correct/total when the stored score has no scaled value
    ]);
    expect(h.best?.number).toBe(2);
  });

  it('empty history and duration formatting', () => {
    expect(attemptsFor({ attempts: [] }, 'day-02')).toEqual({ rows: [], best: null, latest: null });
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(12 * 60_000)).toBe('12 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 05 min');
  });
});

describe('AttemptHistory component', () => {
  let root: HTMLElement;
  beforeEach(() => {
    localStorage.clear();
    setBootstrap(null);
    resetStoreSingleton();
    root = document.createElement('div');
    document.body.replaceChildren(root);
  });
  afterEach(() => {
    render(null, root);
    vi.restoreAllMocks();
  });

  it('renders nothing without attempts', async () => {
    await act(() => render(h(AttemptHistory, { assessmentId: 'day-02', questions: Q, kind: 'daily' }), root));
    expect(root.childNodes.length).toBe(0);
  });

  it('lists numbered attempts, reviews one read-only and retakes', async () => {
    const s = getStore().get();
    s.attempts.push(
      att({ submittedAt: '2026-11-01T10:00:00.000Z', answers: { 'q-day-02-001': ['b'] }, score: { correct: 0, total: 1, percent: 0 } }),
      att({ submittedAt: '2026-11-02T10:00:00.000Z', answers: { 'q-day-02-001': ['a'] }, score: { correct: 1, total: 1, percent: 100 } }),
    );
    const onRetake = vi.fn();
    await act(() => render(h(AttemptHistory, { assessmentId: 'day-02', questions: Q, kind: 'daily', onRetake }), root));
    expect(root.textContent).toContain('Your attempts (2)');
    expect(root.querySelector('[data-attempt-row="1"]')?.textContent).toContain('0 / 1 (0%)');
    expect(root.querySelector('[data-attempt-row="2"]')?.textContent).toContain('Best');
    const review = root.querySelector<HTMLButtonElement>('[data-attempt-row="1"] .ah-review')!;
    expect(review.getAttribute('aria-expanded')).toBe('false');
    await act(() => review.click());
    expect(review.getAttribute('aria-expanded')).toBe('true');
    const panel = root.querySelector('.ah-review-panel')!;
    expect(panel.textContent).toContain('Attempt #1');
    expect(panel.textContent).toContain('Your answer: Hyperparameters');
    expect(panel.textContent).toContain('Correct answer: Model parameters');
    expect(panel.querySelector('input')).toBeNull(); // read-only
    await act(() => root.querySelector<HTMLButtonElement>('[data-retake]')!.click());
    expect(onRetake).toHaveBeenCalledOnce();
  });

  it('a mock in progress hides the history (it would reveal the answers)', async () => {
    const s = getStore().get();
    s.attempts.push(att({ assessmentId: 'mock-1', kind: 'mock', submittedAt: '2026-11-01T10:00:00.000Z', score: { correct: 50, total: 65, percent: 77, scaled: 792 } }));
    s.inProgress['mock-1'] = { answers: {}, flagged: [], startedAt: '2026-11-03T10:00:00.000Z' };
    await act(() => render(h(AttemptHistory, { assessmentId: 'mock-1', questions: Q, kind: 'mock', retakeHref: '/mock/1' }), root));
    expect(root.childNodes.length).toBe(0);
    delete s.inProgress['mock-1'];
    await act(() => render(h(AttemptHistory, { assessmentId: 'mock-1', questions: Q, kind: 'mock', retakeHref: '/mock/1', refreshKey: 1 }), root));
    expect(root.textContent).toContain('792 / 1000');
    expect(root.textContent).toContain('Pass');
    expect(root.querySelector('a[data-retake]')?.getAttribute('href')).toBe('/mock/1');
  });
});
