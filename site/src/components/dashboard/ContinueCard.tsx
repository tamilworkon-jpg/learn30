// T072 — "Continue where you left off": the resume target (lastPosition → next incomplete day → Day 1)
// plus the next two days, as gradient course cards (Phase 0 dashboard).
import type { CoursePlan, PlanDay } from '../../lib/course-plan';
import { continueTarget, dayHref, minutesLeft, sectionProgress, upcoming } from '../../lib/dashboard';
import type { Progress } from '../../lib/types';

interface Props {
  plan: CoursePlan;
  progress: Progress;
}

const GRADS = ['grad-1', 'grad-2', 'grad-3'];

function timeLabel(p: Progress, d: PlanDay) {
  if (!d.available) return 'Coming soon';
  const left = minutesLeft(p, d);
  const viewed = (p.days[String(d.day)]?.sectionsViewed.length ?? 0) > 0;
  return viewed && left < d.minutes ? `${left} min left` : `${d.minutes} min`;
}

function Card({ p, d, grad, href, cta }: { p: Progress; d: PlanDay; grad: string; href: string; cta?: string }) {
  const pct = sectionProgress(p, d);
  return (
    <a class={`course-card ${grad}`} href={href} data-continue-day={d.day} data-primary={cta ? 'true' : undefined}>
      <div class="flex items-center justify-between gap-2">
        <span class={`chip chip-${d.domains[0] ?? 'D2'}`}>
          {cta && <span class="sr-only">Continue: </span>}Day {d.day}
        </span>
        <span class="pill pill-accent">⏱ {timeLabel(p, d)}</span>
      </div>
      <div>
        <div class="title">{d.title}</div>
        {cta && <div class="continue-cta">{cta}</div>}
        <progress class="card-progress mt-3" max={100} value={pct} aria-hidden="true" />
      </div>
    </a>
  );
}

export default function ContinueCard({ plan, progress }: Props) {
  const t = continueTarget(progress, plan);
  const day = plan.days.find((d) => d.day === t.day)!;
  const section = t.sectionId ? day.sections.find((s) => s.id === t.sectionId) : undefined;
  const cta = !day.available ? 'Preview →' : section ? `Resume at ${section.title} →` : t.resumed || (progress.days[String(day.day)]?.sectionsViewed.length ?? 0) > 0 ? 'Continue →' : 'Start →';
  return (
    <div class="grid-cards" data-continue>
      <Card p={progress} d={day} grad={GRADS[0]} href={t.href} cta={cta} />
      {upcoming(plan, day.day, 2).map((d, i) => (
        <Card key={d.day} p={progress} d={d} grad={GRADS[i + 1]} href={dayHref(d.day)} />
      ))}
    </div>
  );
}
