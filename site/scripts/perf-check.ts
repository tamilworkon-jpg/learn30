// T176 P3 — JavaScript shipped by a page (gzipped), following static and dynamic imports from the page's
// scripts and Astro island component/renderer URLs. Usage: tsx scripts/perf-check.ts [/day/02] [budgetKB]
import { existsSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

export function pageJsGzipBytes(distDir: string, route: string): { total: number; files: Record<string, number> } {
  const htmlPath = join(distDir, route.replace(/^\//, ''), 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  const queue = new Set<string>();
  for (const [, url] of html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) queue.add(url);
  for (const [, url] of html.matchAll(/(?:component-url|renderer-url)="([^"]+\.js)"/g)) queue.add(url);
  // Inline module scripts may import chunks.
  for (const [, url] of html.matchAll(/import\s*(?:[^'"]*from\s*)?["'](\/[^"']+\.js)["']/g)) queue.add(url);

  const files: Record<string, number> = {};
  const seen = new Set<string>();
  const visit = (url: string) => {
    if (seen.has(url) || !url.startsWith('/')) return;
    seen.add(url);
    const file = join(distDir, url);
    if (!existsSync(file)) return;
    const src = readFileSync(file);
    files[url] = gzipSync(src).length;
    for (const [, spec] of src.toString('utf8').matchAll(/(?:import|from)\s*\(?\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) {
      visit(posix.join(posix.dirname(url), spec));
    }
  };
  queue.forEach(visit);
  return { total: Object.values(files).reduce((a, b) => a + b, 0), files };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const route = process.argv[2] ?? '/day/02';
  const budget = Number(process.argv[3] ?? 200) * 1024;
  const { total, files } = pageJsGzipBytes(resolve(import.meta.dirname, '../dist'), route);
  for (const [f, b] of Object.entries(files).sort((a, b) => b[1] - a[1])) console.log(`${(b / 1024).toFixed(1).padStart(7)} KB  ${f}`);
  console.log(`${route}: ${(total / 1024).toFixed(1)} KB gzipped JS (budget ${budget / 1024} KB)`);
  process.exit(total <= budget ? 0 : 1);
}
