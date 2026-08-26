/**
 * Moderation of third-party Nostr content via the company's public NIP-51
 * mute list (kind 10000, a replaceable event on the KnowAll AI account):
 *
 *   - `p` tags mute every event by that author,
 *   - `e` tags mute individual events.
 *
 * To block someone, mute them from any Nostr client signed in as the KnowAll
 * npub (Amethyst, Damus, …) — or use the in-site mute button, which appears
 * on community content when signed in as the company account. Either way the
 * site picks the change up on the next page load; no deploy needed.
 *
 * Only the PUBLIC tags are honoured: NIP-51 private (encrypted-content) mutes
 * are ignored by the site, but `buildMuteListTemplate` preserves the content
 * field verbatim so in-site mutes never destroy them. When the mute list
 * cannot be fetched the site fails open (renders unfiltered) — moderation is
 * best-effort, never an availability risk.
 */

import { verifyEvent } from 'nostr-tools/pure';
import { KNOWALL_PUBKEY } from './nostr';
import { SOCIAL_RELAYS, publishToRelays, queryRelaysDetailed } from './relay';
import type { EventTemplate } from './story-social';
import type { NostrEvent } from './story-notes';

export const MUTE_LIST_KIND = 10000;
const MUTE_LIST_TIMEOUT_MS = 6000;

/** The public portion of the mute list, as sets for O(1) render-time checks. */
export interface Blocklist {
  pubkeys: ReadonlySet<string>;
  eventIds: ReadonlySet<string>;
}

const EMPTY_BLOCKLIST: Blocklist = { pubkeys: new Set(), eventIds: new Set() };

/**
 * True when an event's id and Schnorr signature verify (NIP-01). Relay
 * responses are untrusted input: without this check a malicious relay could
 * hand back a forged "company" mute list that censors arbitrary authors — and
 * `muteUser` would even copy the forged tags into a genuinely signed
 * replacement.
 */
function isAuthentic(event: NostrEvent): boolean {
  const { sig } = event;
  if (typeof sig !== 'string') return false;
  try {
    return verifyEvent({ ...event, sig });
  } catch {
    return false;
  }
}

/**
 * Pick the company's current mute list out of a relay result: kind 10000 is
 * replaceable, so the newest VERIFIED event by the expected author wins
 * (stale relays may still serve older revisions; hostile ones may serve
 * forgeries, which fail signature verification and are ignored). Ties on
 * created_at follow NIP-01's replaceable-event rule: the lexically lower id
 * is the retained revision.
 */
export function selectMuteList(
  events: NostrEvent[],
  author: string = KNOWALL_PUBKEY
): NostrEvent | null {
  let newest: NostrEvent | null = null;
  for (const event of events) {
    if (event.kind !== MUTE_LIST_KIND || event.pubkey !== author) continue;
    if (newest) {
      if (event.created_at < newest.created_at) continue;
      if (event.created_at === newest.created_at && event.id >= newest.id) continue;
    }
    if (!isAuthentic(event)) continue;
    newest = event;
  }
  return newest;
}

/**
 * Extract the public `p` (muted author) and `e` (muted event) tags of a mute
 * list into a Blocklist. Other tag types (`t`, `word`, …) and the encrypted
 * content (private mutes) are deliberately ignored. Hex is normalised to
 * lowercase. A missing mute list yields an empty blocklist.
 */
export function buildBlocklist(muteList: Pick<NostrEvent, 'tags'> | null): Blocklist {
  const pubkeys = new Set<string>();
  const eventIds = new Set<string>();
  for (const tag of muteList?.tags ?? []) {
    if (typeof tag[1] !== 'string' || tag[1].length === 0) continue;
    if (tag[0] === 'p') pubkeys.add(tag[1].toLowerCase());
    else if (tag[0] === 'e') eventIds.add(tag[1].toLowerCase());
  }
  return { pubkeys, eventIds };
}

/**
 * True when an event is muted — authored by a muted pubkey or individually
 * muted by id. The company's own events are never blocked, even if the mute
 * list somehow lists them (a self-mute must not blank the site's own feed).
 */
export function isBlocked(event: Pick<NostrEvent, 'pubkey' | 'id'>, blocklist: Blocklist): boolean {
  const pubkey = event.pubkey.toLowerCase();
  if (pubkey === KNOWALL_PUBKEY) return false;
  return blocklist.pubkeys.has(pubkey) || blocklist.eventIds.has(event.id.toLowerCase());
}

/** Convenience: drop every blocked event, preserving order. */
export function filterBlocked<T extends Pick<NostrEvent, 'pubkey' | 'id'>>(
  events: T[],
  blocklist: Blocklist
): T[] {
  return events.filter((event) => !isBlocked(event, blocklist));
}

/**
 * Build the replacement kind-10000 event that additionally mutes `pubkey`.
 *
 * Kind 10000 is replaceable, so publishing clobbers the previous revision —
 * the CURRENT event's tags and content must therefore be carried over
 * verbatim (content holds any NIP-51 private mutes; foreign tag types are
 * preserved untouched). The new `p` tag is appended only when not already
 * present. Passing `current: null` starts a fresh list.
 *
 * The replacement is stamped strictly later than the current revision: a
 * same-second replacement would be tie-broken by lexical event id (NIP-01),
 * so a rapid consecutive mute could otherwise silently lose.
 */
export function buildMuteListTemplate(
  current: Pick<NostrEvent, 'tags' | 'content' | 'created_at'> | null,
  pubkey: string,
  now: number = Math.floor(Date.now() / 1000)
): EventTemplate {
  const tags = (current?.tags ?? []).map((tag) => [...tag]);
  const normalized = pubkey.toLowerCase();
  const alreadyMuted = tags.some(
    (tag) => tag[0] === 'p' && typeof tag[1] === 'string' && tag[1].toLowerCase() === normalized
  );
  if (!alreadyMuted) tags.push(['p', normalized]);
  return {
    kind: MUTE_LIST_KIND,
    created_at: Math.max(now, (current?.created_at ?? 0) + 1),
    tags,
    content: current?.content ?? '',
  };
}

/**
 * Fetch the company's current mute list event from the social relays, along
 * with how many relays answered authoritatively — zero responders means the
 * list's existence is UNKNOWN, not that no list exists.
 */
async function fetchMuteList(): Promise<{
  muteList: NostrEvent | null;
  respondedRelays: number;
}> {
  const { events, respondedRelays } = await queryRelaysDetailed(
    SOCIAL_RELAYS,
    [{ kinds: [MUTE_LIST_KIND], authors: [KNOWALL_PUBKEY], limit: 1 }],
    MUTE_LIST_TIMEOUT_MS
  );
  return { muteList: selectMuteList(events), respondedRelays };
}

/** Page-load cache so every render path shares one relay round-trip. */
let cachedBlocklist: Promise<Blocklist> | null = null;

/**
 * The company's blocklist, fetched once per page load and shared by every
 * caller. Never rejects: when the relays are unreachable it resolves to an
 * empty blocklist (fail open).
 */
export function getBlocklist(): Promise<Blocklist> {
  cachedBlocklist ??= fetchMuteList()
    .then(({ muteList }) => buildBlocklist(muteList))
    .catch(() => EMPTY_BLOCKLIST);
  return cachedBlocklist;
}

/** Test hook: clear the page-load blocklist cache. */
export function resetBlocklistCache(): void {
  cachedBlocklist = null;
}

/**
 * Mute an author as the company account (in-site moderation): re-fetch the
 * CURRENT mute list (never trust the page-load cache for a write — another
 * client may have revised the list since), merge the new `p` tag into it,
 * sign via the NIP-07 signer, and publish. On success the page-load cache is
 * updated in place so subsequent fetches on this page filter immediately.
 *
 * Throws when the current list cannot be determined, the signer declines, or
 * no relay accepts the event — a failure must never publish a blank
 * replacement that clobbers the real list. Creating a FRESH list (current not
 * found) is allowed only when at least one relay answered authoritatively
 * (EOSE) that it has none: in a partial outage where every relay timed out,
 * the mute is aborted before signing rather than risking an empty replacement
 * overwriting the real list on relays that are still writable.
 */
export async function muteUser(
  pubkey: string,
  signEvent: (template: EventTemplate) => Promise<NostrEvent>
): Promise<void> {
  const { muteList: current, respondedRelays } = await fetchMuteList();
  if (!current && respondedRelays === 0) {
    throw new Error('Could not reach any relay to load the current mute list. Please try again.');
  }
  const signed = await signEvent(buildMuteListTemplate(current, pubkey));
  await publishToRelays(SOCIAL_RELAYS, signed);
  cachedBlocklist = Promise.resolve(buildBlocklist(signed));
}
