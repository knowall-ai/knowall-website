import type { Greeting } from '@/lib/sallie-greetings';

/**
 * Pages where Sallie should stay on one topic. The page passes its context to
 * SallieAssistant, which picks a matching opener and sends the context with
 * each chat request. The chat route accepts only these keys and adds the
 * matching fixed note to her instructions, so a visitor can't inject text.
 */
export const SALLIE_CONTEXTS = {
  'purple-team': {
    greetings: [
      {
        id: 'pt-break-it',
        text: "Hi, I'm Sallie. You're looking at our Purple Team: Pennie attacks your apps, Ollie defends and fixes, Poppie keeps score. Is your code on GitHub or Azure DevOps?",
      },
      {
        id: 'pt-worry',
        text: "Hello, Sallie here. Hundreds of new vulnerabilities are published every day, so most teams can't keep up. What worries you most: your web apps, your Azure setup, or your AI apps?",
      },
      {
        id: 'pt-pdf',
        text: "Welcome. I'm Sallie, from KnowAll AI. Most pen tests end with a PDF; our Purple Team ends with merged fixes. Shall I explain how it would work for you?",
      },
    ] satisfies Greeting[],
    prompt: `Context: the visitor is on the Purple Team page (/purple-team). Talk about the Purple Team specifically unless they ask about something else.
- Lead with what they get: Pennie probes their code and apps like an attacker would (only with written authorisation), Ollie watches and fixes with pull requests their developers approve, Poppie runs the loop and reports a security score each month.
- Qualify one question at a time: GitHub or Azure DevOps? What should be tested (web apps, APIs, Azure, AI apps and agents, source code)? Any compliance driver (ISO 27001, Cyber Essentials) or recent incident? Do they run Microsoft Defender for Cloud or Sentinel?
- Reassure on safety: nothing is tested without written authorisation, destructive tests are off by default, and every fix goes through their own code review.
- Pricing: agents bill the real hours they work on a KnowAll support plan (CISP); the first step is a Security Discovery that measures their estate and sets their starting score. Don't quote figures you don't have.
- Next step: point them to the enquiry form on this page ([talk to the Purple Team](#enquire)) or hello@knowall.ai.`,
  },
} as const;

export type SallieContext = keyof typeof SALLIE_CONTEXTS;

/** Accept only known contexts; anything else (including injected text) is ignored. */
export function parseSallieContext(value: unknown): SallieContext | undefined {
  return typeof value === 'string' && Object.hasOwn(SALLIE_CONTEXTS, value)
    ? (value as SallieContext)
    : undefined;
}
