// T055 — quiz session state on top of the progress store (pure logic; no DOM).
import { byDomain, scoreAttempt } from './scoring';
import type { Store } from './progress/store';
import type { Answer, Attempt, Question } from './types';

export function isAnswered(q: Question, a: Answer | undefined): boolean {
  if (a === undefined) return false;
  if (q.type === 'matching') {
    const m = a as Record<string, string>;
    return q.options.every((o) => Boolean(m[o.id]));
  }
  return Array.isArray(a) && a.length > 0;
}

export const unanswered = (questions: Question[], answers: Record<string, Answer>) => questions.filter((q) => !isAnswered(q, answers[q.id]));

// Small deterministic PRNG seeded from the question id, so SSR and client agree on the order.
function seeded(id: string) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Starting order for an ordering question: a stable shuffle that is never already the answer. */
export function displayOrder(q: Question): string[] {
  const ids = q.options.map((o) => o.id);
  const rnd = seeded(q.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const key = q.answer as string[];
  if (ids.length > 1 && ids.every((v, i) => v === key[i])) ids.push(ids.shift()!);
  return ids;
}

export function createQuizSession(store: Store, assessmentId: string, questions: Question[], kind: Attempt['kind'] = 'daily') {
  const known = new Set(questions.map((q) => q.id));
  const saved = store.get().inProgress[assessmentId];
  let answers: Record<string, Answer> = Object.fromEntries(Object.entries(saved?.answers ?? {}).filter(([id]) => known.has(id)));
  let startedAt = saved?.startedAt ?? new Date().toISOString();

  const persist = () => store.saveInProgress(assessmentId, { answers, flagged: [] });
  const dayKey = /^day-(\d{2})$/.exec(assessmentId)?.[1];

  return {
    answers: () => answers,
    answer(questionId: string, value: Answer) {
      if (!known.has(questionId)) return;
      const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0;
      answers = { ...answers };
      if (empty) delete answers[questionId];
      else answers[questionId] = value;
      persist();
    },
    unanswered: () => unanswered(questions, answers),
    submit(autoSubmitted = false): Attempt {
      const attempt = store.recordAttempt({
        assessmentId,
        kind,
        startedAt,
        answers,
        flagged: [],
        score: scoreAttempt(questions, answers, kind === 'mock'),
        byDomain: byDomain(questions, answers),
        autoSubmitted,
      });
      answers = {};
      startedAt = new Date().toISOString();
      return attempt;
    },
    best(): number | undefined {
      if (dayKey) return store.get().days[String(Number(dayKey))]?.bestScore;
      const scores = store.get().attempts.filter((a) => a.assessmentId === assessmentId).map((a) => a.score.percent);
      return scores.length ? Math.max(...scores) : undefined;
    },
    lastAttempt: () => store.get().attempts.filter((a) => a.assessmentId === assessmentId).at(-1),
  };
}

export type QuizSession = ReturnType<typeof createQuizSession>;
