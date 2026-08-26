import { describe, it, expect } from 'vitest';

import { KNOWALL_PUBKEY } from '@/lib/nostr';
import { buildBlocklist, filterBlocked } from '@/lib/moderation';
import {
  COMMENT_KIND,
  buildCommentTags,
  buildCommentTemplate,
  commentFilterForProduct,
  dedupeComments,
  directReplies,
  isTopLevelComment,
  productCoord,
  topLevelComments,
} from '@/lib/product-comments';
import type { NostrEvent } from '@/lib/nip99';

const MERCHANT = KNOWALL_PUBKEY;
const D_TAG = 'tminus15-book';
const COORD = `30402:${MERCHANT}:${D_TAG}`;
const ROOT = { coord: COORD, merchantPubkey: MERCHANT };
const COMMENTER = 'a'.repeat(64);
const REPLIER = 'b'.repeat(64);

function makeComment(partial: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: COMMENTER,
    created_at: 1000,
    kind: COMMENT_KIND,
    content: 'Nice product',
    tags: [
      ['A', COORD],
      ['K', '30402'],
      ['P', MERCHANT],
      ['a', COORD],
      ['k', '30402'],
      ['p', MERCHANT],
    ],
    ...partial,
  };
}

function makeReply(parent: NostrEvent, partial: Partial<NostrEvent> = {}): NostrEvent {
  return makeComment({
    id: 'f'.repeat(64),
    pubkey: REPLIER,
    created_at: parent.created_at + 10,
    tags: [
      ['A', COORD],
      ['K', '30402'],
      ['P', MERCHANT],
      ['e', parent.id],
      ['k', String(COMMENT_KIND)],
      ['p', parent.pubkey],
    ],
    ...partial,
  });
}

describe('productCoord / commentFilterForProduct', () => {
  it('builds the kind-30402 coordinate the thread is rooted on', () => {
    expect(productCoord(MERCHANT, D_TAG)).toBe(COORD);
  });

  it('queries every comment in the thread via the uppercase #A scope tag', () => {
    expect(commentFilterForProduct(COORD)).toEqual({
      kinds: [COMMENT_KIND],
      '#A': [COORD],
      limit: 500,
    });
  });
});

describe('buildCommentTags / buildCommentTemplate', () => {
  it('tags a top-level comment with the listing as both root and parent', () => {
    expect(buildCommentTags(ROOT)).toEqual([
      ['A', COORD],
      ['K', '30402'],
      ['P', MERCHANT],
      ['a', COORD],
      ['k', '30402'],
      ['p', MERCHANT],
    ]);
  });

  it('tags a reply with the listing as root and the parent comment as parent', () => {
    const parent = makeComment();
    expect(buildCommentTags(ROOT, parent)).toEqual([
      ['A', COORD],
      ['K', '30402'],
      ['P', MERCHANT],
      ['e', parent.id],
      ['k', String(COMMENT_KIND)],
      ['p', parent.pubkey],
    ]);
  });

  it('builds a signable kind-1111 template', () => {
    const template = buildCommentTemplate(ROOT, 'Hello', undefined, 123);
    expect(template).toEqual({
      kind: COMMENT_KIND,
      created_at: 123,
      content: 'Hello',
      tags: buildCommentTags(ROOT),
    });
  });
});

describe('threading', () => {
  it('identifies top-level comments by their lowercase parent tag', () => {
    const topLevel = makeComment();
    const reply = makeReply(topLevel);
    expect(isTopLevelComment(topLevel, COORD)).toBe(true);
    expect(isTopLevelComment(reply, COORD)).toBe(false);
  });

  it('sorts top-level comments newest first and replies oldest first', () => {
    const older = makeComment({ id: '1'.repeat(64), created_at: 100 });
    const newer = makeComment({ id: '2'.repeat(64), created_at: 200 });
    const replyLate = makeReply(older, { id: '3'.repeat(64), created_at: 300 });
    const replyEarly = makeReply(older, { id: '4'.repeat(64), created_at: 150 });
    const all = [older, newer, replyLate, replyEarly];

    expect(topLevelComments(all, COORD).map((event) => event.id)).toEqual([newer.id, older.id]);
    expect(directReplies(all, older.id).map((event) => event.id)).toEqual([
      replyEarly.id,
      replyLate.id,
    ]);
  });

  it('threads nested replies to any depth', () => {
    const top = makeComment({ id: '1'.repeat(64) });
    const level1 = makeReply(top, { id: '2'.repeat(64) });
    const level2 = makeReply(level1, { id: '3'.repeat(64) });
    const all = [top, level1, level2];

    expect(directReplies(all, top.id).map((event) => event.id)).toEqual([level1.id]);
    expect(directReplies(all, level1.id).map((event) => event.id)).toEqual([level2.id]);
    expect(directReplies(all, level2.id)).toEqual([]);
  });
});

describe('dedupeComments', () => {
  it('drops duplicate ids and non-comment kinds', () => {
    const comment = makeComment();
    const duplicate = makeComment();
    const stray = makeComment({ id: '9'.repeat(64), kind: 1 });
    expect(dedupeComments([comment, duplicate, stray])).toEqual([comment]);
  });
});

describe('moderation of comments', () => {
  it('filters muted authors and individually muted events out of the thread', () => {
    const kept = makeComment({ id: '1'.repeat(64) });
    const mutedAuthor = makeComment({ id: '2'.repeat(64), pubkey: REPLIER });
    const mutedEvent = makeComment({ id: '3'.repeat(64), pubkey: 'c'.repeat(64) });
    const blocklist = buildBlocklist({
      tags: [
        ['p', REPLIER],
        ['e', mutedEvent.id],
      ],
    });

    const visible = filterBlocked([kept, mutedAuthor, mutedEvent], blocklist);
    expect(topLevelComments(visible, COORD)).toEqual([kept]);
  });
});
