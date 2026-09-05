import { describe, it, expect } from 'vitest';
import { SALLIE_EMAIL, signOffMailto, signOffMessage } from '@/lib/sallie-signoff';

/**
 * Sign-off tests
 *
 * Requirements: sallie-chat
 * - When Sallie has to stop she ends nicely and invites email to continue
 */

describe('Sallie sign-off', () => {
  it('links to her email with the conversation reference in the subject', () => {
    expect(signOffMailto('ABC12345')).toBe(
      `mailto:${SALLIE_EMAIL}?subject=Continuing%20our%20chat%20(ref%20ABC12345)`
    );
  });

  it('ends nicely and says the conversation can continue by email', () => {
    const text = signOffMessage('ABC12345');
    expect(text).toContain('Thank you for chatting');
    expect(text).toContain(`[${SALLIE_EMAIL}](mailto:${SALLIE_EMAIL}?subject=`);
    expect(text).toContain('this conversation is saved');
  });
});
