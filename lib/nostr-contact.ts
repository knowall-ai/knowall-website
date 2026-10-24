import { SimplePool } from 'nostr-tools/pool';
import type { Event } from 'nostr-tools/core';
import * as nip19 from 'nostr-tools/nip19';
import { KNOWALL_NPUB } from '@/lib/contact';
import { nip07SupportsGiftWrap, wrapRumor } from '@/lib/nip17';

// Where signed-in visitors' DMs go: the KnowAll AI company npub. Overridable
// via NEXT_PUBLIC_NOSTR_CONTACT_NPUB so development can point at a test identity.
const CONTACT_NPUB: string = process.env.NEXT_PUBLIC_NOSTR_CONTACT_NPUB || KNOWALL_NPUB;

// Same relay set as the Robotechy storefront.
export const CONTACT_RELAYS = [
  'wss://relay.ditto.pub',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];

/**
 * Decode an npub to a hex pubkey, falling back to the KnowAll npub if the value
 * is malformed. NEXT_PUBLIC_NOSTR_CONTACT_NPUB is user-overridable, so a bad
 * value must not throw and break the form.
 */
function decodeContactPubkey(npub: string): string {
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') return decoded.data;
  } catch {
    // fall through to the company default
  }
  console.warn('Invalid NEXT_PUBLIC_NOSTR_CONTACT_NPUB; falling back to the KnowAll npub.');
  return nip19.decode(KNOWALL_NPUB).data as string;
}

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
  /** Optional subject label, e.g. "Purple Team". */
  topic?: string;
}

export interface ContactOptions {
  /** The visitor's pubkey (hex) when they're signed in with a Nostr extension. */
  nostrPubkey?: string | null;
}

export type ContactChannel = 'nostr' | 'email';

/**
 * Send a contact-form message.
 *
 * - Signed in with a Nostr extension that can encrypt (NIP-44): a NIP-17
 *   private DM from the visitor's own key to the KnowAll AI npub, so we can
 *   reply to them on Nostr.
 * - Everyone else: an email to hello@knowall.ai from Sallie's mailbox, sent by
 *   /api/contact with Reply-To set to the visitor. No throwaway keys.
 *
 * Resolves with the channel used; rejects with a message fit to show the visitor.
 */
export async function sendContactMessage(
  msg: ContactMessage,
  opts: ContactOptions = {}
): Promise<ContactChannel> {
  if (opts.nostrPubkey && nip07SupportsGiftWrap()) {
    await sendNostrDm(msg, opts.nostrPubkey);
    // Email a copy too, in case nobody is watching the DMs. The DM already
    // arrived, so a failed copy doesn't fail the send.
    await sendEmail({ ...msg, nostrNpub: nip19.npubEncode(opts.nostrPubkey) }).catch((err) =>
      console.warn('Contact form: DM sent but the email copy failed', err)
    );
    return 'nostr';
  }
  await sendEmail(msg);
  return 'email';
}

function messageText({ name, email, message, topic }: ContactMessage): string {
  return [
    `KnowAll AI website enquiry${topic ? ` (${topic})` : ''}:`,
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    message,
  ].join('\n');
}

async function sendNostrDm(msg: ContactMessage, senderPubkey: string): Promise<void> {
  const recipient = decodeContactPubkey(CONTACT_NPUB);
  // NIP-17: a kind-14 chat message, sealed by the visitor's extension and
  // gift-wrapped so relays see neither sender nor content.
  const wrap = await wrapRumor(
    {
      kind: 14,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipient]],
      content: messageText(msg),
    },
    { pubkey: senderPubkey, kind: 'nip07' },
    recipient
  );

  if (!wrap.sig) throw new Error('Could not sign your message. Please email hello@knowall.ai.');
  const signed: Event = { ...wrap, sig: wrap.sig };

  const pool = new SimplePool();
  try {
    // Succeed as soon as one relay accepts the event.
    await Promise.any(pool.publish(CONTACT_RELAYS, signed));
  } catch {
    throw new Error('Could not reach any Nostr relay. Please try again or email hello@knowall.ai.');
  } finally {
    pool.close(CONTACT_RELAYS);
  }
}

async function sendEmail(msg: ContactMessage & { nostrNpub?: string }): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });
  } catch {
    throw new Error('Could not send your message. Please email hello@knowall.ai.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Could not send your message. Please email hello@knowall.ai.');
  }
}
