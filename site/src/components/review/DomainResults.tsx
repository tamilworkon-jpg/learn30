// T081 — per-domain score of a weekly test / mock attempt with "Revisit Day N" links for missed topics.
import { courseHref, DEFAULT_COURSE_ID } from '../../lib/routes';
import { useEffect, useState } from 'preact/hooks';
import { getStore } from '../../lib/progress/store';
import { domainRows, type DomainRow } from '../../lib/review';
import type { Attempt, Question } from '../../lib/types';

export type SlimQuestion = Pick<Question, 'id' | 'domain' | 'lessonRef' | 'type' | 'answer'>;

interface BreakdownProps {
  rows: DomainRow[];
  domainNames: Record<string, string>;
  dayTitles: Record<string, string>;
  courseId?: string;
}

/** Pure view: one bar per domain; weak domains (< 70%) get a pill and revisit links first. */
export function DomainBreakdown({ rows, domainNames, dayTitles, courseId = DEFAULT_COURSE_ID }: BreakdownProps) {
  return (
    <ul class="dom-results">
      {rows.map((r) => (
        <li key={r.id} class="dom-row" data-domain={r.id} data-weak={r.weak ? 'true' : 'false'}>
          <div class="dom-row-head">
            <span class={`chip chip-${r.id}`}>{r.id}</span>
            <span class="font-medium dom-name">{domainNames[r.id] ?? r.id}</span>
            <span class="dom-score">
              {r.correct} / {r.total} · {r.percent}%
            </span>
            {r.weak && <span class="pill dom-weak">Needs review</span>}
          </div>
          <progress
            class={`dom-bar dom-bar-${r.id}`}
            max={100}
            value={r.percent}
            aria-label={`${r.id} ${r.percent} percent correct`}
          />
          {r.revisit.length > 0 && (
            <p class="m-0 mt-1 text-sm dom-revisit">
              {r.revisit.map((d) => (
                <a key={d} href={courseHref(courseId, 'day', d)} title={dayTitles[String(d)]}>
                  Revisit Day {d}
                </a>
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

interface Props {
  assessmentId: string;
  questions: SlimQuestion[];
  domainNames: Record<string, string>;
  dayTitles: Record<string, string>;
  courseId?: string;
}

/** Store-connected: shows the latest attempt for `assessmentId` and updates when a new one is submitted. */
export default function DomainResults({ assessmentId, questions, domainNames, dayTitles, courseId }: Props) {
  const [attempt, setAttempt] = useState<Attempt | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const store = getStore();
    const pick = () =>
      setAttempt(
        store
          .get()
          .attempts.filter((a) => a.assessmentId === assessmentId)
          .at(-1),
      );
    pick();
    setReady(true);
    const off = store.subscribe(pick);
    return () => {
      off();
    };
  }, [assessmentId]);

  return (
    <div class="card domain-results" data-ready={ready ? 'true' : undefined} aria-live="polite">
      {attempt ? (
        <>
          <p class="m-0">
            Latest attempt: <strong>{Math.round(attempt.score.percent)}%</strong> ({attempt.score.correct} /{' '}
            {attempt.score.total}) on {new Date(attempt.submittedAt).toLocaleDateString()}. Domains under 70%
            need another look.
          </p>
          <DomainBreakdown
            rows={domainRows(attempt, questions)}
            domainNames={domainNames}
            dayTitles={dayTitles}
            courseId={courseId}
          />
        </>
      ) : (
        <p class="muted m-0">
          Submit the cumulative test to see your score for each exam domain and which days to revisit.
        </p>
      )}
    </div>
  );
}
