import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from '../../src/lib/progress/store';
import {
  MOCK_MINUTES,
  announcement,
  createMockSession,
  deadlineFor,
  formatClock,
  isReady,
  mockResult,
  remainingMs,
  timerPhase,
} from '../../src/lib/mock';
import { validateProgress } from '../../src/schemas';
import type { DomainId, Question } from '../../src/lib/types';

const q = (n: number, domain: DomainId): Question => ({
  id: `q-mock-1-${String(n).padStart(3, '0')}`,
  set: 'mock-1',
  type: 'single',
  stem: `Mock question ${n}`,
  options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id, explanation: `because ${id}` })),
  answer: ['a'],
  explanation: 'An explanation long enough.',
  domain,
  taskStatement: '1.1',
  lessonRef: 'day-01#explanation',
  difficulty: 'easy',
});
const split: [DomainId, number][] = [
  ['D1', 13],
  ['D2', 16],
  ['D3', 18],
  ['D4', 9],
  ['D5', 9],
];
const questions: Question[] = split
  .flatMap(([d, n]) => Array.from({ length: n }, () => d))
  .map((d, i) => q(i + 1, d));
const MIN = 60_000;
const T0 = Date.parse('2026-11-02T10:00:00.000Z');

describe('mock exam logic (T085)', () => {
  beforeEach(() => localStorage.clear());

  it('M1 deadline = start + 90 min, persisted in inProgress', () => {
    expect(MOCK_MINUTES).toBe(90);
    expect(deadlineFor(T0)).toBe('2026-11-02T11:30:00.000Z');
    const store = createStore();
    let now = T0;
    const s = createMockSession(store, 'mock-1', questions, { now: () => now });
    expect(s.status()).toBe('idle');
    s.start();
    expect(s.status()).toBe('running');
    expect(store.get().inProgress['mock-1'].deadline).toBe('2026-11-02T11:30:00.000Z');
    expect(s.remaining()).toBe(90 * MIN);
    now += 5 * MIN;
    s.start(); // starting again never extends the deadline
    expect(store.get().inProgress['mock-1'].deadline).toBe('2026-11-02T11:30:00.000Z');
    expect(validateProgress(store.get())).toBe(true);
  });

  it('M2 remaining time, answers and flags survive a reload (new session on same storage)', () => {
    const store = createStore();
    const s = createMockSession(store, 'mock-1', questions, { now: () => T0 });
    s.start();
    s.answer(questions[0].id, ['a']);
    s.toggleFlag(questions[1].id);
    s.toggleFlag(questions[2].id);
    s.toggleFlag(questions[2].id);
    const reloaded = createMockSession(createStore(), 'mock-1', questions, { now: () => T0 + 30 * MIN });
    expect(reloaded.status()).toBe('running');
    expect(reloaded.remaining()).toBe(60 * MIN);
    expect(reloaded.answers()).toEqual({ [questions[0].id]: ['a'] });
    expect(reloaded.flagged()).toEqual([questions[1].id]);
    expect(remainingMs('2026-11-02T11:30:00.000Z', T0 + 100 * MIN)).toBe(0);
  });

  it('M3 expired deadline → auto-submit with autoSubmitted: true; M4 unanswered count as incorrect', () => {
    const store = createStore();
    const s = createMockSession(store, 'mock-1', questions, { now: () => T0 });
    s.start();
    for (const x of questions.slice(0, 10)) s.answer(x.id, ['a']);
    const later = createMockSession(createStore(), 'mock-1', questions, { now: () => T0 + 91 * MIN });
    expect(later.status()).toBe('expired');
    const a = later.submit(true);
    expect(a).toMatchObject({ assessmentId: 'mock-1', kind: 'mock', autoSubmitted: true });
    expect(a.score).toMatchObject({ correct: 10, total: 65 });
    expect(a.score.scaled).toBe(Math.round(100 + (900 * 10) / 65));
    const st = createStore();
    expect(st.get().inProgress['mock-1']).toBeUndefined();
    expect(st.get().attempts).toHaveLength(1);
    expect(validateProgress(st.get())).toBe(true);
    expect(createMockSession(st, 'mock-1', questions, { now: () => T0 + 92 * MIN }).status()).toBe('idle');
  });

  it('M5 scaled score 100–1000 and pass at 700; byDomain', () => {
    const answers = (k: number) => Object.fromEntries(questions.slice(0, k).map((x) => [x.id, ['a']]));
    const none = mockResult(questions, {});
    expect(none.score.scaled).toBe(100);
    expect(none.pass).toBe(false);
    expect(mockResult(questions, answers(65)).score.scaled).toBe(1000);
    // 100 + 900·k/65 ≥ 700 ⇔ k ≥ 43.33 → 44 correct passes, 43 fails
    expect(mockResult(questions, answers(43))).toMatchObject({ pass: false, score: { scaled: 695 } });
    expect(mockResult(questions, answers(44))).toMatchObject({ pass: true, score: { scaled: 709 } });
    expect(mockResult(questions, answers(13)).byDomain).toEqual({
      D1: { correct: 13, total: 13 },
      D2: { correct: 0, total: 16 },
      D3: { correct: 0, total: 18 },
      D4: { correct: 0, total: 9 },
      D5: { correct: 0, total: 9 },
    });
  });

  it('M6 readiness flag at ≥ 80%', () => {
    expect(isReady(80)).toBe(true);
    expect(isReady(79.99)).toBe(false);
    const k = Math.ceil(0.8 * 65); // 52
    expect(
      mockResult(questions, Object.fromEntries(questions.slice(0, k).map((x) => [x.id, ['a']]))).ready,
    ).toBe(true);
    expect(
      mockResult(questions, Object.fromEntries(questions.slice(0, k - 1).map((x) => [x.id, ['a']]))).ready,
    ).toBe(false);
  });

  it('timer helpers: clock format, amber < 10 min, red < 2 min, announce every 5 min', () => {
    expect(formatClock(90 * MIN)).toBe('90:00');
    expect(formatClock(64 * MIN + 11_200)).toBe('64:12');
    expect(formatClock(0)).toBe('00:00');
    expect(timerPhase(10 * MIN)).toBe('normal');
    expect(timerPhase(10 * MIN - 1)).toBe('warn');
    expect(timerPhase(2 * MIN)).toBe('warn');
    expect(timerPhase(2 * MIN - 1)).toBe('danger');
    expect(announcement(85 * MIN + 500, 85 * MIN - 500)).toBe('85 minutes remaining');
    expect(announcement(84 * MIN, 83 * MIN)).toBeNull();
    expect(announcement(5 * MIN + 10, 5 * MIN - 990)).toBe('5 minutes remaining');
    expect(announcement(1000, 0)).toBeNull();
  });

  it('flagged ids are recorded on the attempt', () => {
    const store = createStore();
    const s = createMockSession(store, 'mock-2', questions, { now: () => T0 });
    s.start();
    s.toggleFlag(questions[5].id);
    const a = s.submit();
    expect(a.flagged).toEqual([questions[5].id]);
    expect(a.autoSubmitted).toBe(false);
    expect(s.status()).toBe('idle');
  });
});
