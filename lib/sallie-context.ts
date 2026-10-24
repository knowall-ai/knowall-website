import type { Greeting } from '@/lib/sallie-greetings';

/**
 * Pages where Sallie should stay on one topic. The page passes its context to
 * SallieAssistant, which picks a matching opener and sends the context with
 * each chat request. The chat route accepts only these keys and adds the
 * matching brief from app/api/chat/context-briefs.ts (server-only, so her
 * instructions never ship to the browser), so a visitor can't inject text.
 */
export const SALLIE_CONTEXTS = {
  'purple-team': {
    greetings: [
      {
        id: 'pt-flood',
        text: "Hi, I'm Sallie. Hundreds of new vulnerabilities are published every day now, far more than any team can read. Want to see how we find the few that hit your code and patch them fast?",
      },
      {
        id: 'pt-speed',
        text: 'Hello, Sallie here. Attackers now use AI to find and exploit new flaws faster than ever. Our Purple Team spots the ones in your code and opens the fix for you. How quickly do you patch today?',
      },
      {
        id: 'pt-pdf',
        text: "Welcome. I'm Sallie, from KnowAll AI. Most pen tests end with a PDF; our Purple Team ends with merged fixes. Shall I explain how it would work for you?",
      },
    ] satisfies Greeting[],
    /** Chips shown before the visitor's first message. */
    suggestions: [
      'How would it work for us?',
      'How fast can you patch?',
      'Is it safe to test our live systems?',
      'What does it cost?',
    ],
  },
} as const;

export type SallieContext = keyof typeof SALLIE_CONTEXTS;

/** Accept only known contexts; anything else (including injected text) is ignored. */
export function parseSallieContext(value: unknown): SallieContext | undefined {
  return typeof value === 'string' && Object.hasOwn(SALLIE_CONTEXTS, value)
    ? (value as SallieContext)
    : undefined;
}
