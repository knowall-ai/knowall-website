import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip04 from 'nostr-tools/nip04';
import * as nip19 from 'nostr-tools/nip19';

// Production contact npub (default). Overridable via NEXT_PUBLIC_NOSTR_CONTACT_NPUB
// so the form can be pointed at a throwaway test identity during development.
// Mirrors the merchant-npub pattern used on the Robotechy website.
const PRODUCTION_CONTACT_NPUB = 'npub1jutptdc2m8kgjmudtws095qk2tcale0eemvp4j2xnjnl4nh6669slrf04x';

const CONTACT_NPUB: string = process.env.NEXT_PUBLIC_NOSTR_CONTACT_NPUB || PRODUCTION_CONTACT_NPUB;

// Same relay set as the Robotechy storefront.
export const CONTACT_RELAYS = [
  'wss://relay.ditto.pub',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];

/**
 * Decode an npub to a hex pubkey, falling back to the production contact npub if
 * the value is malformed. NEXT_PUBLIC_NOSTR_CONTACT_NPUB is user-overridable, so
 * a bad value must not throw at module init and crash the page.
 */
function decodeContactPubkey(npub: string): string {
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') return decoded.data;
  } catch {
    // fall through to the production default
  }
  console.warn('Invalid NEXT_PUBLIC_NOSTR_CONTACT_NPUB; falling back to the production npub.');
  return nip19.decode(PRODUCTION_CONTACT_NPUB).data as string;
}

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

/**
 * Send a contact-form message as a NIP-04 encrypted Nostr DM (kind 4) to the
 * KnowAll AI contact pubkey, published to public relays.
 *
 * Website visitors don't have a Nostr identity, so a throwaway (ephemeral)
 * keypair is generated per submission and used to encrypt and sign the DM. The
 * visitor's reply details travel inside the encrypted message body.
 *
 * Resolves when at least one relay accepts the event; rejects if all fail.
 */
export async function sendContactMessage({ name, email, message }: ContactMessage): Promise<void> {
  const recipientPubkey = decodeContactPubkey(CONTACT_NPUB);

  const content = [
    'KnowAll AI website contact form:',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    message,
  ].join('\n');

  // Ephemeral sender identity — one keypair per submission.
  const secretKey = generateSecretKey();
  const encryptedContent = nip04.encrypt(secretKey, recipientPubkey, content);

  const event = finalizeEvent(
    {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey]],
      content: encryptedContent,
    },
    secretKey
  );

  // Sanity check: the event must verify against the ephemeral pubkey.
  if (event.pubkey !== getPublicKey(secretKey)) {
    throw new Error('Failed to sign contact message');
  }

  const pool = new SimplePool();
  try {
    // Succeed as soon as one relay accepts the event.
    await Promise.any(pool.publish(CONTACT_RELAYS, event));
  } catch {
    throw new Error('Could not reach any Nostr relay. Please try again or email us directly.');
  } finally {
    pool.close(CONTACT_RELAYS);
  }
}
