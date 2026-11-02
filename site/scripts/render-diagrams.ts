import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createMermaidRenderer } from 'mermaid-isomorphic';
import { diagramHash, extractDiagramCode } from '../src/lib/diagram';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'public', 'diagrams');
mkdirSync(outDir, { recursive: true });

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(mdx|astro)$/.test(f) ? [p] : [];
  });
}

const codes = new Map<string, string>();
for (const file of walk(join(root, 'src'))) {
  for (const code of extractDiagramCode(readFileSync(file, 'utf8'))) codes.set(diagramHash(code), code.replace(/\r\n?/g, '\n').trim());
}
const missing = [...codes].filter(([h]) => !existsSync(join(outDir, `${h}.svg`)));
console.log(`Diagrams: ${codes.size} total, ${missing.length} to render`);

if (missing.length) {
  const render = createMermaidRenderer();
  const results = await render(
    missing.map(([, c]) => c),
    { mermaidConfig: { theme: 'base', themeVariables: { fontFamily: 'Poppins, Arial, sans-serif', primaryColor: '#EEF2FF', primaryBorderColor: '#503E9D', primaryTextColor: '#1F1A3A', lineColor: '#503E9D', secondaryColor: '#FFF1EA', tertiaryColor: '#F6F6F5' } } },
  );
  let failed = 0;
  results.forEach((r, i) => {
    const [hash, code] = missing[i];
    if (r.status === 'fulfilled') {
      const { svg, width, height } = r.value;
      // <img> needs intrinsic dimensions; Mermaid emits width="100%".
      const sized = svg.replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1').replace('<svg', `<svg width="${Math.ceil(width)}" height="${Math.ceil(height)}"`);
      writeFileSync(join(outDir, `${hash}.svg`), sized);
    } else {
      failed++;
      console.error(`✗ diagram ${hash} failed: ${String(r.reason)}\n${code}`);
    }
  });
  if (failed) process.exit(1);
}
