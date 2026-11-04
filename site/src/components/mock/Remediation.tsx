// T093 — remediation plan on mock days: after an attempt, list the weak domains (< 70%) weakest first with days to revisit.
import { courseHref } from '../../lib/routes';
import { useEffect, useState } from 'preact/hooks';
import { getStore } from '../../lib/progress/store';
import { domainRows } from '../../lib/review';
import type { Attempt } from '../../lib/types';
import { DomainBreakdown, type SlimQuestion } from '../review/DomainResults';

interface Props {
  mock: number;
  questions: SlimQuestion[];
  domainNames: Record<string, string>;
  dayTitles: Record<string, string>;
  /** Lesson days teaching each domain — fallback revisit targets when question lessonRefs are unavailable. */
  domainDays: Record<string, number[]>;
  courseId: string;
}

export default function Remediation({ mock, questions, domainNames, dayTitles, domainDays, courseId }: Props) {
  const id = `mock-${mock}`;
  const [attempt, setAttempt] = useState<Attempt | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const store = getStore();
    setAttempt(
      store
        .get()
        .attempts.filter((a) => a.assessmentId === id)
        .at(-1),
    );
    setReady(true);
  }, [id]);

  const weak = attempt
    ? domainRows(attempt, questions)
        .filter((r) => r.weak)
        .sort((a, b) => a.percent - b.percent)
        .map((r) => (r.revisit.length ? r : { ...r, revisit: domainDays[r.id] ?? [] }))
    : [];

  return (
    <div class="card remediation" data-ready={ready ? 'true' : undefined} data-remediation={id}>
      {!attempt ? (
        <p class="muted m-0">
          Take <a href={courseHref(courseId, 'mock', mock)}>Mock exam {mock}</a> first — your weakest domains and the days to
          revisit appear here.
        </p>
      ) : weak.length ? (
        <>
          <p class="m-0">
            Mock {mock}: <strong>{attempt.score.scaled}</strong> / 1000. Your weakest{' '}
            {weak.length === 1 ? 'domain' : 'domains'}, weakest first:
          </p>
          <DomainBreakdown rows={weak} domainNames={domainNames} dayTitles={dayTitles} courseId={courseId} />
        </>
      ) : (
        <p class="m-0">
          Mock {mock}: <strong>{attempt.score.scaled}</strong> / 1000 — every domain is at 70% or above. Skim
          the weekly review top facts and keep the streak going.
        </p>
      )}
    </div>
  );
}
