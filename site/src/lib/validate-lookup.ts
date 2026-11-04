import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { glossaryZod, serviceZod, slugify, type GlossaryTerm, type ServiceCard } from '../schemas/lookup';
import { parseLesson } from './lesson-parse';
import type { Course, ExamGuide } from './types';

// K9/K10 checks for glossary terms and service cards (T103/T104). Used by scripts/validate-content.ts and unit tests.

export interface LookupFile<T> {
  file: string;
  items: T[];
}

export interface LookupInput {
  glossary: LookupFile<GlossaryTerm>[];
  services: LookupFile<ServiceCard>[];
  guide: ExamGuide;
  course: Course;
  /** day → section ids of lessons that exist. */
  sectionsByDay: Map<number, Set<string>>;
  /** Require a card for every in-scope service (K10). */
  requireAllInScope?: boolean;
}

/** A lessonRef resolves when `day-NN#section` names an existing section, or bare `day-NN` names a course day. */
export function lessonRefResolves(ref: string, course: Course, sectionsByDay: Map<number, Set<string>>): boolean {
  const m = /^day-(\d{2})(?:#([a-z0-9-]+))?$/.exec(ref);
  if (!m) return false;
  const day = Number(m[1]);
  if (!m[2]) return course.days.some((d) => d.day === day);
  return sectionsByDay.get(day)?.has(m[2]) ?? false;
}

export function validateLookup(input: LookupInput): { errors: string[] } {
  const { guide, course, sectionsByDay } = input;
  const errors: string[] = [];
  const refCheck = (where: string, refs: unknown) => {
    for (const r of Array.isArray(refs) ? (refs as string[]) : []) {
      if (!lessonRefResolves(r, course, sectionsByDay)) errors.push(`${where}: lessonRef ${r} does not resolve`);
    }
  };

  const terms = new Map<string, string>();
  const slugs = new Set<string>();
  const allTerms: GlossaryTerm[] = [];
  for (const { file, items } of input.glossary) {
    for (const raw of items) {
      const name = raw?.term ?? '(unnamed)';
      const where = `glossary/${file}: ${name}`;
      const parsed = glossaryZod.safeParse(raw);
      if (!parsed.success) for (const i of parsed.error.issues) errors.push(`${where} — ${i.path.join('.')}: ${i.message}`);
      const key = String(name).toLowerCase();
      const slug = slugify(String(name));
      if (terms.has(key)) errors.push(`${where}: duplicate term "${name}" (also in ${terms.get(key)})`);
      else if (slugs.has(slug)) errors.push(`${where}: duplicate anchor id "${slug}"`);
      terms.set(key, file);
      slugs.add(slug);
      refCheck(where, raw?.lessonRefs);
      allTerms.push(raw);
    }
  }
  for (const t of allTerms) {
    for (const r of t.related ?? []) {
      if (!terms.has(r.toLowerCase())) errors.push(`glossary: ${t.term} — related term "${r}" is not a glossary term`);
    }
  }

  const inScope = new Set(guide.inScopeServices);
  const traps = new Set([...guide.outOfScopeServices, ...guide.notListed]);
  const names = new Set<string>();
  for (const { file, items } of input.services) {
    for (const raw of items) {
      const name = raw?.name ?? '(unnamed)';
      const where = `services/${file}: ${name}`;
      const parsed = serviceZod.safeParse(raw);
      if (!parsed.success) for (const i of parsed.error.issues) errors.push(`${where} — ${i.path.join('.')}: ${i.message}`);
      if (names.has(name)) errors.push(`${where}: duplicate service card`);
      names.add(name);
      if (inScope.has(name)) {
        if (raw.inScope !== true) errors.push(`${where}: inScope must be true (in scope in exam guide v${guide.version})`);
      } else if (traps.has(name)) {
        if (raw.inScope !== false) errors.push(`${where}: inScope must be false (out of scope / not listed in exam guide v${guide.version})`);
      } else {
        errors.push(`${where}: not in exam-guide.yaml service lists`);
      }
      refCheck(where, raw?.lessonRefs);
    }
  }
  if (input.requireAllInScope) for (const s of inScope) if (!names.has(s)) errors.push(`services: in-scope service ${s} has no card`);

  return { errors };
}

const readDir = <T>(dir: string): LookupFile<T>[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.yaml'))
        .sort()
        .map((file) => ({ file, items: (load(readFileSync(join(dir, file), 'utf8')) as T[]) ?? [] }))
    : [];

/**
 * Reads `<contentDir>`/{glossary,services}/*.yaml and the section ids of existing lessons from disk.
 * With `courseId` (Learn30): `<contentDir>/<collection>/<courseId>/…` (src/content); without it the
 * collections sit directly under contentDir (fixture course folders: tests/fixtures/courses/<id>/content).
 */
export function readLookupContent(contentDir: string, courseId?: string) {
  const col = (c: string) => (courseId ? join(contentDir, c, courseId) : join(contentDir, c));
  const lessonDir = col('lessons');
  const sectionsByDay = new Map<number, Set<string>>();
  if (existsSync(lessonDir)) {
    for (const f of readdirSync(lessonDir).filter((x) => x.endsWith('.mdx'))) {
      const l = parseLesson(readFileSync(join(lessonDir, f), 'utf8'));
      sectionsByDay.set(Number(l.frontmatter.day), new Set(l.sections.map((s) => s.id)));
    }
  }
  return {
    glossary: readDir<GlossaryTerm>(col('glossary')),
    services: readDir<ServiceCard>(col('services')),
    sectionsByDay,
  };
}
