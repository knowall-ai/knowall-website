import { describe, it, expect } from 'vitest';
import {
  addFollow,
  aggregateZapsByNote,
  buildReplyTags,
  buildZapRequestTemplate,
  groupRepliesByNote,
  isFollowing,
  isReplyToNote,
  lnurlPayUrl,
  parseBolt11AmountSats,
  parseProfileContent,
  profileDisplayName,
  sortRepliesChronologically,
  zapReceiptSats,
} from '@/lib/story-social';
import type { NostrEvent } from '@/lib/story-notes';

const NOTE_ID = '1'.repeat(64);
const AUTHOR = 'a'.repeat(64);
const KNOWALL = 'b'.repeat(64);

function makeEvent(partial: Partial<NostrEvent>): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: 'c'.repeat(64),
    created_at: 0,
    kind: 1,
    tags: [],
    content: '',
    ...partial,
  };
}

describe('buildReplyTags', () => {
  it('marks the parent as thread root and p-tags its author', () => {
    expect(buildReplyTags({ id: NOTE_ID, pubkey: AUTHOR })).toEqual([
      ['e', NOTE_ID, '', 'root'],
      ['p', AUTHOR],
    ]);
  });

  it('appends extra pubkeys as additional p tags', () => {
    expect(buildReplyTags({ id: NOTE_ID, pubkey: AUTHOR }, [KNOWALL])).toEqual([
      ['e', NOTE_ID, '', 'root'],
      ['p', AUTHOR],
      ['p', KNOWALL],
    ]);
  });

  it('deduplicates when the parent author is also an extra pubkey', () => {
    expect(buildReplyTags({ id: NOTE_ID, pubkey: KNOWALL }, [KNOWALL])).toEqual([
      ['e', NOTE_ID, '', 'root'],
      ['p', KNOWALL],
    ]);
  });
});

describe('isReplyToNote', () => {
  it('matches a root-marked e tag', () => {
    const event = makeEvent({ tags: [['e', NOTE_ID, '', 'root']] });
    expect(isReplyToNote(event, NOTE_ID)).toBe(true);
  });

  it('matches an unmarked (legacy positional) e tag', () => {
    const event = makeEvent({ tags: [['e', NOTE_ID]] });
    expect(isReplyToNote(event, NOTE_ID)).toBe(true);
  });

  it('ignores mention-marked e tags (quotes are not replies)', () => {
    const event = makeEvent({ tags: [['e', NOTE_ID, '', 'mention']] });
    expect(isReplyToNote(event, NOTE_ID)).toBe(false);
  });

  it('ignores e tags for other notes', () => {
    const event = makeEvent({ tags: [['e', '2'.repeat(64), '', 'root']] });
    expect(isReplyToNote(event, NOTE_ID)).toBe(false);
  });
});

describe('sortRepliesChronologically', () => {
  it('sorts oldest-first (newest-last) without mutating the input', () => {
    const newer = makeEvent({ id: 'f'.repeat(64), created_at: 200 });
    const older = makeEvent({ id: 'd'.repeat(64), created_at: 100 });
    const input = [newer, older];
    expect(sortRepliesChronologically(input)).toEqual([older, newer]);
    expect(input).toEqual([newer, older]);
  });
});

describe('groupRepliesByNote', () => {
  const otherNote = '2'.repeat(64);

  it('groups replies under their root note, sorted oldest-first', () => {
    const first = makeEvent({
      id: 'd'.repeat(64),
      created_at: 10,
      tags: [['e', NOTE_ID, '', 'root']],
    });
    const second = makeEvent({ id: 'f'.repeat(64), created_at: 20, tags: [['e', NOTE_ID]] });
    const grouped = groupRepliesByNote([second, first], [NOTE_ID, otherNote]);
    expect(grouped.get(NOTE_ID)).toEqual([first, second]);
    expect(grouped.get(otherNote)).toEqual([]);
  });

  it('deduplicates by event id and ignores non-kind-1 events', () => {
    const reply = makeEvent({ id: 'd'.repeat(64), tags: [['e', NOTE_ID, '', 'root']] });
    const receipt = makeEvent({ id: '9'.repeat(64), kind: 9735, tags: [['e', NOTE_ID]] });
    const grouped = groupRepliesByNote([reply, reply, receipt], [NOTE_ID]);
    expect(grouped.get(NOTE_ID)).toEqual([reply]);
  });

  it('excludes quotes that only mention the note', () => {
    const quote = makeEvent({ tags: [['e', NOTE_ID, '', 'mention']] });
    expect(groupRepliesByNote([quote], [NOTE_ID]).get(NOTE_ID)).toEqual([]);
  });
});

describe('isFollowing / addFollow', () => {
  it('detects an existing follow', () => {
    expect(isFollowing([['p', KNOWALL]], KNOWALL)).toBe(true);
    expect(isFollowing([['p', AUTHOR]], KNOWALL)).toBe(false);
    expect(isFollowing([], KNOWALL)).toBe(false);
  });

  it('appends the follow while preserving every existing tag verbatim', () => {
    const tags = [
      ['p', AUTHOR, 'wss://relay.example', 'friend'],
      ['t', 'topic'],
    ];
    expect(addFollow(tags, KNOWALL)).toEqual([
      ['p', AUTHOR, 'wss://relay.example', 'friend'],
      ['t', 'topic'],
      ['p', KNOWALL],
    ]);
  });

  it('does not duplicate an existing follow', () => {
    const tags = [['p', KNOWALL]];
    expect(addFollow(tags, KNOWALL)).toEqual([['p', KNOWALL]]);
  });

  it('never mutates the input tags', () => {
    const tags = [['p', AUTHOR]];
    const result = addFollow(tags, KNOWALL);
    result[0][1] = 'tampered';
    expect(tags).toEqual([['p', AUTHOR]]);
  });
});

describe('parseBolt11AmountSats', () => {
  it('parses milli/micro/nano multipliers', () => {
    expect(parseBolt11AmountSats('lnbc20m1pvjluez')).toBe(2_000_000);
    expect(parseBolt11AmountSats('lnbc2500u1pvjluez')).toBe(250_000);
    expect(parseBolt11AmountSats('lnbc210n1pvjluez')).toBe(21);
  });

  it('floors sub-satoshi pico amounts', () => {
    expect(parseBolt11AmountSats('lnbc10p1pvjluez')).toBe(0);
  });

  it('returns null for amountless or non-bolt11 strings', () => {
    expect(parseBolt11AmountSats('lnbc1pvjluez')).toBe(null);
    expect(parseBolt11AmountSats('not-an-invoice')).toBe(null);
    expect(parseBolt11AmountSats('')).toBe(null);
  });
});

describe('zapReceiptSats', () => {
  it('prefers the amount tag (millisats)', () => {
    const receipt = makeEvent({ kind: 9735, tags: [['amount', '21000']] });
    expect(zapReceiptSats(receipt)).toBe(21);
  });

  it('falls back to the bolt11 invoice amount', () => {
    const receipt = makeEvent({ kind: 9735, tags: [['bolt11', 'lnbc2500u1pvjluez']] });
    expect(zapReceiptSats(receipt)).toBe(250_000);
  });

  it('falls back to the embedded zap request description', () => {
    const request = { tags: [['amount', '42000']] };
    const receipt = makeEvent({ kind: 9735, tags: [['description', JSON.stringify(request)]] });
    expect(zapReceiptSats(receipt)).toBe(42);
  });

  it('returns 0 when no amount is recoverable', () => {
    expect(zapReceiptSats(makeEvent({ kind: 9735 }))).toBe(0);
    expect(zapReceiptSats(makeEvent({ kind: 9735, tags: [['description', 'not json']] }))).toBe(0);
  });
});

describe('aggregateZapsByNote', () => {
  it('sums counts and sats per note, deduplicated by receipt id', () => {
    const zap1 = makeEvent({
      id: '3'.repeat(64),
      kind: 9735,
      tags: [
        ['e', NOTE_ID],
        ['amount', '21000'],
      ],
    });
    const zap2 = makeEvent({
      id: '4'.repeat(64),
      kind: 9735,
      tags: [
        ['e', NOTE_ID],
        ['amount', '210000'],
      ],
    });
    const totals = aggregateZapsByNote([zap1, zap2, zap1], [NOTE_ID]);
    expect(totals.get(NOTE_ID)).toEqual({ count: 2, sats: 231 });
  });

  it('ignores receipts for other notes and non-9735 events', () => {
    const other = makeEvent({ id: '5'.repeat(64), kind: 9735, tags: [['e', '2'.repeat(64)]] });
    const reply = makeEvent({ id: '6'.repeat(64), kind: 1, tags: [['e', NOTE_ID]] });
    const totals = aggregateZapsByNote([other, reply], [NOTE_ID]);
    expect(totals.get(NOTE_ID)).toEqual({ count: 0, sats: 0 });
  });
});

describe('lnurlPayUrl', () => {
  it('maps a lud16 lightning address to its well-known endpoint', () => {
    expect(lnurlPayUrl({ lud16: 'ben@knowall.ai' })).toBe(
      'https://knowall.ai/.well-known/lnurlp/ben'
    );
  });

  it('decodes a lud06 bech32 lnurl (LUD-01 test vector)', () => {
    // Decodes to https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df
    const lnurl =
      'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS';
    expect(lnurlPayUrl({ lud06: lnurl })).toBe(
      'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df'
    );
  });

  it('prefers lud16 over lud06 and rejects malformed addresses', () => {
    expect(lnurlPayUrl({ lud16: 'not-an-address' })).toBe(null);
    expect(lnurlPayUrl({ lud06: 'lnurl1invalid!' })).toBe(null);
    expect(lnurlPayUrl({})).toBe(null);
  });
});

describe('buildZapRequestTemplate', () => {
  it('builds a NIP-57 kind-9734 request with relays, amount, p and e tags', () => {
    const template = buildZapRequestTemplate({
      recipientPubkey: AUTHOR,
      noteId: NOTE_ID,
      amountMsats: 21_000,
      relays: ['wss://relay.example'],
      comment: 'great post',
      now: 1_700_000_000,
    });
    expect(template).toEqual({
      kind: 9734,
      created_at: 1_700_000_000,
      content: 'great post',
      tags: [
        ['relays', 'wss://relay.example'],
        ['amount', '21000'],
        ['p', AUTHOR],
        ['e', NOTE_ID],
      ],
    });
  });
});

describe('parseProfileContent', () => {
  it('extracts the profile fields the story page uses', () => {
    const content = JSON.stringify({
      name: 'ben',
      display_name: 'Ben Weeks',
      picture: 'https://img.example/ben.png',
      lud16: 'ben@knowall.ai',
      extra: 'ignored',
    });
    expect(parseProfileContent(content)).toEqual({
      name: 'ben',
      display_name: 'Ben Weeks',
      picture: 'https://img.example/ben.png',
      lud06: undefined,
      lud16: 'ben@knowall.ai',
    });
  });

  it('tolerates malformed JSON and wrong-typed fields', () => {
    expect(parseProfileContent('not json')).toEqual({});
    expect(parseProfileContent('"just a string"')).toEqual({});
    expect(parseProfileContent(JSON.stringify({ name: 42, picture: ' ' }))).toEqual({
      name: undefined,
      display_name: undefined,
      picture: undefined,
      lud06: undefined,
      lud16: undefined,
    });
  });
});

describe('profileDisplayName', () => {
  const npub = 'npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar';

  it('prefers display_name, then name, then a truncated npub', () => {
    expect(profileDisplayName({ display_name: 'Ben Weeks', name: 'ben' }, npub)).toBe('Ben Weeks');
    expect(profileDisplayName({ name: 'ben' }, npub)).toBe('ben');
    expect(profileDisplayName(undefined, npub)).toBe('npub1kue7…22ar');
  });
});
