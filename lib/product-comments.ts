/**
 * NIP-22 product comments — kind-1111 comments rooted on a NIP-99 / Gamma
 * Markets listing (kind 30402), threaded to any depth.
 *
 * Per NIP-22, UPPERCASE tags (`A`/`K`/`P`) always describe the thread root —
 * here the product's addressable coordinate `30402:<merchantPubkey>:<dTag>` —
 * while lowercase tags (`a`/`e` + `k`/`p`) describe the immediate parent: the
 * listing itself for a top-level comment, or the comment being replied to.
 *
 * Ported from robotechy.com's productComments.ts, specialised to product
 * listings (the only comment root this site uses). Free of React and browser
 * dependencies so every branch can be unit-tested directly.
 */

import { CLASSIFIED_LISTING_KIND, type NostrEvent } from './nip99';
import type { NostrFilter } from './relay';
import type { EventTemplate } from './story-social';

/** NIP-22 comment kind. */
export const COMMENT_KIND = 1111;

/** Read the first value of a tag, or `undefined` when the tag is absent. */
export function getTagValue(event: Pick<NostrEvent, 'tags'>, tagName: string): string | undefined {
  return event.tags.find(([name]) => name === tagName)?.[1];
}

/**
 * The addressable coordinate (`30402:<merchantPubkey>:<dTag>`) that a
 * product's comment thread is rooted on. Stable across listing edits (the
 * event id changes; the coordinate doesn't).
 */
export function productCoord(merchantPubkey: string, dTag: string): string {
  return `${CLASSIFIED_LISTING_KIND}:${merchantPubkey}:${dTag}`;
}

/**
 * Relay filter finding every kind-1111 comment referencing the product, at any
 * depth: the uppercase `#A` scope tag points at the thread root per NIP-22, so
 * this returns the whole conversation, not just top-level items.
 */
export function commentFilterForProduct(coord: string, limit = 500): NostrFilter {
  return { kinds: [COMMENT_KIND], '#A': [coord], limit };
}

/**
 * True when `comment` is a top-level comment on the product (its lowercase
 * parent `a` tag points at the listing coordinate itself rather than at
 * another comment via `e`).
 */
export function isTopLevelComment(comment: NostrEvent, coord: string): boolean {
  return getTagValue(comment, 'a') === coord && getTagValue(comment, 'e') === undefined;
}

/**
 * Build the NIP-22 tag set for a new comment on the product (or a reply to
 * another comment in its thread).
 */
export function buildCommentTags(
  root: { coord: string; merchantPubkey: string },
  reply?: Pick<NostrEvent, 'id' | 'pubkey'>
): string[][] {
  const tags: string[][] = [
    // Root scope (uppercase): the product listing.
    ['A', root.coord],
    ['K', String(CLASSIFIED_LISTING_KIND)],
    ['P', root.merchantPubkey],
  ];

  if (reply) {
    // Immediate parent (lowercase): the comment being replied to.
    tags.push(['e', reply.id], ['k', String(COMMENT_KIND)], ['p', reply.pubkey]);
  } else {
    // Top-level: the parent IS the root listing.
    tags.push(
      ['a', root.coord],
      ['k', String(CLASSIFIED_LISTING_KIND)],
      ['p', root.merchantPubkey]
    );
  }

  return tags;
}

/** Unsigned kind-1111 comment event, ready for a NIP-07 signer. */
export function buildCommentTemplate(
  root: { coord: string; merchantPubkey: string },
  content: string,
  reply?: Pick<NostrEvent, 'id' | 'pubkey'>,
  now: number = Math.floor(Date.now() / 1000)
): EventTemplate {
  return {
    kind: COMMENT_KIND,
    created_at: now,
    content,
    tags: buildCommentTags(root, reply),
  };
}

/**
 * De-duplicate a relay result by event id and keep only kind-1111 events —
 * relays are untrusted, so anything else is dropped before threading.
 */
export function dedupeComments(events: NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>();
  for (const event of events) {
    if (event.kind !== COMMENT_KIND || typeof event.id !== 'string') continue;
    if (!byId.has(event.id)) byId.set(event.id, event);
  }
  return [...byId.values()];
}

/** Top-level comments on the product, newest first. */
export function topLevelComments(events: NostrEvent[], coord: string): NostrEvent[] {
  return events
    .filter((event) => isTopLevelComment(event, coord))
    .sort((a, b) => b.created_at - a.created_at);
}

/** Direct replies to `parentId`, oldest first (natural reading order). */
export function directReplies(events: NostrEvent[], parentId: string): NostrEvent[] {
  return events
    .filter((event) => getTagValue(event, 'e') === parentId)
    .sort((a, b) => a.created_at - b.created_at);
}
