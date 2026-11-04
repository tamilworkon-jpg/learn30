import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { examGuide, course } from '../../src/lib/data';
import { lessonRefResolves, readLookupContent, validateLookup } from '../../src/lib/validate-lookup';
import { metricGroups } from '../../src/courses/aws-ai-practitioner/metrics';
import type { GlossaryTerm, ServiceCard } from '../../src/schemas/lookup';

const contentDir = resolve(__dirname, '../../src/content');
const sections = new Map([[1, new Set(['explanation', 'summary'])]]);
const term = (t: Partial<GlossaryTerm> = {}): GlossaryTerm => ({
  term: 'Machine learning',
  definition: 'Systems that learn patterns from data instead of explicit rules.',
  examCue: 'On the exam: learns from data.',
  domain: 'D1',
  taskStatements: ['1.1'],
  lessonRefs: ['day-01#explanation'],
  ...t,
});
const card = (c: Partial<ServiceCard> = {}): ServiceCard => ({
  name: 'Amazon Bedrock',
  category: 'Generative AI & agents',
  purpose: 'Managed access to foundation models.',
  examCue: 'Choose this when you need FMs via API.',
  notThis: 'Not for training custom ML from scratch.',
  inScope: true,
  lessonRefs: ['day-12'],
  ...c,
});
const run = (glossary: GlossaryTerm[], services: ServiceCard[], requireAll = false) =>
  validateLookup({ glossary: [{ file: 'g.yaml', items: glossary }], services: [{ file: 's.yaml', items: services }], guide: examGuide, course, sectionsByDay: sections, requireAllInScope: requireAll });

describe('lookup validator (K9/K10 rules)', () => {
  it('accepts valid terms and cards', () => {
    expect(run([term()], [card()]).errors).toEqual([]);
  });
  it('K9 flags missing fields, duplicate terms, unresolved lessonRefs and related terms', () => {
    const errs = run(
      [
        term(),
        term({ term: 'machine learning' }),
        term({ term: 'Deep learning', examCue: '' }),
        term({ term: 'Epoch', lessonRefs: ['day-01#nope', 'day-04#explanation', 'day-31'] }),
        term({ term: 'Overfitting', related: ['Underfitting'] }),
      ],
      [card()],
    ).errors.join('\n');
    expect(errs).toMatch(/duplicate term "machine learning"/i);
    expect(errs).toMatch(/Deep learning.*examCue/);
    expect(errs).toMatch(/day-01#nope/);
    expect(errs).toMatch(/day-04#explanation/);
    expect(errs).toMatch(/day-31/);
    expect(errs).toMatch(/related term "Underfitting"/);
  });
  it('K10 flags inScope flags that disagree with the exam guide and unknown services', () => {
    const errs = run([term()], [card({ name: 'AWS WAF', inScope: true, category: 'Security & identity' }), card({ name: 'Amazon Kendra', inScope: true }), card({ name: 'Made Up Service' })]).errors.join('\n');
    expect(errs).toMatch(/AWS WAF.*inScope/);
    expect(errs).toMatch(/Amazon Kendra.*inScope/);
    expect(errs).toMatch(/Made Up Service.*not in exam-guide/);
  });
  it('K10 requires a card for every in-scope service when asked', () => {
    const errs = run([term()], [card()], true).errors.join('\n');
    expect(errs).toMatch(/Amazon SageMaker AI/);
    expect(errs).not.toMatch(/Amazon Bedrock has no card/);
  });
});

describe('authored glossary + service cards (T103/T104)', () => {
  const content = readLookupContent(contentDir, 'aws-ai-practitioner');
  const result = validateLookup({ ...content, guide: examGuide, course, requireAllInScope: true });
  const terms = content.glossary.flatMap((f) => f.items);
  const cards = content.services.flatMap((f) => f.items);

  it('pass the lookup validator', () => {
    expect(result.errors).toEqual([]);
  });
  it('K9 has ~150 glossary terms covering every domain', () => {
    expect(terms.length).toBeGreaterThanOrEqual(140);
    for (const d of ['D1', 'D2', 'D3', 'D4', 'D5']) expect(terms.some((t) => t.domain === d)).toBe(true);
    const tsCovered = new Set(terms.flatMap((t) => t.taskStatements));
    for (const ts of examGuide.domains.flatMap((d) => d.tasks.map((t) => t.id))) expect(tsCovered.has(ts), ts).toBe(true);
  });
  it('K10 has a card for every in-scope service plus the required trap cards', () => {
    const byName = new Map(cards.map((c) => [c.name, c]));
    for (const s of examGuide.inScopeServices) expect(byName.get(s)?.inScope, s).toBe(true);
    for (const s of ['AWS WAF', 'Amazon GuardDuty', 'AWS Security Hub', 'AWS Shield', 'Amazon Cognito', 'AWS DeepLens', 'Amazon Kendra', 'Amazon Q', 'Amazon Augmented AI', 'AWS Audit Manager']) {
      expect(byName.get(s)?.inScope, s).toBe(false);
    }
    expect(cards.length).toBeGreaterThanOrEqual(60);
  });
});

describe('metrics cheat sheet data (T100)', () => {
  const { sectionsByDay } = readLookupContent(contentDir, 'aws-ai-practitioner');
  it('every metric has a valid task statement and resolvable lessonRef', () => {
    const tsIds = new Set(examGuide.domains.flatMap((d) => d.tasks.map((t) => t.id)));
    for (const m of metricGroups.flatMap((g) => g.metrics)) {
      for (const ts of m.ts) expect(tsIds.has(ts), `${m.name} ${ts}`).toBe(true);
      for (const r of m.lessonRefs) expect(lessonRefResolves(r, course, sectionsByDay), `${m.name} ${r}`).toBe(true);
    }
  });
});
