/**
 * Cached kind-0 profile lookups for the Story page — commenter names/avatars
 * and the zap recipient's lightning address.
 *
 * Lookups are batched with ONE filter PER AUTHOR in a single REQ (rather than
 * one filter with many authors): purplepag.es — the profile aggregator relay —
 * answers multi-author filters unreliably, but per-author filters always get
 * the newest event. Results (including misses) are cached for the session so
 * expanding the same thread twice costs nothing.
 */

import { PROFILE_RELAYS, queryRelays } from './relay';
import { parseProfileContent, type ProfileMetadata } from './story-social';
import type { NostrEvent } from './story-notes';

// Relays commonly reject REQs with too many filters; stay well under the cap.
const FILTERS_PER_REQ = 10;
const PROFILE_TIMEOUT_MS = 6000;

/** pubkey → parsed metadata, or null when the lookup found nothing. */
const cache = new Map<string, ProfileMetadata | null>();

/** In-flight batches so concurrent callers share one relay round-trip. */
const inFlight = new Map<string, Promise<void>>();

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchBatch(pubkeys: string[]): Promise<void> {
  const filters = pubkeys.map((pubkey) => ({ kinds: [0], authors: [pubkey], limit: 1 }));
  const events = await queryRelays(PROFILE_RELAYS, filters, PROFILE_TIMEOUT_MS);

  // Newest kind-0 per author wins across relays.
  const newest = new Map<string, NostrEvent>();
  for (const event of events) {
    if (event.kind !== 0 || !pubkeys.includes(event.pubkey)) continue;
    const current = newest.get(event.pubkey);
    if (!current || event.created_at > current.created_at) newest.set(event.pubkey, event);
  }

  for (const pubkey of pubkeys) {
    const event = newest.get(pubkey);
    cache.set(pubkey, event ? parseProfileContent(event.content) : null);
  }
}

/**
 * Resolve kind-0 profile metadata for the given pubkeys. Cached results are
 * returned immediately; the rest are fetched from the profile relays. Pubkeys
 * whose profile can't be found are simply absent from the returned map.
 */
export async function fetchProfiles(pubkeys: string[]): Promise<Map<string, ProfileMetadata>> {
  const unique = [...new Set(pubkeys)];
  const pending: Promise<void>[] = [];
  const toFetch: string[] = [];

  for (const pubkey of unique) {
    if (cache.has(pubkey)) continue;
    const existing = inFlight.get(pubkey);
    if (existing) {
      pending.push(existing);
    } else {
      toFetch.push(pubkey);
    }
  }

  for (const batch of chunk(toFetch, FILTERS_PER_REQ)) {
    const request = fetchBatch(batch).finally(() => {
      for (const pubkey of batch) inFlight.delete(pubkey);
    });
    for (const pubkey of batch) inFlight.set(pubkey, request);
    pending.push(request);
  }

  await Promise.all(pending);

  const result = new Map<string, ProfileMetadata>();
  for (const pubkey of unique) {
    const metadata = cache.get(pubkey);
    if (metadata) result.set(pubkey, metadata);
  }
  return result;
}
