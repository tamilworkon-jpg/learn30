import { beforeEach, describe, expect, it } from 'vitest';
import { exportProgress, prepareImport } from '../../src/lib/progress/io';
import { createStore } from '../../src/lib/progress/store';
import { validateProgress } from '../../src/schemas';

describe('progress export/import (T017)', () => {
  beforeEach(() => localStorage.clear());

  it('F33 export is schema-valid JSON', () => {
    const s = createStore();
    s.markDayComplete(1);
    const json = exportProgress(s.get());
    expect(validateProgress(JSON.parse(json))).toBe(true);
  });

  it('F34 rejects oversized, non-JSON, invalid and wrong-version files', () => {
    expect(prepareImport('x'.repeat(1024 * 1024 + 1)).ok).toBe(false);
    expect(prepareImport('{oops').ok).toBe(false);
    expect(prepareImport('{"hello":1}').ok).toBe(false);
    const s = createStore();
    const bad = { ...s.get(), schemaVersion: 3 };
    const r = prepareImport(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
  });

  it('F35 returns a summary and only applies on confirm', () => {
    const src = createStore();
    src.markDayComplete(1);
    src.markDayComplete(2);
    const json = exportProgress(src.get());
    src.reset();
    const target = createStore();
    const r = prepareImport(json);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.summary.daysCompleted).toBe(2);
      expect(target.get().days['1']).toBeUndefined();
      r.confirm(target);
      expect(target.get().days['1'].status).toBe('completed');
    }
  });

  it('F36 script-like strings stay plain text', () => {
    const s = createStore();
    s.setLastPosition(1, 'recap');
    const data = s.get();
    data.attempts.push({
      id: '<script>alert(1)</script>', assessmentId: 'day-01', kind: 'daily', startedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(), answers: {}, flagged: [], score: { correct: 0, total: 1, percent: 0 },
      byDomain: {}, autoSubmitted: false,
    });
    const r = prepareImport(JSON.stringify(data));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const t = createStore();
      r.confirm(t);
      expect(t.get().attempts[0].id).toBe('<script>alert(1)</script>');
    }
  });
});
