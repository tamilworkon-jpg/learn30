// Learn30 course registry (src/data/courses.yaml). Links to a course are derived with courseHref() — the
// registry holds no URLs. Pure (no Vite ?raw import) so scripts/validate-content.ts can use it; the loaded
// list is in courses-data.ts.

export interface CourseCard {
  id: string;
  title: string;
  shortTitle: string;
  provider: string;
  examCode: string;
  description: string;
  lengthDays: number;
  hoursPerDay: number;
  level: string;
  status: 'available' | 'coming-soon';
  accent: string;
  illustration: string;
}

const STRING_FIELDS = ['id', 'title', 'shortTitle', 'provider', 'examCode', 'description', 'level', 'accent', 'illustration'] as const;

/** Validates the catalogue; returns problems (empty when valid). */
export function validateCourses(raw: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(raw) || raw.length === 0) return ['courses.yaml must be a non-empty list'];
  const ids = new Set<string>();
  raw.forEach((c: Record<string, unknown>, i) => {
    const at = `courses[${i}]`;
    if (!c || typeof c !== 'object') return errors.push(`${at}: not an object`);
    for (const f of STRING_FIELDS) if (typeof c[f] !== 'string' || !(c[f] as string).trim()) errors.push(`${at}.${f}: required text`);
    if (typeof c.id === 'string') {
      if (!/^[a-z0-9-]+$/.test(c.id)) errors.push(`${at}.id: lower-case letters, digits and dashes`);
      if (ids.has(c.id)) errors.push(`${at}.id: duplicate "${c.id}"`);
      ids.add(c.id);
    }
    if (!Number.isInteger(c.lengthDays) || (c.lengthDays as number) < 1) errors.push(`${at}.lengthDays: positive integer`);
    if (typeof c.hoursPerDay !== 'number' || c.hoursPerDay <= 0) errors.push(`${at}.hoursPerDay: positive number`);
    if (c.status !== 'available' && c.status !== 'coming-soon') errors.push(`${at}.status: available | coming-soon`);
    for (const f of ['illustration'] as const) if (typeof c[f] === 'string' && !(c[f] as string).startsWith('/')) errors.push(`${at}.${f}: site-relative path`);
    if (typeof c.accent === 'string' && !/^#[0-9a-f]{6}$/i.test(c.accent)) errors.push(`${at}.accent: #rrggbb`);
  });
  return errors;
}
