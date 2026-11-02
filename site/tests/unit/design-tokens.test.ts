import { describe, expect, it } from 'vitest';
import tokens from '../../design/tokens.json';

type Theme = Record<string, string>;

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function resolve(theme: Theme, ref: string): string {
  if (ref.startsWith('#')) return ref;
  if (ref.startsWith('domain.')) return (tokens.domains as Record<string, string>)[ref.slice(7)];
  if (ref.startsWith('brand.')) return (tokens.brand as Record<string, string>)[ref.slice(6)];
  const v = theme[ref];
  if (!v) throw new Error(`Unknown token ${ref}`);
  return v;
}

describe('design tokens (T001)', () => {
  it('D1b brand values equal the sampled Figma colours', () => {
    expect(tokens.brand.purple).toBe('#503E9D');
    expect(tokens.brand.purple2).toBe('#6553B2');
    expect(tokens.brand.orange).toBe('#FB6D3A');
    expect(tokens.brand.orangeSoft).toBe('#FDA484');
    expect(tokens.brand.input).toBe('#F6F6F5');
  });

  it('defines all five exam domains', () => {
    expect(Object.keys(tokens.domains).sort()).toEqual(['D1', 'D2', 'D3', 'D4', 'D5']);
  });

  for (const themeName of ['light', 'dark'] as const) {
    describe(`${themeName} theme`, () => {
      const theme = tokens.themes[themeName] as Theme;
      for (const [fg, bg, size] of tokens.contrastPairs as [string, string, 'normal' | 'large'][]) {
        it(`D1 ${fg} on ${bg} meets WCAG AA (${size})`, () => {
          const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
          expect(ratio).toBeGreaterThanOrEqual(size === 'large' ? 3 : 4.5);
        });
      }
    });
  }
});
