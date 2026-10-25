import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// White text on a filled lime surface fails WCAG AA (4.5:1): ~2:1 on lime-500,
// 1.25:1 on the brand lime (#9dff0a). Filled lime/brand buttons and chips must
// use dark text (text-gray-950) instead.
const ROOT = join(__dirname, '..', '..', '..');
const LIME_FILL = /(?<![\w:-])bg-lime-(400|500|600)(?![\w/-])/;
// Solid brand fills, with or without a variant prefix (hover:bg-brand-hover);
// opacity tints such as bg-brand/10 are excluded.
const BRAND_FILL = /(?<![\w-])bg-brand(-hover)?(?![\w/-])/;
const WHITE_TEXT = /(?<![\w:-])text-white(?![\w-])/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function offendingLiterals(fill: RegExp): string[] {
  const offenders: string[] = [];
  for (const dir of ['app', 'components']) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const source = readFileSync(file, 'utf8');
      for (const [literal] of source.matchAll(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g)) {
        if (fill.test(literal) && WHITE_TEXT.test(literal)) {
          offenders.push(`${file.replace(ROOT + '/', '')}: ${literal.slice(0, 100)}`);
        }
      }
    }
  }
  return offenders;
}

function themeColor(name: string): string {
  const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`--color-${name} not found in app/globals.css`);
  return match[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('lime button contrast', () => {
  it('never pairs a filled lime background with white text in one class string', () => {
    expect(offendingLiterals(LIME_FILL)).toEqual([]);
  });

  it('never pairs a filled brand background with white text in one class string', () => {
    expect(offendingLiterals(BRAND_FILL)).toEqual([]);
  });

  it('dark text on the brand lime meets WCAG AAA (7:1)', () => {
    const dark = themeColor('gray-950');
    expect(contrast(dark, themeColor('brand'))).toBeGreaterThanOrEqual(7);
    expect(contrast(dark, themeColor('brand-hover'))).toBeGreaterThanOrEqual(7);
  });

  it('flags white text on the brand lime', () => {
    expect(BRAND_FILL.test('bg-brand text-white')).toBe(true);
    expect(BRAND_FILL.test('hover:bg-brand-hover')).toBe(true);
    expect(BRAND_FILL.test('bg-brand/10')).toBe(false);
    expect(contrast('#ffffff', themeColor('brand'))).toBeLessThan(4.5);
  });
});
