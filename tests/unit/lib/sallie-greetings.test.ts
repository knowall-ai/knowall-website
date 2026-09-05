import { describe, it, expect } from 'vitest';
import { GREETINGS, pickGreeting } from '@/lib/sallie-greetings';

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
});
