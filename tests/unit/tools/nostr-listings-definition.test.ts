// loadDefinition() exercised against a mocked node:fs boundary — covers the
// read-failure, YAML-parse-failure, and validation-failure paths without any
// real file IO. (The example YAML files themselves are covered with real fs in
// nostr-listings.test.ts, since verifying the shipped examples is the point
// of those tests.)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDefinition } from '@/tools/nostr-listings/lib/definition.mjs';
import { readFileSync } from 'node:fs';

vi.mock('node:fs', () => {
  const readFileSync = vi.fn();
  return { readFileSync, default: { readFileSync } };
});

const mockedRead = vi.mocked(readFileSync);

describe('loadDefinition (mocked fs)', () => {
  beforeEach(() => {
    mockedRead.mockReset();
  });

  it('parses and returns a valid definition', () => {
    mockedRead.mockReturnValue(
      [
        'd: widget',
        'title: Widget',
        'summary: A widget',
        'price:',
        "  amount: '10'",
        '  currency: GBP',
        'content: The widget.',
      ].join('\n')
    );
    const def = loadDefinition('/fake/widget.yaml');
    expect(mockedRead).toHaveBeenCalledWith('/fake/widget.yaml', 'utf8');
    expect(def).toEqual({
      d: 'widget',
      title: 'Widget',
      summary: 'A widget',
      price: { amount: '10', currency: 'GBP' },
      content: 'The widget.',
    });
  });

  it('wraps filesystem read failures in a readable error', () => {
    mockedRead.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });
    expect(() => loadDefinition('/fake/missing.yaml')).toThrow(
      /cannot read \/fake\/missing\.yaml: ENOENT/
    );
  });

  it('reports YAML syntax errors with the file path', () => {
    mockedRead.mockReturnValue('title: [unclosed');
    expect(() => loadDefinition('/fake/broken.yaml')).toThrow(
      /\/fake\/broken\.yaml is not valid YAML:/
    );
  });

  it('aggregates validation failures into one error', () => {
    mockedRead.mockReturnValue('d: widget\nbogus: true');
    expect(() => loadDefinition('/fake/invalid.yaml')).toThrow(
      /\/fake\/invalid\.yaml has problems:[\s\S]*unknown key "bogus"[\s\S]*"title" is required/
    );
  });
});
