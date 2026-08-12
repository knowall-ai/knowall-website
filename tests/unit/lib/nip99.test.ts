import { describe, it, expect } from 'vitest';
import {
  CLASSIFIED_LISTING_KIND,
  parseListing,
  dedupeListings,
  formatPrice,
  filterListings,
  collectTags,
  isPubliclyVisible,
  isSoldOut,
  type NostrEvent,
} from '@/lib/nip99';

/** Build a valid kind-30402 event, overridable per test. */
function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'event-id-1',
    pubkey: 'merchant-pubkey',
    created_at: 1_700_000_000,
    kind: CLASSIFIED_LISTING_KIND,
    content: 'A pack of 10 die-cut vinyl stickers.\n\nShips worldwide.',
    tags: [
      ['d', 'sticker-pack'],
      ['title', 'KnowAll AI Sticker Pack'],
      ['summary', 'Ten die-cut vinyl stickers'],
      ['published_at', '1700000000'],
      ['price', '10000', 'SATS'],
      ['image', 'https://example.com/stickers.png'],
      ['t', 'stickers'],
      ['t', 'Merch'],
      ['location', 'United Kingdom'],
      ['status', 'active'],
    ],
    ...overrides,
  };
}

describe('parseListing', () => {
  it('parses a complete NIP-99 listing', () => {
    const listing = parseListing(makeEvent());
    expect(listing).toEqual({
      id: 'event-id-1',
      pubkey: 'merchant-pubkey',
      dTag: 'sticker-pack',
      title: 'KnowAll AI Sticker Pack',
      summary: 'Ten die-cut vinyl stickers',
      description: 'A pack of 10 die-cut vinyl stickers.\n\nShips worldwide.',
      price: { amount: 10000, currency: 'SATS' },
      images: ['https://example.com/stickers.png'],
      tags: ['stickers', 'merch'],
      location: 'United Kingdom',
      status: 'active',
      visibility: null,
      stock: null,
      publishedAt: 1_700_000_000,
      createdAt: 1_700_000_000,
    });
  });

  it('rejects events of the wrong kind', () => {
    expect(parseListing(makeEvent({ kind: 1 }))).toBeNull();
  });

  it('rejects listings without a d tag or title', () => {
    const noD = makeEvent({ tags: [['title', 'No identifier']] });
    const noTitle = makeEvent({ tags: [['d', 'no-title']] });
    expect(parseListing(noD)).toBeNull();
    expect(parseListing(noTitle)).toBeNull();
  });

  it('accepts an empty-string d tag (valid per NIP-33 semantics)', () => {
    const event = makeEvent({
      tags: [
        ['d', ''],
        ['title', 'Root listing'],
      ],
    });
    expect(parseListing(event)?.dTag).toBe('');
  });

  it('defaults missing optional fields', () => {
    const event = makeEvent({
      content: '',
      tags: [
        ['d', 'bare'],
        ['title', 'Bare listing'],
      ],
    });
    const listing = parseListing(event)!;
    expect(listing.summary).toBe('');
    expect(listing.price).toBeNull();
    expect(listing.images).toEqual([]);
    expect(listing.tags).toEqual([]);
    expect(listing.location).toBeNull();
    expect(listing.status).toBe('active');
    // published_at falls back to created_at
    expect(listing.publishedAt).toBe(event.created_at);
  });

  it('marks sold listings and treats unknown statuses as active', () => {
    const sold = makeEvent({
      tags: [
        ['d', 'x'],
        ['title', 'X'],
        ['status', 'sold'],
      ],
    });
    const weird = makeEvent({
      tags: [
        ['d', 'x'],
        ['title', 'X'],
        ['status', 'pending'],
      ],
    });
    expect(parseListing(sold)?.status).toBe('sold');
    expect(parseListing(weird)?.status).toBe('active');
  });

  it('parses price with frequency and defaults currency to SATS', () => {
    const subscription = makeEvent({
      tags: [
        ['d', 'x'],
        ['title', 'X'],
        ['price', '5', 'USD', 'month'],
      ],
    });
    const bare = makeEvent({
      tags: [
        ['d', 'x'],
        ['title', 'X'],
        ['price', '21000'],
      ],
    });
    expect(parseListing(subscription)?.price).toEqual({
      amount: 5,
      currency: 'USD',
      frequency: 'month',
    });
    expect(parseListing(bare)?.price).toEqual({ amount: 21000, currency: 'SATS' });
  });

  it('drops malformed prices', () => {
    const notANumber = makeEvent({
      tags: [
        ['d', 'x'],
        ['title', 'X'],
        ['price', 'lots', 'SATS'],
      ],
    });
    const negative = makeEvent({
      tags: [
        ['d', 'x'],
        ['title', 'X'],
        ['price', '-5', 'SATS'],
      ],
    });
    expect(parseListing(notANumber)?.price).toBeNull();
    expect(parseListing(negative)?.price).toBeNull();
  });

  it('parses Gamma visibility and stock tags when present', () => {
    const gamma = makeEvent({
      tags: [
        ['d', 'x'],
        ['title', 'X'],
        ['visibility', 'hidden'],
        ['stock', '3'],
      ],
    });
    const junkStock = makeEvent({
      tags: [
        ['d', 'x'],
        ['title', 'X'],
        ['visibility', 'weird'],
        ['stock', 'many'],
      ],
    });
    expect(parseListing(gamma)).toMatchObject({ visibility: 'hidden', stock: 3 });
    expect(parseListing(junkStock)).toMatchObject({ visibility: null, stock: null });
  });

  it('deduplicates images and lowercases/deduplicates hashtags', () => {
    const event = makeEvent({
      tags: [
        ['d', 'x'],
        ['title', 'X'],
        ['image', 'https://example.com/a.png'],
        ['image', 'https://example.com/a.png'],
        ['image', 'https://example.com/b.png', '800x600'],
        ['t', 'Stickers'],
        ['t', 'stickers'],
      ],
    });
    const listing = parseListing(event)!;
    expect(listing.images).toEqual(['https://example.com/a.png', 'https://example.com/b.png']);
    expect(listing.tags).toEqual(['stickers']);
  });
});

describe('dedupeListings', () => {
  it('keeps only the newest event per (pubkey, d) pair', () => {
    const older = makeEvent({ id: 'old', created_at: 100 });
    const newer = makeEvent({ id: 'new', created_at: 200 });
    const listings = dedupeListings([newer, older]);
    expect(listings).toHaveLength(1);
    expect(listings[0].id).toBe('new');
  });

  it('does not merge the same d tag across different authors', () => {
    const a = makeEvent({ id: 'a', pubkey: 'author-a' });
    const b = makeEvent({ id: 'b', pubkey: 'author-b' });
    expect(dedupeListings([a, b])).toHaveLength(2);
  });

  it('sorts newest-published first and skips unparseable events', () => {
    const first = makeEvent({
      id: 'first',
      tags: [
        ['d', 'one'],
        ['title', 'One'],
        ['published_at', '100'],
      ],
    });
    const second = makeEvent({
      id: 'second',
      tags: [
        ['d', 'two'],
        ['title', 'Two'],
        ['published_at', '200'],
      ],
    });
    const junk = makeEvent({ id: 'junk', kind: 1 });
    const listings = dedupeListings([first, junk, second]);
    expect(listings.map((l) => l.id)).toEqual(['second', 'first']);
  });
});

describe('formatPrice', () => {
  it('formats sats with thousands separators', () => {
    expect(formatPrice({ amount: 10000, currency: 'SATS' })).toBe('10,000 sats');
    expect(formatPrice({ amount: 1, currency: 'SAT' })).toBe('1 sats');
  });

  it('formats known currencies with their symbol', () => {
    expect(formatPrice({ amount: 25, currency: 'USD' })).toBe('$25');
    expect(formatPrice({ amount: 19.5, currency: 'GBP' })).toBe('£19.5');
    expect(formatPrice({ amount: 0.001, currency: 'BTC' })).toBe('₿0.001');
  });

  it('falls back to the currency code for unknown currencies', () => {
    expect(formatPrice({ amount: 100, currency: 'CHF' })).toBe('100 CHF');
  });

  it('appends the frequency for recurring prices', () => {
    expect(formatPrice({ amount: 5, currency: 'USD', frequency: 'month' })).toBe('$5 / month');
  });

  it('falls back when there is no price', () => {
    expect(formatPrice(null)).toBe('Contact for price');
  });
});

describe('isPubliclyVisible / isSoldOut', () => {
  const listing = (tags: string[][]) => parseListing(makeEvent({ tags }))!;

  it('hides Gamma hidden listings, shows everything else', () => {
    expect(
      isPubliclyVisible(
        listing([
          ['d', 'x'],
          ['title', 'X'],
          ['visibility', 'hidden'],
        ])
      )
    ).toBe(false);
    expect(
      isPubliclyVisible(
        listing([
          ['d', 'x'],
          ['title', 'X'],
          ['visibility', 'on-sale'],
        ])
      )
    ).toBe(true);
    expect(
      isPubliclyVisible(
        listing([
          ['d', 'x'],
          ['title', 'X'],
        ])
      )
    ).toBe(true);
  });

  it('treats sold status or zero stock as sold out', () => {
    expect(
      isSoldOut(
        listing([
          ['d', 'x'],
          ['title', 'X'],
          ['status', 'sold'],
        ])
      )
    ).toBe(true);
    expect(
      isSoldOut(
        listing([
          ['d', 'x'],
          ['title', 'X'],
          ['stock', '0'],
        ])
      )
    ).toBe(true);
    expect(
      isSoldOut(
        listing([
          ['d', 'x'],
          ['title', 'X'],
          ['stock', '5'],
        ])
      )
    ).toBe(false);
    expect(
      isSoldOut(
        listing([
          ['d', 'x'],
          ['title', 'X'],
        ])
      )
    ).toBe(false);
  });
});

describe('filterListings', () => {
  const listings = dedupeListings([
    makeEvent({
      id: 'stickers',
      content: 'Die-cut vinyl.',
      tags: [
        ['d', 'stickers'],
        ['title', 'Sticker Pack'],
        ['summary', 'Vinyl stickers'],
        ['t', 'merch'],
        ['published_at', '300'],
      ],
    }),
    makeEvent({
      id: 'tshirt',
      content: 'Organic cotton, lime on black.',
      tags: [
        ['d', 'tshirt'],
        ['title', 'KnowAll T-Shirt'],
        ['t', 'merch'],
        ['t', 'clothing'],
        ['published_at', '200'],
      ],
    }),
    makeEvent({
      id: 'course',
      content: 'Hands-on multi-agent development course.',
      tags: [
        ['d', 'course'],
        ['title', 'Agent Bootcamp'],
        ['summary', 'Learn multi-agent development'],
        ['t', 'training'],
        ['published_at', '100'],
      ],
    }),
  ]);

  it('returns everything for an empty query and no tag', () => {
    expect(filterListings(listings, '', null)).toHaveLength(3);
  });

  it('searches titles case-insensitively', () => {
    expect(filterListings(listings, 'sticker', null).map((l) => l.id)).toEqual(['stickers']);
    expect(filterListings(listings, 'BOOTCAMP', null).map((l) => l.id)).toEqual(['course']);
  });

  it('searches summaries, descriptions and hashtags', () => {
    expect(filterListings(listings, 'multi-agent', null).map((l) => l.id)).toEqual(['course']);
    expect(filterListings(listings, 'organic cotton', null).map((l) => l.id)).toEqual(['tshirt']);
    expect(filterListings(listings, 'clothing', null).map((l) => l.id)).toEqual(['tshirt']);
  });

  it('filters by active tag, combined with the query', () => {
    expect(filterListings(listings, '', 'merch').map((l) => l.id)).toEqual(['stickers', 'tshirt']);
    expect(filterListings(listings, 'shirt', 'merch').map((l) => l.id)).toEqual(['tshirt']);
    expect(filterListings(listings, 'bootcamp', 'merch')).toHaveLength(0);
  });
});

describe('collectTags', () => {
  it('returns sorted unique tags across listings', () => {
    const listings = dedupeListings([
      makeEvent({
        id: 'a',
        tags: [
          ['d', 'a'],
          ['title', 'A'],
          ['t', 'merch'],
          ['t', 'stickers'],
        ],
      }),
      makeEvent({
        id: 'b',
        tags: [
          ['d', 'b'],
          ['title', 'B'],
          ['t', 'merch'],
          ['t', 'clothing'],
        ],
      }),
    ]);
    expect(collectTags(listings)).toEqual(['clothing', 'merch', 'stickers']);
  });
});
