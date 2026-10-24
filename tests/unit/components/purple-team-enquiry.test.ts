import { describe, expect, it } from 'vitest';
import { enquiryMessage, enquirySchema } from '@/components/purple-team/enquiry-form';

/**
 * Purple Team enquiry form
 *
 * Requirements: purple-team-page
 * - Visitors give their name, email, organisation, where their code lives and
 *   what they want tested; the message itself is optional
 * - The enquiry reaches the team as one tidy, scannable message
 */

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  company: 'Analytical Engines Ltd',
  platform: 'Azure DevOps' as const,
  scope: ['Web apps' as const, 'AI apps & agents' as const],
};

describe('purple team enquiry', () => {
  it('accepts a complete enquiry without a message', () => {
    expect(enquirySchema.safeParse(valid).success).toBe(true);
  });

  it('requires a platform and at least one area to test', () => {
    const result = enquirySchema.safeParse({ ...valid, platform: undefined, scope: [] });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['platform', 'scope']));
  });

  it('rejects an invalid email', () => {
    expect(enquirySchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });

  it('builds a labelled message for the team', () => {
    const text = enquiryMessage({ ...valid, message: '  ISO 27001 audit in March  ' });
    expect(text.split('\n')[0]).toBe('Purple Team enquiry');
    expect(text).toContain('Organisation: Analytical Engines Ltd');
    expect(text).toContain('Code lives in: Azure DevOps');
    expect(text).toContain('Wants tested: Web apps, AI apps & agents');
    expect(text).toContain('ISO 27001 audit in March');
  });

  it('says so when there are no further details', () => {
    expect(enquiryMessage(valid)).toContain('(no further details)');
  });
});
