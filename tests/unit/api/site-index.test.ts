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

  it('links our other products, sites and open-source projects', () => {
    for (const url of [
      'https://getzapl.ie',
      'https://sergeantsamm.ie',
      'https://github.com/knowall-ai/bookie',
      'https://agents.knowall.ai',
      'https://github.com/knowall-ai/agent-pulse',
      'https://github.com/knowall-ai/mcp-reverie',
      'https://github.com/knowall-ai/mcp-business-central',
      'https://github.com/knowall-ai/ms-365-mcp-server',
      'https://github.com/knowall-ai/nodie',
      'https://github.com/knowall-ai/zendesk-zapdesk',
      'https://github.com/knowall-ai/thyme-bc-extension',
    ]) {
      expect(siteIndex).toContain(url);
    }
    expect(siteIndex).toContain('Agent Presence');
  });

  it('tells her to refer visitors to the decks for more depth', () => {
    expect(siteIndex).toMatch(/presentation/i);
    expect(siteIndex).toMatch(/for more (detail|depth|information)/i);
  });
});
