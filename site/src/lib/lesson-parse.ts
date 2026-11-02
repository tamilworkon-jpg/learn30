import { load } from 'js-yaml';

export interface ParsedSection {
  id: string;
  type: string;
  title: string;
  minutes: number;
  optional: boolean;
  content: string;
}
export interface ParsedLesson {
  frontmatter: Record<string, unknown>;
  sections: ParsedSection[];
  /** MDX source after the frontmatter. */
  body: string;
}

const attr = (attrs: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? '';

export function parseLesson(source: string): ParsedLesson {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  const frontmatter = (m ? load(m[1]) : {}) as Record<string, unknown>;
  const sections: ParsedSection[] = [];
  for (const s of source.matchAll(/<Section\s+([^>]*)>([\s\S]*?)<\/Section>/g)) {
    sections.push({
      id: attr(s[1], 'id'),
      type: attr(s[1], 'type'),
      title: attr(s[1], 'title'),
      minutes: Number(/minutes=\{(\d+)\}/.exec(s[1])?.[1] ?? 0),
      optional: /\boptional\b/.test(s[1]),
      content: s[2],
    });
  }
  return { frontmatter, sections, body: m ? source.slice(m[0].length) : source };
}
