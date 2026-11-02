import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('lint guard (T006 S3)', () => {
  it('fails on innerHTML assignment', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const [res] = await eslint.lintText('const el = document.body;\nel.innerHTML = "<b>x</b>";\n', { filePath: 'src/lib/fixture.ts' });
    expect(res.messages.some((m) => m.ruleId === 'no-restricted-properties')).toBe(true);
  }, 30000);
});
