import { describe, expect, it } from 'vitest';
import { diagramHash, diagramSrc, extractDiagramCode } from '../../src/lib/diagram';

describe('build-time diagrams (T030)', () => {
  it('hash is stable and whitespace-insensitive at the ends', () => {
    expect(diagramHash('graph TD; A-->B')).toBe(diagramHash('  graph TD; A-->B \n'));
    expect(diagramHash('graph TD\r\n  A-->B')).toBe(diagramHash('graph TD\n  A-->B'));
    expect(diagramHash('graph TD\n    A-->B')).toBe(diagramHash('graph TD\nA-->B'));
    expect(diagramHash('graph TD; A-->B')).not.toBe(diagramHash('graph TD; A-->C'));
    expect(diagramSrc('graph TD; A-->B')).toMatch(/^\/diagrams\/[0-9a-f]{16}\.svg$/);
  });

  it('extracts code from Diagram usages', () => {
    const src = 'x <Diagram caption="One" code={`graph TD\n  A-->B`} /> y <Diagram\n  caption="Two"\n  code={`flowchart LR; X-->Y`}\n/>';
    expect(extractDiagramCode(src)).toEqual(['graph TD\n  A-->B', 'flowchart LR; X-->Y']);
  });
});
