import { createHash } from 'node:crypto';

// MDX strips indentation inside JSX attribute expressions, so the hash ignores per-line whitespace.
const normalize = (code: string) =>
  code
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
export const diagramHash = (code: string) => createHash('sha256').update(normalize(code)).digest('hex').slice(0, 16);
export const diagramSrc = (code: string) => `/diagrams/${diagramHash(code)}.svg`;

/** Extracts Mermaid sources from `<Diagram ... code={`...`} />` usages. */
export function extractDiagramCode(source: string): string[] {
  return [...source.matchAll(/<Diagram\b[^]*?code=\{`([^`]*)`\}/g)].map((m) => m[1]);
}
