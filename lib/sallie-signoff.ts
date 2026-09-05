/**
 * How Sallie ends a conversation she can't continue right now (a visitor has
 * used their allowance, or the day's budget is spent). The conversation is
 * logged server-side, so an email with the reference lets her pick it up.
 */

export const SALLIE_EMAIL = 'sallie@knowall.ai';

export function signOffMailto(conversationId: string): string {
  const subject = encodeURIComponent(`Continuing our chat (ref ${conversationId})`);
  return `mailto:${SALLIE_EMAIL}?subject=${subject}`;
}

export function signOffMessage(conversationId: string): string {
  return (
    'Thank you for chatting with me — I need to pause here for now, as I can only talk so much in one go. ' +
    `If you'd like to carry on, email me at [${SALLIE_EMAIL}](${signOffMailto(conversationId)}) and I'll pick up right where we left off: ` +
    "this conversation is saved, so you won't need to repeat yourself. It's been lovely talking with you!"
  );
}
