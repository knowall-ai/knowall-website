import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { siteIndex } from '@/app/api/chat/site-index';
import { systemPrompt } from '@/app/api/chat/system-prompt';

/**
 * Site index tests
 *
 * Requirements: sallie-chat
 * - Sallie's prompt carries the website guide, including every presentation
 *   deck with its public URL, so she can refer visitors on for more depth
 */

// every deck in the manifest (public/presentations/decks.json)
const DECKS = (
  JSON.parse(
    readFileSync(path.resolve(__dirname, '../../../public/presentations/decks.json'), 'utf8')
  ) as { decks: { slug: string }[] }
).decks.map((deck) => deck.slug);

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
      'https://github.com/knowall-ai/devops-bc-timetracker',
    ]) {
      expect(siteIndex).toContain(url);
    }
    // Agent Presence is internal: offered as a custom project, not a product.
    expect(siteIndex).toMatch(/join Teams calls.*custom AI agent project/);
    // The DevOps time tracker isn't built yet; Sallie must not offer it as available.
    expect(siteIndex).toMatch(/devops-bc-timetracker\) is planned but not available yet/);
  });

  it('never links private repos or domains that do not resolve', () => {
    for (const hidden of [
      'agent-presence',
      'agents-portal',
      'sammie-website',
      'sammie-bot',
      'wardie',
      'zapdesk-msteams',
      'getbook.ie',
    ]) {
      expect(siteIndex).not.toContain(hidden);
    }
  });

  it('tells her to refer visitors to the decks for more depth', () => {
    expect(siteIndex).toMatch(/presentation/i);
    expect(siteIndex).toMatch(/for more (detail|depth|information)/i);
  });
});
