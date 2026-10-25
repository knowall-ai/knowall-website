import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// White text on a filled lime surface is ~2:1 contrast and fails WCAG AA (4.5:1).
// Filled lime buttons/chips must use dark text (text-gray-950) instead.
const ROOT = join(__dirname, '..', '..', '..');
const LIME_FILL = /(?<![\w:-])bg-lime-(400|500|600)(?![\w/-])/;
const WHITE_TEXT = /(?<![\w:-])text-white(?![\w-])/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('lime button contrast', () => {
  it('never pairs a filled lime background with white text in one class string', () => {
    const offenders: string[] = [];
    for (const dir of ['app', 'components']) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const source = readFileSync(file, 'utf8');
        for (const [literal] of source.matchAll(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g)) {
          if (LIME_FILL.test(literal) && WHITE_TEXT.test(literal)) {
            offenders.push(`${file.replace(ROOT + '/', '')}: ${literal.slice(0, 100)}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
