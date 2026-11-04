// Learn30 — course ids the server accepts for /api/courses/<id>/progress (spec 002 progress-api-v2).
// Read from the registry at start-up (src/data/courses.yaml), plus the test-only fixture registry
// (tests/fixtures/courses/registry.yaml) when AIP_FIXTURE_COURSES=1.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { DEFAULT_COURSE_ID } from './db';

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function idsIn(file: string): string[] {
  if (!existsSync(file)) return [];
  const raw = load(readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => (c && typeof c === 'object' ? (c as { id?: unknown }).id : null)).filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]{1,60}$/.test(id));
}

export function loadCourseIds(env: Record<string, string | undefined> = process.env): string[] {
  const ids = idsIn(resolve(siteDir, 'src', 'data', 'courses.yaml'));
  if (env.AIP_FIXTURE_COURSES === '1') ids.push(...idsIn(resolve(siteDir, 'tests', 'fixtures', 'courses', 'registry.yaml')));
  if (!ids.includes(DEFAULT_COURSE_ID)) ids.unshift(DEFAULT_COURSE_ID);
  return [...new Set(ids)];
}
