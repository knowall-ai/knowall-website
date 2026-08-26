import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/relay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/relay')>();
  return { ...actual, queryRelays: vi.fn(), publishToRelays: vi.fn() };
});

import { KNOWALL_PUBKEY } from '@/lib/nostr';
import { publishToRelays, queryRelays } from '@/lib/relay';
import {
  MUTE_LIST_KIND,
  buildBlocklist,
  buildMuteListTemplate,
  filterBlocked,
  getBlocklist,
  isBlocked,
  muteUser,
  resetBlocklistCache,
  selectMuteList,
  type Blocklist,
} from '@/lib/moderation';
import type { NostrEvent } from '@/lib/story-notes';

const MUTED_PUBKEY = 'a'.repeat(64);
const OTHER_PUBKEY = 'c'.repeat(64);
const MUTED_EVENT_ID = 'd'.repeat(64);

const mockedQueryRelays = vi.mocked(queryRelays);
const mockedPublishToRelays = vi.mocked(publishToRelays);

function makeEvent(partial: Partial<NostrEvent>): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: OTHER_PUBKEY,
    created_at: 0,
    kind: 1,
    tags: [],
    content: '',
    ...partial,
  };
}

function makeMuteList(partial: Partial<NostrEvent> = {}): NostrEvent {
  return makeEvent({
    kind: MUTE_LIST_KIND,
    pubkey: KNOWALL_PUBKEY,
    tags: [['p', MUTED_PUBKEY]],
    ...partial,
  });
}

function blocklist(pubkeys: string[] = [], eventIds: string[] = []): Blocklist {
  return { pubkeys: new Set(pubkeys), eventIds: new Set(eventIds) };
}

beforeEach(() => {
  resetBlocklistCache();
  vi.resetAllMocks();
});

describe('selectMuteList', () => {
  it('picks the newest kind-10000 event by the company', () => {
    const older = makeMuteList({ id: '1'.repeat(64), created_at: 100 });
    const newer = makeMuteList({ id: '2'.repeat(64), created_at: 200 });
    expect(selectMuteList([older, newer])).toBe(newer);
    expect(selectMuteList([newer, older])).toBe(newer);
  });

  it('ignores events of other kinds or by other authors', () => {
    const wrongKind = makeMuteList({ kind: 1 });
    const wrongAuthor = makeMuteList({ pubkey: OTHER_PUBKEY });
    expect(selectMuteList([wrongKind, wrongAuthor])).toBeNull();
  });
});

describe('buildBlocklist', () => {
  it('collects public p tags as muted pubkeys and e tags as muted event ids', () => {
    const list = buildBlocklist(
      makeMuteList({
        tags: [
          ['p', MUTED_PUBKEY],
          ['e', MUTED_EVENT_ID],
        ],
      })
    );
    expect(list.pubkeys).toEqual(new Set([MUTED_PUBKEY]));
    expect(list.eventIds).toEqual(new Set([MUTED_EVENT_ID]));
  });

  it('ignores other NIP-51 tag types, malformed tags and encrypted content', () => {
    const list = buildBlocklist(
      makeMuteList({
        tags: [['t', 'spamtag'], ['word', 'spam'], ['p'], ['e', '']],
        content: 'encrypted-private-mutes-blob',
      })
    );
    expect(list.pubkeys.size).toBe(0);
    expect(list.eventIds.size).toBe(0);
  });

  it('normalises hex to lowercase', () => {
    const list = buildBlocklist(makeMuteList({ tags: [['p', MUTED_PUBKEY.toUpperCase()]] }));
    expect(list.pubkeys.has(MUTED_PUBKEY)).toBe(true);
  });

  it('returns an empty blocklist when there is no mute list', () => {
    const list = buildBlocklist(null);
    expect(list.pubkeys.size).toBe(0);
    expect(list.eventIds.size).toBe(0);
  });
});

describe('isBlocked', () => {
  it('blocks an event authored by a muted pubkey', () => {
    expect(isBlocked(makeEvent({ pubkey: MUTED_PUBKEY }), blocklist([MUTED_PUBKEY]))).toBe(true);
  });

  it('blocks an individually muted event id', () => {
    expect(isBlocked(makeEvent({ id: MUTED_EVENT_ID }), blocklist([], [MUTED_EVENT_ID]))).toBe(
      true
    );
  });

  it('passes a clean event', () => {
    expect(isBlocked(makeEvent({}), blocklist([MUTED_PUBKEY], [MUTED_EVENT_ID]))).toBe(false);
  });

  it('never blocks the company itself, even when self-listed', () => {
    expect(isBlocked(makeEvent({ pubkey: KNOWALL_PUBKEY }), blocklist([KNOWALL_PUBKEY]))).toBe(
      false
    );
  });
});

describe('filterBlocked', () => {
  it('drops blocked events and preserves the order of the rest', () => {
    const kept1 = makeEvent({ id: '1'.repeat(64) });
    const muted = makeEvent({ id: '2'.repeat(64), pubkey: MUTED_PUBKEY });
    const kept2 = makeEvent({ id: '3'.repeat(64) });
    expect(filterBlocked([kept1, muted, kept2], blocklist([MUTED_PUBKEY]))).toEqual([kept1, kept2]);
  });
});

describe('buildMuteListTemplate', () => {
  it('preserves every existing tag and the content verbatim, appending the new p tag', () => {
    const current = makeMuteList({
      tags: [
        ['p', MUTED_PUBKEY],
        ['t', 'spamtag'],
        ['e', MUTED_EVENT_ID],
      ],
      content: 'encrypted-private-mutes-blob',
    });
    const template = buildMuteListTemplate(current, OTHER_PUBKEY, 1234);
    expect(template).toEqual({
      kind: MUTE_LIST_KIND,
      created_at: 1234,
      content: 'encrypted-private-mutes-blob',
      tags: [
        ['p', MUTED_PUBKEY],
        ['t', 'spamtag'],
        ['e', MUTED_EVENT_ID],
        ['p', OTHER_PUBKEY],
      ],
    });
    // The input event is never mutated.
    expect(current.tags).toHaveLength(3);
  });

  it('does not duplicate an already-muted pubkey (case-insensitively)', () => {
    const current = makeMuteList({ tags: [['p', MUTED_PUBKEY]] });
    const template = buildMuteListTemplate(current, MUTED_PUBKEY.toUpperCase(), 1234);
    expect(template.tags).toEqual([['p', MUTED_PUBKEY]]);
  });

  it('starts a fresh list when there is no current mute list', () => {
    const template = buildMuteListTemplate(null, MUTED_PUBKEY, 1234);
    expect(template).toEqual({
      kind: MUTE_LIST_KIND,
      created_at: 1234,
      content: '',
      tags: [['p', MUTED_PUBKEY]],
    });
  });
});

describe('getBlocklist', () => {
  it('fetches the mute list once and shares the result across callers', async () => {
    mockedQueryRelays.mockResolvedValue([makeMuteList()]);
    const first = await getBlocklist();
    const second = await getBlocklist();
    expect(first.pubkeys.has(MUTED_PUBKEY)).toBe(true);
    expect(second).toBe(first);
    expect(mockedQueryRelays).toHaveBeenCalledTimes(1);
    expect(mockedQueryRelays).toHaveBeenCalledWith(
      expect.any(Array),
      [{ kinds: [MUTE_LIST_KIND], authors: [KNOWALL_PUBKEY], limit: 1 }],
      expect.any(Number)
    );
  });

  it('fails open (empty blocklist) when the relay query rejects', async () => {
    mockedQueryRelays.mockRejectedValue(new Error('relays down'));
    const list = await getBlocklist();
    expect(list.pubkeys.size).toBe(0);
    expect(list.eventIds.size).toBe(0);
  });
});

describe('muteUser', () => {
  it('merges the current list, signs, publishes and updates the cached blocklist', async () => {
    const current = makeMuteList({ created_at: 100, tags: [['p', MUTED_PUBKEY]] });
    mockedQueryRelays.mockResolvedValue([current]);
    mockedPublishToRelays.mockResolvedValue(undefined);
    const signEvent = vi.fn((template) =>
      Promise.resolve(makeEvent({ ...template, pubkey: KNOWALL_PUBKEY, sig: 'signed' }))
    );

    await muteUser(OTHER_PUBKEY, signEvent);

    const template = signEvent.mock.calls[0][0];
    expect(template.kind).toBe(MUTE_LIST_KIND);
    expect(template.tags).toEqual([
      ['p', MUTED_PUBKEY],
      ['p', OTHER_PUBKEY],
    ]);
    expect(mockedPublishToRelays).toHaveBeenCalledTimes(1);

    // The page-load cache now reflects the new mute without a refetch.
    const list = await getBlocklist();
    expect(list.pubkeys.has(OTHER_PUBKEY)).toBe(true);
    expect(mockedQueryRelays).toHaveBeenCalledTimes(1);
  });

  it('propagates signer rejection without publishing', async () => {
    mockedQueryRelays.mockResolvedValue([]);
    const signEvent = vi.fn(() => Promise.reject(new Error('User declined to sign.')));
    await expect(muteUser(OTHER_PUBKEY, signEvent)).rejects.toThrow('User declined to sign.');
    expect(mockedPublishToRelays).not.toHaveBeenCalled();
  });
});
