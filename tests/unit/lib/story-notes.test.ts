import { describe, it, expect } from 'vitest';
import {
  type NostrEvent,
  encodeBech32,
  encodeNoteId,
  extractImageUrls,
  extractVideoUrls,
  isReply,
  stripMediaUrls,
  timeAgo,
} from '@/lib/story-notes';
import { KNOWALL_NPUB, KNOWALL_PUBKEY } from '@/lib/nostr';

function makeEvent(partial: Partial<NostrEvent>): NostrEvent {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 0,
    kind: 1,
    tags: [],
    content: '',
    ...partial,
  };
}

describe('extractImageUrls', () => {
  it('extracts URLs from NIP-92 imeta tags', () => {
    const event = makeEvent({
      tags: [['imeta', 'url https://img.example/a.png', 'm image/png']],
    });
    expect(extractImageUrls(event)).toEqual(['https://img.example/a.png']);
  });

  it('extracts bare image URLs from content', () => {
    const event = makeEvent({
      content: 'Check this out https://img.example/b.jpg and more text',
    });
    expect(extractImageUrls(event)).toEqual(['https://img.example/b.jpg']);
  });

  it('honours a query string on a content image URL', () => {
    const event = makeEvent({ content: 'https://img.example/c.webp?width=800 nice' });
    expect(extractImageUrls(event)).toEqual(['https://img.example/c.webp?width=800']);
  });

  it('dedupes a URL declared in both an imeta tag and the content', () => {
    const event = makeEvent({
      tags: [['imeta', 'url https://img.example/a.png']],
      content: 'See https://img.example/a.png',
    });
    expect(extractImageUrls(event)).toEqual(['https://img.example/a.png']);
  });

  it('returns an empty array when there are no images', () => {
    expect(extractImageUrls(makeEvent({ content: 'just words, no pics' }))).toEqual([]);
  });

  it('ignores non-image links', () => {
    const event = makeEvent({ content: 'visit https://example.com/page for info' });
    expect(extractImageUrls(event)).toEqual([]);
  });

  it('skips imeta attachments whose mime is not an image', () => {
    const event = makeEvent({
      tags: [['imeta', 'url https://media.example/clip.mp4', 'm video/mp4']],
    });
    expect(extractImageUrls(event)).toEqual([]);
  });

  it('keeps an imeta image whose extension is unusual but mime says image', () => {
    const event = makeEvent({
      tags: [['imeta', 'url https://media.example/pic', 'm image/png']],
    });
    expect(extractImageUrls(event)).toEqual(['https://media.example/pic']);
  });

  it('falls back to the URL extension when imeta declares no mime', () => {
    const event = makeEvent({ tags: [['imeta', 'url https://img.example/d.png']] });
    expect(extractImageUrls(event)).toEqual(['https://img.example/d.png']);
  });

  it('does not treat an image extension mid-path as an image (no declared mime)', () => {
    const event = makeEvent({ tags: [['imeta', 'url https://example.com/a.png/extra']] });
    expect(extractImageUrls(event)).toEqual([]);
  });

  it('rejects non-http(s) imeta image URLs', () => {
    const event = makeEvent({
      tags: [['imeta', 'url data:image/png;base64,iVBORw0KGgo=', 'm image/png']],
    });
    expect(extractImageUrls(event)).toEqual([]);
  });
});

describe('extractVideoUrls', () => {
  it('extracts video URLs from NIP-92 imeta tags', () => {
    const event = makeEvent({
      tags: [['imeta', 'url https://media.example/clip.mp4', 'm video/mp4']],
    });
    expect(extractVideoUrls(event)).toEqual(['https://media.example/clip.mp4']);
  });

  it('extracts bare video URLs from content', () => {
    const event = makeEvent({ content: 'Watch https://media.example/demo.webm now' });
    expect(extractVideoUrls(event)).toEqual(['https://media.example/demo.webm']);
  });

  it('does not pick up image URLs', () => {
    const event = makeEvent({
      tags: [['imeta', 'url https://img.example/a.png', 'm image/png']],
      content: 'https://img.example/b.jpg',
    });
    expect(extractVideoUrls(event)).toEqual([]);
  });

  it('keeps an imeta video whose extension is unusual but mime says video', () => {
    const event = makeEvent({
      tags: [['imeta', 'url https://media.example/stream', 'm video/mp4']],
    });
    expect(extractVideoUrls(event)).toEqual(['https://media.example/stream']);
  });
});

describe('stripMediaUrls', () => {
  it('removes image URLs and trims surrounding whitespace', () => {
    expect(stripMediaUrls('New build!\n\nhttps://img.example/a.png')).toBe('New build!');
  });

  it('removes video URLs too', () => {
    expect(stripMediaUrls('Demo video https://media.example/demo.mp4 enjoy')).toBe(
      'Demo video  enjoy'
    );
  });

  it('collapses blank lines left behind by removed media', () => {
    const text = 'First line\nhttps://img.example/a.png\n\n\nSecond line';
    expect(stripMediaUrls(text)).toBe('First line\n\nSecond line');
  });

  it('leaves text without media unchanged', () => {
    expect(stripMediaUrls('plain note')).toBe('plain note');
  });
});

describe('isReply', () => {
  it('is true when the note has an unmarked e tag', () => {
    expect(isReply(makeEvent({ tags: [['e', 'd'.repeat(64)]] }))).toBe(true);
  });

  it('is false for a top-level note', () => {
    expect(isReply(makeEvent({ tags: [['t', 'knowall']] }))).toBe(false);
  });

  it('is false when the only e tag is a NIP-10 mention marker', () => {
    const event = makeEvent({ tags: [['e', 'd'.repeat(64), '', 'mention']] });
    expect(isReply(event)).toBe(false);
  });

  it('is true for a NIP-10 reply marker', () => {
    const event = makeEvent({ tags: [['e', 'd'.repeat(64), '', 'reply']] });
    expect(isReply(event)).toBe(true);
  });
});

describe('timeAgo', () => {
  const now = 1_700_000_000_000; // fixed reference, ms

  it('says "just now" for very recent times', () => {
    expect(timeAgo(now / 1000 - 30, now)).toBe('just now');
  });

  it('formats singular units', () => {
    expect(timeAgo(now / 1000 - 3600, now)).toBe('1 hour ago');
  });

  it('formats plural units', () => {
    expect(timeAgo(now / 1000 - 3 * 86400, now)).toBe('3 days ago');
  });

  it('rolls up to years', () => {
    expect(timeAgo(now / 1000 - 2 * 31536000, now)).toBe('2 years ago');
  });
});

describe('bech32 encoding', () => {
  it("encodes KnowAll's hex pubkey to its published npub", () => {
    expect(encodeBech32('npub', KNOWALL_PUBKEY)).toBe(KNOWALL_NPUB);
  });

  it('produces a note1… identifier for event ids', () => {
    const noteId = encodeNoteId('f'.repeat(64));
    expect(noteId.startsWith('note1')).toBe(true);
    expect(noteId).toHaveLength(63);
  });
});
