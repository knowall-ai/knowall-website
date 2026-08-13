/**
 * Pure helpers for the Story page's social actions — kind-1 reply threading
 * (NIP-10), kind-3 contact-list follows (NIP-02), and NIP-57 zap accounting
 * (kind-9734 requests / kind-9735 receipts, LNURL-pay resolution).
 *
 * Like lib/story-notes.ts, this module is free of React and browser
 * dependencies so every branch can be unit-tested directly. Mirrors the
 * story/comments implementation on edenweeks.art.
 */

import type { NostrEvent } from './story-notes';

/** An unsigned event, as handed to a NIP-07 signer's `signEvent`. */
export interface EventTemplate {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

/* ---------------------------------------------------------------------------
 * Replies (kind 1, NIP-10 marked tags)
 * ------------------------------------------------------------------------- */

/**
 * Build NIP-10 tags for a kind-1 reply to a top-level story post.
 *
 * The story post is itself a root (top-level) note, so the reply marks it as
 * the `root` and `p`-tags the note's author, per NIP-10's marked-tag scheme.
 * Extra pubkeys (e.g. the KnowAll account when replying to a post it didn't
 * author) are appended as additional `p` tags, deduplicated.
 */
export function buildReplyTags(
  parent: Pick<NostrEvent, 'id' | 'pubkey'>,
  extraPubkeys: string[] = []
): string[][] {
  const tags: string[][] = [['e', parent.id, '', 'root']];
  const seen = new Set<string>();
  for (const pubkey of [parent.pubkey, ...extraPubkeys]) {
    if (seen.has(pubkey)) continue;
    seen.add(pubkey);
    tags.push(['p', pubkey]);
  }
  return tags;
}

/**
 * True when a kind-1 event references the given note id through a threading
 * `e` tag, i.e. it is a reply in that note's thread.
 *
 * Per NIP-10, an `e` tag whose marker is `mention` is a non-threading
 * reference (a quote of the note), so it is excluded — only `root`, `reply`,
 * or unmarked `e` tags count as being in the thread.
 */
export function isReplyToNote(event: NostrEvent, noteId: string): boolean {
  return event.tags.some((tag) => tag[0] === 'e' && tag[1] === noteId && tag[3] !== 'mention');
}

/** Sort replies oldest-first — newest-last, the natural reading order. */
export function sortRepliesChronologically(events: NostrEvent[]): NostrEvent[] {
  return [...events].sort((a, b) => a.created_at - b.created_at);
}

/**
 * Group a batched relay result (kind-1 events fetched with one `#e` filter
 * covering many note ids) into per-note reply threads. Events are deduplicated
 * by id, non-kind-1 events are ignored, and each thread is sorted oldest-first.
 * Every requested note id gets an entry (empty array when nothing replied).
 */
export function groupRepliesByNote(
  events: NostrEvent[],
  noteIds: string[]
): Map<string, NostrEvent[]> {
  const byNote = new Map<string, NostrEvent[]>(noteIds.map((id) => [id, []]));
  const seen = new Set<string>();
  for (const event of events) {
    if (event.kind !== 1 || seen.has(event.id)) continue;
    seen.add(event.id);
    for (const noteId of noteIds) {
      if (isReplyToNote(event, noteId)) byNote.get(noteId)!.push(event);
    }
  }
  for (const [noteId, replies] of byNote) {
    byNote.set(noteId, sortRepliesChronologically(replies));
  }
  return byNote;
}

/* ---------------------------------------------------------------------------
 * Follows (kind 3, NIP-02 contact list)
 * ------------------------------------------------------------------------- */

/** True if `tags` already contains a `['p', pubkey]` follow entry. */
export function isFollowing(tags: string[][], pubkey: string): boolean {
  return tags.some(([name, value]) => name === 'p' && value === pubkey);
}

/**
 * Return a new tags array that follows `pubkey`: the original tags (all `p`
 * follows and any other tags preserved verbatim, including relay/petname
 * columns) plus a `['p', pubkey]` entry if it is not already present.
 *
 * The input array is never mutated — kind-3 is destructive if mishandled, so
 * the caller must always publish the full preserved list.
 */
export function addFollow(tags: string[][], pubkey: string): string[][] {
  if (isFollowing(tags, pubkey)) {
    return tags.map((tag) => [...tag]);
  }
  return [...tags.map((tag) => [...tag]), ['p', pubkey]];
}

/* ---------------------------------------------------------------------------
 * Zaps (NIP-57) — receipts accounting
 * ------------------------------------------------------------------------- */

/**
 * Parse the amount (in satoshis) encoded in a bolt11 invoice's human-readable
 * prefix, e.g. `lnbc2500u…` → 250 000 sats. Returns null when the invoice has
 * no amount or doesn't look like bolt11. Fractional-sat amounts floor to the
 * whole sat.
 */
export function parseBolt11AmountSats(bolt11: string): number | null {
  const match = /^ln(?:bc|tbs?|bcrt)(\d+)([munp])?1/i.exec(bolt11.trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  if (!Number.isFinite(amount)) return null;
  // Amount is in BTC scaled by the multiplier; 1 BTC = 1e8 sats.
  const multiplier = { m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12 }[
    (match[2] ?? '').toLowerCase() as 'm' | 'u' | 'n' | 'p'
  ];
  return Math.floor(amount * (multiplier ?? 1) * 1e8);
}

/**
 * Extract the sat amount from a kind-9735 zap receipt, trying (in order):
 *  1. an `amount` tag (millisats, occasionally copied onto the receipt),
 *  2. the `bolt11` tag's invoice amount,
 *  3. the `amount` tag inside the `description` tag's embedded zap request.
 * Returns 0 when no amount can be recovered.
 */
export function zapReceiptSats(receipt: NostrEvent): number {
  const tagValue = (event: { tags: string[][] }, name: string): string | undefined =>
    event.tags.find(([tagName]) => tagName === name)?.[1];

  const amountTag = tagValue(receipt, 'amount');
  if (amountTag) {
    const millisats = parseInt(amountTag, 10);
    if (Number.isFinite(millisats) && millisats > 0) return Math.floor(millisats / 1000);
  }

  const bolt11 = tagValue(receipt, 'bolt11');
  if (bolt11) {
    const sats = parseBolt11AmountSats(bolt11);
    if (sats !== null && sats > 0) return sats;
  }

  const description = tagValue(receipt, 'description');
  if (description) {
    try {
      const request = JSON.parse(description) as { tags?: string[][] };
      const requestAmount = request.tags?.find(([name]) => name === 'amount')?.[1];
      if (requestAmount) {
        const millisats = parseInt(requestAmount, 10);
        if (Number.isFinite(millisats) && millisats > 0) return Math.floor(millisats / 1000);
      }
    } catch {
      // Malformed embedded zap request — fall through to 0.
    }
  }

  return 0;
}

export interface ZapTotals {
  count: number;
  sats: number;
}

/**
 * Aggregate kind-9735 zap receipts (fetched with one `#e` filter covering many
 * note ids) into per-note counts and sat totals. Receipts are deduplicated by
 * id; non-9735 events are ignored. Every requested note id gets an entry.
 */
export function aggregateZapsByNote(
  receipts: NostrEvent[],
  noteIds: string[]
): Map<string, ZapTotals> {
  const idSet = new Set(noteIds);
  const byNote = new Map<string, ZapTotals>(noteIds.map((id) => [id, { count: 0, sats: 0 }]));
  const seen = new Set<string>();
  for (const receipt of receipts) {
    if (receipt.kind !== 9735 || seen.has(receipt.id)) continue;
    seen.add(receipt.id);
    for (const tag of receipt.tags) {
      if (tag[0] !== 'e' || !idSet.has(tag[1])) continue;
      const totals = byNote.get(tag[1])!;
      totals.count += 1;
      totals.sats += zapReceiptSats(receipt);
      break; // A receipt zaps one event; don't double-count on duplicate tags.
    }
  }
  return byNote;
}

/* ---------------------------------------------------------------------------
 * Zaps (NIP-57) — LNURL-pay resolution and the kind-9734 zap request
 * ------------------------------------------------------------------------- */

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/**
 * Decode a bech32 string's data part to bytes (checksum not verified — LNURL
 * strings routinely exceed bech32's 90-char limit, so strict libraries reject
 * them). Returns null when the string is malformed.
 */
function decodeBech32Data(encoded: string): Uint8Array | null {
  const lower = encoded.toLowerCase();
  const separator = lower.lastIndexOf('1');
  if (separator < 1 || separator + 7 > lower.length) return null;

  const words: number[] = [];
  // The final 6 characters are the checksum, which is not part of the payload.
  for (const char of lower.slice(separator + 1, -6)) {
    const value = BECH32_CHARSET.indexOf(char);
    if (value === -1) return null;
    words.push(value);
  }

  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const word of words) {
    acc = (acc << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/**
 * Resolve a profile's lightning address to its LNURL-pay endpoint URL.
 *
 *  - `lud16` (name@domain) maps to `https://domain/.well-known/lnurlp/name`.
 *  - `lud06` (bech32 `lnurl1…`) decodes to the URL directly.
 *
 * Returns null when the profile has no usable lightning address. Only https
 * endpoints are accepted.
 */
export function lnurlPayUrl(metadata: { lud16?: string; lud06?: string }): string | null {
  const lud16 = metadata.lud16?.trim();
  if (lud16) {
    const match = /^([\w.+-]+)@([\w.-]+\.[a-z]{2,})$/i.exec(lud16);
    if (match) return `https://${match[2]}/.well-known/lnurlp/${match[1]}`;
  }

  const lud06 = metadata.lud06?.trim();
  if (lud06 && /^lnurl1/i.test(lud06)) {
    const bytes = decodeBech32Data(lud06);
    if (bytes) {
      try {
        const url = new TextDecoder().decode(bytes);
        if (/^https:\/\//i.test(url)) return url;
      } catch {
        // Not valid UTF-8 — fall through.
      }
    }
  }

  return null;
}

/**
 * Build the unsigned kind-9734 zap request (NIP-57 appendix A) for zapping a
 * note. The caller signs it with the user's NIP-07 signer and passes it to the
 * LNURL-pay callback's `nostr` parameter.
 */
export function buildZapRequestTemplate(params: {
  recipientPubkey: string;
  noteId: string;
  amountMsats: number;
  relays: string[];
  comment?: string;
  now?: number;
}): EventTemplate {
  return {
    kind: 9734,
    created_at: params.now ?? Math.floor(Date.now() / 1000),
    content: params.comment ?? '',
    tags: [
      ['relays', ...params.relays],
      ['amount', String(params.amountMsats)],
      ['p', params.recipientPubkey],
      ['e', params.noteId],
    ],
  };
}

/* ---------------------------------------------------------------------------
 * Profile metadata (kind 0)
 * ------------------------------------------------------------------------- */

export interface ProfileMetadata {
  name?: string;
  display_name?: string;
  picture?: string;
  lud06?: string;
  lud16?: string;
}

/**
 * Parse a kind-0 event's JSON content into the profile fields the story page
 * uses, tolerating malformed JSON and wrong-typed fields (both occur in the
 * wild). Returns an empty object rather than throwing.
 */
export function parseProfileContent(content: string): ProfileMetadata {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null) return {};
  const record = raw as Record<string, unknown>;
  const str = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value : undefined;
  return {
    name: str(record.name),
    display_name: str(record.display_name),
    picture: str(record.picture),
    lud06: str(record.lud06),
    lud16: str(record.lud16),
  };
}

/** Display name for a profile: display_name, then name, then a short npub. */
export function profileDisplayName(metadata: ProfileMetadata | undefined, npub: string): string {
  return metadata?.display_name || metadata?.name || `${npub.slice(0, 9)}…${npub.slice(-4)}`;
}
