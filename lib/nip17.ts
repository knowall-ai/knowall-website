/**
 * NIP-17 gift-wrapped messaging for the checkout, ported from robotechy.com's
 * commerce DM path (DMProvider.sendNIP17Message + the nip59-based
 * order-service wrapping its tests pin down).
 *
 * Every order artefact travels as a gift wrap: the inner rumor (kind 16 order,
 * kind 14 readable summary, kind 17 payment receipt) is NIP-44 encrypted into
 * a kind-13 seal authored by the buyer, and the seal is NIP-44 encrypted into
 * a kind-1059 wrap signed by a single-use random key — so relays see neither
 * the buyer's identity nor any order/PII plaintext. Wrap timestamps are
 * randomised up to two days into the past (NIP-59 metadata privacy).
 *
 * Buyer identity, exactly as robotechy handles it: a signed-in NIP-07 user
 * orders under their own key (their extension does the NIP-44 work); an
 * anonymous buyer gets a locally generated order key, persisted in
 * localStorage so the payment request — and any later merchant DMs — can
 * still be decrypted in-page.
 */

import * as nip44 from 'nostr-tools/nip44';
import { wrapEvent } from 'nostr-tools/nip59';
import { finalizeEvent, generateSecretKey, getEventHash, getPublicKey } from 'nostr-tools/pure';
import type { NostrEvent } from './story-notes';
import type { EventTemplate } from './story-social';

export const GIFT_WRAP_KIND = 1059;
export const SEAL_KIND = 13;

/** NIP-59: wrap/seal timestamps are fuzzed up to 2 days into the PAST. */
const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

const randomPastTimestamp = (now = Math.floor(Date.now() / 1000)) =>
  now - Math.floor(Math.random() * TWO_DAYS_SECONDS);

/* ---------------------------------------------------------------------------
 * Buyer identity
 * ------------------------------------------------------------------------- */

const BUYER_KEY_STORAGE = 'knowall.shop.buyer-key';

/** Who is placing the order, and how their side of NIP-44 is performed. */
export interface BuyerIdentity {
  pubkey: string;
  /** 'nip07' = extension does the crypto; 'local' = in-page order key. */
  kind: 'nip07' | 'local';
  /** Present only for 'local' identities. */
  secretKey?: Uint8Array;
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array | null => {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};

/**
 * The anonymous buyer's persistent local order key, created on first use.
 * Kept in localStorage so this browser can decrypt the merchant's payment
 * request and any follow-up DMs for past orders.
 */
export function getOrCreateLocalBuyerKey(): Uint8Array {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(BUYER_KEY_STORAGE);
  } catch {
    // localStorage unavailable — fall through to an in-memory key.
  }
  const existing = stored ? fromHex(stored) : null;
  if (existing) return existing;

  const secretKey = generateSecretKey();
  try {
    window.localStorage.setItem(BUYER_KEY_STORAGE, toHex(secretKey));
  } catch {
    // Best-effort persistence; the order still works for this session.
  }
  return secretKey;
}

/** Build a 'local' BuyerIdentity from a secret key. */
export function localBuyerIdentity(secretKey: Uint8Array): BuyerIdentity {
  return { pubkey: getPublicKey(secretKey), kind: 'local', secretKey };
}

/* ---------------------------------------------------------------------------
 * Wrapping (outgoing rumors)
 * ------------------------------------------------------------------------- */

/** The NIP-07 nip44 surface used for extension-side wrapping/unwrapping. */
interface Nip07Nip44 {
  encrypt: (pubkey: string, plaintext: string) => Promise<string>;
  decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
}

interface Nip07Signer {
  signEvent?: (event: EventTemplate) => Promise<NostrEvent>;
  nip44?: Nip07Nip44;
}

/** The window.nostr surface, if present (typed in the auth provider). */
function nip07(): Nip07Signer | undefined {
  return typeof window === 'undefined' ? undefined : (window as { nostr?: Nip07Signer }).nostr;
}

/** True when the installed extension can do NIP-17 (sign seals + NIP-44). */
export function nip07SupportsGiftWrap(): boolean {
  const signer = nip07();
  return Boolean(signer?.signEvent && signer.nip44?.encrypt && signer.nip44.decrypt);
}

/**
 * Gift-wrap a rumor to `recipientPubkey` as the given buyer.
 *
 * Local identities use nostr-tools' canonical nip59 wrap (signed seal — the
 * same primitives robotechy's order-service pins in its tests). NIP-07
 * identities build the same envelope by hand: the extension NIP-44-encrypts
 * the rumor and signs the kind-13 seal, then a random single-use key signs
 * the kind-1059 wrap so the buyer's key never appears on the outside.
 */
export async function wrapRumor(
  template: EventTemplate,
  buyer: BuyerIdentity,
  recipientPubkey: string
): Promise<NostrEvent> {
  if (buyer.kind === 'local') {
    if (!buyer.secretKey) throw new Error('Local buyer identity is missing its key.');
    return wrapEvent(template, buyer.secretKey, recipientPubkey) as NostrEvent;
  }

  const signer = nip07();
  if (!signer?.signEvent || !signer.nip44) {
    throw new Error('Your Nostr extension does not support encrypted DMs (NIP-44).');
  }

  // Rumor: the unsigned inner event, id computed, authored by the buyer.
  const rumor = { ...template, pubkey: buyer.pubkey };
  const rumorWithId = { ...rumor, id: getEventHash({ ...rumor, sig: '' } as never) };

  // Seal (kind 13): rumor encrypted buyer -> recipient, signed by the buyer.
  const seal = await signer.signEvent({
    kind: SEAL_KIND,
    content: await signer.nip44.encrypt(recipientPubkey, JSON.stringify(rumorWithId)),
    tags: [],
    created_at: randomPastTimestamp(),
  });

  // Wrap (kind 1059): seal encrypted random-key -> recipient, signed by the
  // random key. Only the recipient `p` tag is visible to relays.
  const wrapSecretKey = generateSecretKey();
  const conversationKey = nip44.v2.utils.getConversationKey(wrapSecretKey, recipientPubkey);
  return finalizeEvent(
    {
      kind: GIFT_WRAP_KIND,
      content: nip44.v2.encrypt(JSON.stringify(seal), conversationKey),
      tags: [['p', recipientPubkey]],
      created_at: randomPastTimestamp(),
    },
    wrapSecretKey
  ) as NostrEvent;
}

/* ---------------------------------------------------------------------------
 * Unwrapping (incoming gift wraps)
 * ------------------------------------------------------------------------- */

/**
 * Unwrap a kind-1059 gift wrap addressed to the buyer and return the inner
 * rumor, or null when it can't be decrypted / isn't a valid NIP-59 envelope.
 *
 * Sender authentication (ported from robotechy's DMProvider): the seal's
 * author is the authenticated sender — its content only decrypts when keyed
 * to the genuine seal pubkey — and the rumor's pubkey MUST match the seal's,
 * otherwise the rumor's sender was forged and the message is rejected.
 */
export async function unwrapGiftWrap(
  wrap: NostrEvent,
  buyer: BuyerIdentity
): Promise<NostrEvent | null> {
  if (wrap.kind !== GIFT_WRAP_KIND) return null;

  // Both identity kinds run the same two-step decrypt; only the NIP-44
  // primitive differs (in-page key vs the extension).
  let decrypt: (peerPubkey: string, ciphertext: string) => Promise<string> | string;
  if (buyer.kind === 'local') {
    const secretKey = buyer.secretKey;
    if (!secretKey) return null;
    decrypt = (peerPubkey, ciphertext) =>
      nip44.v2.decrypt(ciphertext, nip44.v2.utils.getConversationKey(secretKey, peerPubkey));
  } else {
    const signer = nip07();
    if (!signer?.nip44) return null;
    decrypt = signer.nip44.decrypt;
  }

  try {
    const seal = JSON.parse(await decrypt(wrap.pubkey, wrap.content)) as NostrEvent;
    if (seal.kind !== SEAL_KIND) return null;

    const rumor = JSON.parse(await decrypt(seal.pubkey, seal.content)) as NostrEvent;
    if (rumor.pubkey !== seal.pubkey) return null; // forged sender — reject
    return rumor;
  } catch {
    return null;
  }
}
