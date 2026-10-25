/**
 * Signature checks for relay data. Relays are untrusted: any relay (or anything
 * in the path to one) can hand back an event that claims to be by KnowAll — a
 * listing with a different price, a shipping option, a story note, a profile —
 * and filtering by `pubkey` alone believes it. Every relay reader runs its cheap
 * filters (kind, author, d-tag) first, then drops anything whose id and Schnorr
 * signature don't verify (NIP-01).
 */

import { verifyEvent } from 'nostr-tools/pure';

/** The minimal event surface relays send (sig optional in our local types). */
interface MaybeSignedEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

/**
 * End-to-end test builds only. The Playwright suite scripts relay data "by"
 * the KnowAll pubkey, which it cannot sign, against a real production build
 * (so modules can't be stubbed). Its webServer builds with
 * NEXT_PUBLIC_E2E_ALLOW_UNSIGNED_RELAY_EVENTS=1, which Next inlines at build
 * time — every other build (CI production build, deploy) compiles this to
 * `false`. Even then, only events with NO signature are let through, and only
 * on localhost; a present-but-wrong signature is always rejected.
 */
const E2E_ALLOW_UNSIGNED = process.env.NEXT_PUBLIC_E2E_ALLOW_UNSIGNED_RELAY_EVENTS === '1';

function isE2eUnsignedFixture(event: Partial<MaybeSignedEvent>): boolean {
  if (!E2E_ALLOW_UNSIGNED || event.sig !== undefined || typeof window === 'undefined') {
    return false;
  }
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * True when `event` is a well-formed Nostr event whose id hashes correctly and
 * whose signature verifies against its pubkey. Never throws — malformed input
 * (missing fields, bad hex) simply fails.
 */
export function isVerifiedEvent(event: unknown): boolean {
  if (!event || typeof event !== 'object') return false;
  const candidate = event as Partial<MaybeSignedEvent>;
  if (isE2eUnsignedFixture(candidate)) return true;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.sig !== 'string' ||
    typeof candidate.pubkey !== 'string' ||
    typeof candidate.kind !== 'number' ||
    typeof candidate.created_at !== 'number' ||
    typeof candidate.content !== 'string' ||
    !Array.isArray(candidate.tags)
  ) {
    return false;
  }
  try {
    return verifyEvent(candidate as Parameters<typeof verifyEvent>[0]);
  } catch {
    return false;
  }
}

/** Keep only the events whose signature verifies (run cheap filters first). */
export function verifiedEvents<T>(events: T[]): T[] {
  return events.filter((event) => isVerifiedEvent(event));
}
