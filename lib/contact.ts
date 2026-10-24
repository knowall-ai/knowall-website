import { z } from 'zod';

/** The KnowAll AI company Nostr account: where signed-in visitors' DMs go. */
export const KNOWALL_NPUB = 'npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar';

/** What a guest enquiry carries to /api/contact (shared by the form and the route). */
export const enquiryPayloadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(10).max(5000),
  /** Optional label for the subject line, e.g. "Purple Team". */
  topic: z.string().trim().max(40).optional(),
  /**
   * Set by the browser when the visitor is signed in with Nostr and also sent a
   * DM. Visitor-supplied and unverified: the email says so.
   */
  nostrNpub: z
    .string()
    .regex(/^npub1[02-9ac-hj-np-z]{58}$/)
    .optional(),
  /** Honeypot: hidden from people, filled in by naive bots. */
  website: z.string().max(200).optional(),
});

export type EnquiryPayload = z.infer<typeof enquiryPayloadSchema>;

/** Subject and body of the email Sallie sends to hello@. */
export function enquiryEmail(p: EnquiryPayload, page?: string) {
  const subject = `Website enquiry${p.topic ? ` (${p.topic})` : ''} from ${p.name}`;
  const text = [
    `New enquiry from the KnowAll AI website${p.topic ? ` (${p.topic})` : ''}.`,
    '',
    `Name: ${p.name}`,
    `Email: ${p.email}`,
    ...(p.nostrNpub ? [`Nostr (given by the visitor, not verified): ${p.nostrNpub}`] : []),
    ...(page ? [`Page: ${page}`] : []),
    '',
    ...(p.nostrNpub
      ? [
          'Their browser says they are signed in with Nostr and also sent this as a private DM to the KnowAll AI npub. Check the Nostr inbox before treating that npub as theirs.',
          '',
        ]
      : []),
    p.message,
    '',
    '—',
    'Reply to this email to answer them directly.',
    'Sent by Sallie from the knowall.ai contact form.',
  ].join('\n');
  return { subject, text };
}
