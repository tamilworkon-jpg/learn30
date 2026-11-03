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

/** What a question asks for, shown as a pill above its options (learner feedback 2026-11-03). */
export function requirement(q: Question): { kind: Question['type']; need: number; label: string } {
  if (q.type === 'single') return { kind: 'single', need: 1, label: 'Single answer · choose 1' };
  if (q.type === 'multi') {
    const need = (q.answer as string[]).length;
    return { kind: 'multi', need, label: `Multiple answers · choose ${need}` };
  }
  if (q.type === 'ordering') return { kind: 'ordering', need: q.options.length, label: 'Put in order' };
  return { kind: 'matching', need: q.options.length, label: 'Match each item' };
}

/**
 * Whether a question meets its requirement: single → one choice; multi → exactly the required number;
 * ordering → always (the shown order is an answer); matching → every item matched. "Submit quiz" (last
 * question only) is enabled once every question meets it.
 */
export function canSubmitAnswer(q: Question, a: Answer | undefined): boolean {
  if (q.type === 'ordering') return true;
  if (q.type === 'matching') return isAnswered(q, a);
  const n = Array.isArray(a) ? a.length : 0;
  return n === requirement(q).need;
}

export const unanswered = (questions: Question[], answers: Record<string, Answer>) => questions.filter((q) => !isAnswered(q, answers[q.id]));

/** Questions that do not yet meet their requirement (blocks "Submit quiz"). */
export const incomplete = (questions: Question[], answers: Record<string, Answer>) => questions.filter((q) => !canSubmitAnswer(q, answers[q.id]));

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
  // The current question survives a reload / another device. (Older saves may carry `checked` from the
  // former per-question submit; it is ignored.)
  let index = Math.max(0, Math.min(questions.length - 1, saved?.index ?? 0));

  const persist = () => store.saveInProgress(assessmentId, { answers, flagged: [], index });
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
    incomplete: () => incomplete(questions, answers),
    index: () => index,
    setIndex(i: number) {
      const next = Math.max(0, Math.min(questions.length - 1, i));
      if (next === index) return;
      index = next;
      // Only worth saving once the learner has started (avoids creating an empty in-progress entry).
      if (Object.keys(answers).length || store.get().inProgress[assessmentId]) persist();
    },
    submit(autoSubmitted = false): Attempt {
      // An ordering question left as shown is answered with the order shown.
      for (const q of questions) if (q.type === 'ordering' && answers[q.id] === undefined) answers = { ...answers, [q.id]: displayOrder(q) };
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
      index = 0;
      startedAt = new Date().toISOString();
      return attempt;
    },
    best(): number | undefined {
      if (dayKey) return store.get().days[String(Number(dayKey))]?.bestScore;
      const scores = store.get().attempts.filter((a) => a.assessmentId === assessmentId).map((a) => a.score.percent);
      return scores.length ? Math.max(...scores) : undefined;
    },
    lastAttempt: () => store.get().attempts.filter((a) => a.assessmentId === assessmentId).at(-1),
    attemptCount: () => store.get().attempts.filter((a) => a.assessmentId === assessmentId).length,
  };
}

export type QuizSession = ReturnType<typeof createQuizSession>;
