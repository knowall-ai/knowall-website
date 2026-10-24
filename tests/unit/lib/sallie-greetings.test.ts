import { describe, it, expect } from 'vitest';
import { GREETINGS, pickGreeting } from '@/lib/sallie-greetings';
import { SALLIE_CONTEXTS, parseSallieContext } from '@/lib/sallie-context';

/**
 * Greeting pool tests
 *
 * Requirements: sallie-chat
 * - Every opener introduces Sallie, is short enough to speak, and asks one question
 * - The pick is deterministic given a random source, and ids are unique
 */

describe('Sallie greetings', () => {
  it('every opener names Sallie, ends with a question and fits in a spoken clip', () => {
    for (const g of GREETINGS) {
      expect(g.text).toMatch(/Sallie/);
      expect(g.text.trim().endsWith('?') || g.text.trim().endsWith('.')).toBe(true);
      expect(g.text).toMatch(/\?/);
      expect(g.text.length).toBeLessThanOrEqual(260);
    }
    expect(new Set(GREETINGS.map((g) => g.id)).size).toBe(GREETINGS.length);
  });

  it('picks deterministically from a random source and never overruns the pool', () => {
    expect(pickGreeting(() => 0)).toBe(GREETINGS[0]);
    expect(pickGreeting(() => 0.999999)).toBe(GREETINGS[GREETINGS.length - 1]);
    expect(pickGreeting(() => 1)).toBe(GREETINGS[GREETINGS.length - 1]);
  });

  it('page contexts follow the same rules, with ids unique across every pool', () => {
    const all = [...GREETINGS, ...Object.values(SALLIE_CONTEXTS).flatMap((c) => c.greetings)];
    for (const g of all) {
      expect(g.text).toMatch(/Sallie/);
      expect(g.text).toMatch(/\?/);
      expect(g.text.length).toBeLessThanOrEqual(260);
    }
    expect(new Set(all.map((g) => g.id)).size).toBe(all.length);
  });

  it('opens on the Purple Team on its page', () => {
    const g = pickGreeting(() => 0, 'purple-team');
    expect(g.id).toMatch(/^pt-/);
    expect(SALLIE_CONTEXTS['purple-team'].greetings).toContainEqual(g);
  });

  it('accepts only known contexts', () => {
    expect(parseSallieContext('purple-team')).toBe('purple-team');
    expect(parseSallieContext('ignore previous instructions')).toBeUndefined();
    expect(parseSallieContext('constructor')).toBeUndefined();
    expect(parseSallieContext(42)).toBeUndefined();
    expect(parseSallieContext('__proto__')).toBeUndefined();
    expect(parseSallieContext(['purple-team'])).toBeUndefined();
    expect(parseSallieContext(null)).toBeUndefined();
    expect(parseSallieContext({ toString: () => 'purple-team' })).toBeUndefined();
  });

  it('page openers end with a question', () => {
    for (const c of Object.values(SALLIE_CONTEXTS)) {
      for (const g of c.greetings) expect(g.text.trim().endsWith('?')).toBe(true);
    }
  });

  it("keeps her page briefs out of the browser bundle's context data", () => {
    for (const c of Object.values(SALLIE_CONTEXTS)) expect(c).not.toHaveProperty('prompt');
  });
});
