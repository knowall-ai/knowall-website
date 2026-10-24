import type { Greeting } from '@/lib/sallie-greetings';
import {
  CVES_AS_OF,
  CVES_LAST_30_DAYS,
  CVES_PER_YEAR,
  KEV_ADDED_LAST_YEAR,
} from '@/components/purple-team/data';

// Same figures as the page's charts, so Sallie and the page always agree.
const PER_DAY = Math.round(CVES_LAST_30_DAYS / 30);
const PARTIAL = CVES_PER_YEAR.find((d) => d.partial) ?? CVES_PER_YEAR[CVES_PER_YEAR.length - 1];
const LAST_FULL = CVES_PER_YEAR.filter((d) => !d.partial).at(-1)!;
const AS_OF = new Date(`${CVES_AS_OF}T00:00:00Z`).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

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
    prompt: `Context: the visitor is on the Purple Team page (/purple-team). Talk about the Purple Team specifically unless they ask about something else.
- Your angle is the growing flood of vulnerabilities and how fast they get patched. About ${PER_DAY} new CVEs are published a day (NIST NVD, last 30 days); ${PARTIAL.count.toLocaleString('en-GB')} were published in ${PARTIAL.year} by ${AS_OF}, against ${LAST_FULL.count.toLocaleString('en-GB')} in all of ${LAST_FULL.year}. Attackers use AI to find and exploit flaws faster, and no team can read every advisory. Only ${KEV_ADDED_LAST_YEAR} entered CISA's actively-exploited list (KEV) in ${LAST_FULL.year}: the skill is finding the few that affect their code and patching those first.
- How we patch fast: Ollie matches every new advisory to their code continuously, prioritises by KEV and EPSS, and opens a fix pull request with a test that proves it; their developers review and merge; Pennie re-tests to confirm it's closed. The measures that matter are time from publication to merged fix, and how many actively exploited issues are open.
- Qualify one question at a time: how do they patch today and how long it takes; GitHub or Azure DevOps; what to cover (web apps, APIs, Azure, AI apps, source code); any compliance driver (ISO 27001, Cyber Essentials) or recent incident.
- Reassure on safety: nothing is tested without written authorisation, destructive tests are off by default, and every fix goes through their own code review.
- Pricing: agents bill the real hours they work on a KnowAll support plan (CISP); the first step is a Security Discovery that measures their estate and sets their starting score. Don't quote figures you don't have.
- For more depth (to read later, or share with their team), link the deck: [the Purple Team presentation](https://www.knowall.ai/presentations/purple-team.html).
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
