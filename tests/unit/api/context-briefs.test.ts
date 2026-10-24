import { describe, expect, it } from 'vitest';
import { BRIEF_FIGURES, CONTEXT_BRIEFS } from '@/app/api/chat/context-briefs';
import { CVES_PER_YEAR, KEV_ADDED_LAST_YEAR } from '@/components/purple-team/data';

/**
 * Sallie's Purple Team brief quotes the page's own figures. Guard the years so
 * adding a new year (or forgetting the KEV year) can't misattribute a number.
 */
describe('Purple Team brief figures', () => {
  it('quotes this year (partial) against the last full year', () => {
    expect(BRIEF_FIGURES.PARTIAL).toBe(CVES_PER_YEAR[CVES_PER_YEAR.length - 1]);
    expect(BRIEF_FIGURES.PARTIAL.partial).toBe(true);
    expect(BRIEF_FIGURES.LAST_FULL.partial).toBeFalsy();
    expect(BRIEF_FIGURES.LAST_FULL.year).toBe(BRIEF_FIGURES.PARTIAL.year - 1);
  });

  it('labels the KEV count with its own year', () => {
    expect(CONTEXT_BRIEFS['purple-team']).toContain(
      `Only ${KEV_ADDED_LAST_YEAR} entered CISA's actively-exploited list (KEV) in ${BRIEF_FIGURES.KEV_YEAR}`
    );
  });
});
