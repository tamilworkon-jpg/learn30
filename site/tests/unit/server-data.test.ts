// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import validateProgress from '../../src/schemas/generated/validate-progress';
import { defaultProgress } from '../../server/api';
import { startHarness, type Harness } from './server-harness';

let h: Harness;
let cookie: string;
beforeAll(async () => {
  h = await startHarness();
  cookie = (await h.signup('learner', 'password123')).cookie;
});
afterAll(async () => {
  await h.close();
});

describe('SV4 progress + ui (T188)', () => {
  it('the server default progress is schema-valid', () => {
    expect(validateProgress(defaultProgress(Date.now()))).toBe(true);
  });

  it('PUT /api/progress stores a valid doc (204) and GET returns it; last write wins', async () => {
    const p1 = { ...defaultProgress(h.clock.t), badges: ['week-1'] };
    expect((await h.api('PUT', '/api/progress', p1, cookie)).status).toBe(204);
    expect((await h.api('GET', '/api/progress', undefined, cookie)).json()).toEqual(p1);
    const p2 = { ...p1, badges: ['week-2'], lastPosition: { day: 2, sectionId: 'intro', updatedAt: new Date(h.clock.t).toISOString() } };
    expect((await h.api('PUT', '/api/progress', p2, cookie)).status).toBe(204);
    expect((await h.api('GET', '/api/progress', undefined, cookie)).json()).toEqual(p2);
  });

  it('invalid progress → 400 with an error message, nothing stored', async () => {
    const before = (await h.api('GET', '/api/progress', undefined, cookie)).json();
    for (const bad of [{ hello: 'world' }, { ...defaultProgress(h.clock.t), schemaVersion: 2 }, [], 'x', null]) {
      const r = await h.api('PUT', '/api/progress', bad, cookie);
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(typeof (r.json() as { error: string }).error).toBe('string');
    }
    expect((await h.api('GET', '/api/progress', undefined, cookie)).json()).toEqual(before);
  });

  it('body > 1 MB → 413', async () => {
    const big = { ...defaultProgress(h.clock.t), badges: ['x'.repeat(1024 * 1024)] };
    const r = await h.api('PUT', '/api/progress', big, cookie);
    expect(r.status).toBe(413);
  });

  it('progress is per user', async () => {
    const other = (await h.signup('other_learner', 'password123')).cookie;
    const mine = (await h.api('GET', '/api/progress', undefined, cookie)).json() as { badges: string[] };
    const theirs = (await h.api('GET', '/api/progress', undefined, other)).json() as { badges: string[] };
    expect(mine.badges).toEqual(['week-2']);
    expect(theirs.badges).toEqual([]);
  });

  it('GET /api/ui defaults to {}; PUT valid UiState → 204 and round-trips; last write wins', async () => {
    expect((await h.api('GET', '/api/ui', undefined, cookie)).json()).toEqual({});
    const ui = { lessonView: 'slides', sidebar: 'collapsed', sections: 'expanded', slides: { '1': { sectionId: 'intro', block: 3 }, '30': { sectionId: 'x', block: 0 } } };
    expect((await h.api('PUT', '/api/ui', ui, cookie)).status).toBe(204);
    expect((await h.api('GET', '/api/ui', undefined, cookie)).json()).toEqual(ui);
    expect((await h.api('PUT', '/api/ui', { lessonView: 'full' }, cookie)).status).toBe(204);
    expect((await h.api('GET', '/api/ui', undefined, cookie)).json()).toEqual({ lessonView: 'full' });
  });

  it('PUT /api/ui rejects bad shapes, unknown keys and > 64 KB with 400', async () => {
    const bad: unknown[] = [
      { lessonView: 'grid' },
      { sidebar: true },
      { extra: 1 },
      { slides: { '31': { sectionId: 'a', block: 0 } } },
      { slides: { '0': { sectionId: 'a', block: 0 } } },
      { slides: { '1': { sectionId: 'a', block: -1 } } },
      { slides: { '1': { sectionId: 'a', block: 1.5 } } },
      { slides: { '1': { sectionId: 5, block: 1 } } },
      { slides: { '1': { sectionId: 'a', block: 1, more: true } } },
      { slides: [] },
      [],
      null,
    ];
    for (const b of bad) expect((await h.api('PUT', '/api/ui', b, cookie)).status, JSON.stringify(b)).toBe(400);
    const slides = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [String(i + 1), { sectionId: 's'.repeat(200), block: 1 }]));
    // 30 × ~230 B is under 64 KB: fine.
    expect((await h.api('PUT', '/api/ui', { slides }, cookie)).status).toBe(204);
    const huge = await h.api('PUT', '/api/ui', { lessonView: 'full', pad: 'x'.repeat(70 * 1024) }, cookie);
    expect(huge.status).toBe(400);
  });
});

describe('T192 L1 — UiState keys from Object.prototype', () => {
  it('__proto__ / constructor / toString keys → 400, not 500', async () => {
    const raw = ['{"__proto__":{"lessonView":"full"}}', '{"constructor":"slides"}', '{"toString":"full"}', '{"hasOwnProperty":"x"}', '{"slides":{"__proto__":{"sectionId":"a","block":1}}}'];
    for (const body of raw) {
      const r = await h.req('PUT', '/api/ui', { raw: body, cookie, headers: { 'Content-Type': 'application/json', 'X-AIP-Request': '1' } });
      expect(r.status, body).toBe(400);
    }
  });
});
