import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The brand lime is defined once, in app/globals.css (@theme --color-brand*).
// These checks keep it that way and keep text on it readable.
const ROOT = join(__dirname, '..', '..', '..');
const GLOBALS = join(ROOT, 'app', 'globals.css');
const css = readFileSync(GLOBALS, 'utf8');

// The brand lime (and the near-miss #9dfe0a from the decks) as hex or rgb(a).
const RAW_BRAND = /#9d(fe|ff)0a\b|rgba?\(\s*157\s*,\s*25[45]\s*,\s*10\b/i;
// Solid brand fills, with or without a variant prefix (hover:bg-brand-hover);
// opacity tints such as bg-brand/10 are excluded.
const BRAND_FILL = /(?<![\w-])bg-brand(-hover)?(?![\w/-])/;
const WHITE_TEXT = /(?<![\w:-])text-white(?![\w-])/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) && path !== GLOBALS ? [path] : [];
  });
}
const files = ['app', 'components'].flatMap((dir) => sourceFiles(join(ROOT, dir)));
const rel = (file: string) => file.replace(ROOT + '/', '');

/** Resolve a @theme colour to hex, following var(--color-*) aliases. */
function themeColor(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`--color-${name} not found in app/globals.css`);
  const value = match[1].trim();
  const alias = value.match(/^var\(--color-([\w-]+)\)$/);
  return alias ? themeColor(alias[1]) : value;
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

describe('brand tokens', () => {
  it('defines the brand lime once, as #9dff0a', () => {
    expect(themeColor('brand')).toBe('#9dff0a');
    expect(themeColor('primary')).toBe('#9dff0a');
    expect(themeColor('ring')).toBe('#9dff0a');
  });

  it('never hard-codes the brand lime outside app/globals.css', () => {
    const offenders = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => (RAW_BRAND.test(line) ? [`${rel(file)}:${i + 1}`] : []))
    );
    expect(offenders).toEqual([]);
  });

  it('never pairs a filled brand background with white text in one class string', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [literal] of source.matchAll(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g)) {
        if (BRAND_FILL.test(literal) && WHITE_TEXT.test(literal)) {
          offenders.push(`${rel(file)}: ${literal.slice(0, 100)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('brand-foreground on the brand lime meets WCAG AAA (7:1)', () => {
    const ink = themeColor('brand-foreground');
    expect(contrast(ink, themeColor('brand'))).toBeGreaterThanOrEqual(7);
    expect(contrast(ink, themeColor('brand-hover'))).toBeGreaterThanOrEqual(7);
  });

  it('brand-on-light meets WCAG AA (4.5:1) on white, where the brand lime does not', () => {
    expect(contrast(themeColor('brand-on-light'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(themeColor('brand'), '#ffffff')).toBeLessThan(4.5);
  });

  it('detects the patterns it guards against', () => {
    expect(BRAND_FILL.test('bg-brand text-white')).toBe(true);
    expect(BRAND_FILL.test('hover:bg-brand-hover')).toBe(true);
    expect(BRAND_FILL.test('bg-brand/10')).toBe(false);
    expect(RAW_BRAND.test('shadow-[0_0_8px_rgba(157,254,10,0.4)]')).toBe(true);
    expect(RAW_BRAND.test('stroke="#9DFF0A"')).toBe(true);
  });
});
