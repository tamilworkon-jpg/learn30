import type { Answer, DomainScores, Question, Score } from './types';

export function toScaled(correct: number, total: number): number {
  return Math.round(100 + (900 * correct) / total);
}

export const isPass = (scaled: number, passMark = 700) => scaled >= passMark;

export function scoreQuestion(q: Question, given: Answer | undefined): boolean {
  if (given === undefined) return false;
  if (q.type === 'matching') {
    const key = q.answer as Record<string, string>;
    const g = given as Record<string, string>;
    return Object.keys(key).every((k) => g[k] === key[k]);
  }
  const key = q.answer as string[];
  const g = given as string[];
  if (!Array.isArray(g) || g.length !== key.length) return false;
  if (q.type === 'ordering') return key.every((v, i) => g[i] === v);
  const set = new Set(g);
  return key.every((v) => set.has(v));
}

export function scoreAttempt(questions: Question[], answers: Record<string, Answer>, scaled = false): Score {
  const correct = questions.filter((q) => scoreQuestion(q, answers[q.id])).length;
  const total = questions.length;
  const score: Score = { correct, total, percent: total ? Math.round((10000 * correct) / total) / 100 : 0 };
  if (scaled) score.scaled = toScaled(correct, total);
  return score;
}

export function byDomain(questions: Question[], answers: Record<string, Answer>): DomainScores {
  const out: DomainScores = {};
  for (const q of questions) {
    const d = (out[q.domain] ??= { correct: 0, total: 0 });
    d.total++;
    if (scoreQuestion(q, answers[q.id])) d.correct++;
  }
  return out;
}
