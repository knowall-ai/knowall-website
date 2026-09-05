import { describe, it, expect } from 'vitest';
import { siteIndex } from '@/app/api/chat/site-index';
import { systemPrompt } from '@/app/api/chat/system-prompt';

/**
 * Site index tests
 *
 * Requirements: sallie-chat
 * - Sallie's prompt carries the website guide, including every presentation
 *   deck with its public URL, so she can refer visitors on for more depth
 */

const DECKS = [
  'company-overview',
  'ai-discovery',
  'agentic-delivery',
  'cisp',
  'agentic-ai-solutions',
];

describe('site index', () => {
  it('is part of the system prompt', () => {
    expect(systemPrompt).toContain(siteIndex);
  });

  it('lists the presentations index and every deck by URL', () => {
    expect(siteIndex).toContain('https://www.knowall.ai/presentations/');
    for (const deck of DECKS) {
      expect(siteIndex).toContain(`https://www.knowall.ai/presentations/${deck}.html`);
    }
  });

  it('tells her to refer visitors to the decks for more depth', () => {
    expect(siteIndex).toMatch(/presentation/i);
    expect(siteIndex).toMatch(/for more (detail|depth|information)/i);
  });
});
