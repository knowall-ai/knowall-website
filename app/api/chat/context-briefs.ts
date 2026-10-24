// Server-only: imported by the chat route alone, so Sallie's page briefs never
// ship in the browser bundle. The client side (openers, chips, allowlist) is in
// lib/sallie-context.ts.
import type { SallieContext } from '@/lib/sallie-context';
import {
  CVES_AS_OF,
  CVES_LAST_30_DAYS,
  CVES_PER_YEAR,
  KEV_ADDED_LAST_YEAR,
  KEV_YEAR,
} from '@/components/purple-team/data';

// Same figures as the page's charts, so Sallie and the page always agree. The
// series is ordered by year: the latest entry is this year (partial), the one
// before it the last full year.
const PER_DAY = Math.round(CVES_LAST_30_DAYS / 30);
const PARTIAL = CVES_PER_YEAR[CVES_PER_YEAR.length - 1];
const LAST_FULL = [...CVES_PER_YEAR].reverse().find((d) => !d.partial) ?? PARTIAL;
const AS_OF = new Date(`${CVES_AS_OF}T00:00:00Z`).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** Extra instructions appended after the shared prompt for each page context. */
export const CONTEXT_BRIEFS: Record<SallieContext, string> = {
  'purple-team': `Context: the visitor is on the Purple Team page (/purple-team). Talk about the Purple Team specifically unless they ask about something else.
- Your angle is the growing flood of vulnerabilities and how fast they get patched. About ${PER_DAY} new CVEs are published a day (NIST NVD, last 30 days); ${PARTIAL.count.toLocaleString('en-GB')} were published in ${PARTIAL.year} by ${AS_OF}, against ${LAST_FULL.count.toLocaleString('en-GB')} in all of ${LAST_FULL.year}. Attackers use AI to find and exploit flaws faster, and no team can read every advisory. Only ${KEV_ADDED_LAST_YEAR} entered CISA's actively-exploited list (KEV) in ${KEV_YEAR}: the skill is finding the few that affect their code and patching those first.
- How we patch fast: Ollie matches every new advisory to their code continuously, prioritises by KEV and EPSS, and opens a fix pull request with a test that proves it; their developers review and merge; Pennie re-tests to confirm it's closed. The measures that matter are time from publication to merged fix, and how many actively exploited issues are open.
- Qualify one question at a time: how do they patch today and how long it takes; GitHub or Azure DevOps; what to cover (web apps, APIs, Azure, AI apps, source code); any compliance driver (ISO 27001, Cyber Essentials) or recent incident.
- Reassure on safety: nothing is tested without written authorisation, destructive tests are off by default, and every fix goes through their existing review process.
- Pricing: agents bill the real hours they work on a KnowAll support plan (CISP); the first step is a Security Discovery that measures their estate and sets their starting score. Don't quote figures you don't have.
- For more depth (to read later, or share with their team), link the deck: [the Purple Team presentation](https://www.knowall.ai/presentations/purple-team.html).
- Next step: point them to the enquiry form on this page ([talk to the Purple Team](#enquire)) or hello@knowall.ai.`,
};

/** Exposed for tests. */
export const BRIEF_FIGURES = { PER_DAY, PARTIAL, LAST_FULL, KEV_YEAR };
