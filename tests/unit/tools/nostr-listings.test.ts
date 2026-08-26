// Unit tests for the NIP-99 listings CLI's pure logic (docs/requirements.yaml
// has no entry yet — internal tooling, DevOps item #6667). No relay or signer
// access: only the YAML -> kind-30402 event mapping and helpers are tested.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  definitionToEvent,
  eventToListing,
  formatDate,
  formatPrice,
  isRemoteImage,
  latestByDtag,
  replacementCreatedAt,
  validateDefinition,
  withStatus,
  DEFINITION_KEYS,
  LISTING_KIND,
  MAX_PRICE_AMOUNT,
  PRICE_AMOUNT_ERROR,
  PRICE_KEYS,
  STATUSES,
} from '@/tools/nostr-listings/lib/listing.mjs';
import { loadDefinition } from '@/tools/nostr-listings/lib/definition.mjs';

const EXAMPLES = join(__dirname, '../../../tools/nostr-listings/examples');

const tag = (event: { tags: string[][] }, name: string) => event.tags.find((t) => t[0] === name);
const tagsNamed = (event: { tags: string[][] }, name: string) =>
  event.tags.filter((t) => t[0] === name);

describe('validateDefinition', () => {
  it('accepts a minimal valid definition', () => {
    expect(
      validateDefinition({
        d: 'thing',
        title: 'A thing',
        summary: 'A thing for sale',
        price: { amount: '10', currency: 'GBP' },
        content: 'Buy the thing',
      })
    ).toEqual([]);
  });

  it('reports every missing required field', () => {
    const errors = validateDefinition({});
    for (const field of ['"d"', '"title"', '"summary"', '"content"', '"price"']) {
      expect(errors.join('\n')).toContain(field);
    }
  });

  it('rejects non-mapping definitions, bad statuses, bad prices and whitespace d-tags', () => {
    expect(validateDefinition(null)).toHaveLength(1);
    expect(
      validateDefinition({
        d: 'has spaces',
        title: 't',
        summary: 's',
        content: 'c',
        price: { amount: 'not-a-number', currency: '' },
        status: 'pending',
        images: [42],
        tags: 'not-a-list',
        published_at: -5,
      })
    ).toEqual([
      '"d" must not contain whitespace (it is the stable listing identifier)',
      PRICE_AMOUNT_ERROR,
      '"price.currency" must be a currency code (e.g. GBP, SATS)',
      `"status" must be one of: ${STATUSES.join(', ')}`,
      '"images" must be a list of strings (local file paths or https URLs)',
      '"tags" must be a list of strings',
      '"published_at" must be a positive unix timestamp in seconds (not milliseconds) when present',
    ]);
  });

  it('rejects unknown top-level and price keys (typo protection before signing)', () => {
    const errors = validateDefinition({
      d: 'thing',
      title: 'A thing',
      summary: 'A thing for sale',
      price: { amount: '10', currency: 'GBP', frequencyy: 'month' },
      content: 'Buy the thing',
      locaton: 'UK',
    });
    expect(errors).toEqual([
      `unknown key "locaton" — allowed keys: ${DEFINITION_KEYS.join(', ')}`,
      `unknown key "price.frequencyy" — allowed keys: ${PRICE_KEYS.join(', ')}`,
    ]);
  });

  it('rejects non-finite and negative prices and out-of-range published_at', () => {
    const base = {
      d: 'thing',
      title: 'A thing',
      summary: 'A thing for sale',
      content: 'Buy the thing',
    };
    const amountError = PRICE_AMOUNT_ERROR;
    expect(validateDefinition({ ...base, price: { amount: 'Infinity', currency: 'GBP' } })).toEqual(
      [amountError]
    );
    expect(validateDefinition({ ...base, price: { amount: -5, currency: 'GBP' } })).toEqual([
      amountError,
    ]);
    // finite but absurd: a plain decimal this large passes isFinite, so the cap has to catch it
    expect(
      validateDefinition({ ...base, price: { amount: '99999999999999999999', currency: 'GBP' } })
    ).toEqual([amountError]);
    // exact boundary either side of the cap
    expect(
      validateDefinition({ ...base, price: { amount: MAX_PRICE_AMOUNT, currency: 'GBP' } })
    ).toEqual([]);
    expect(
      validateDefinition({ ...base, price: { amount: MAX_PRICE_AMOUNT + 1, currency: 'GBP' } })
    ).toEqual([amountError]);
    // Number('9007199254740991.1') rounds down onto the cap, so the cap check
    // must compare the decimal text rather than the converted number
    expect(
      validateDefinition({ ...base, price: { amount: '9007199254740991.1', currency: 'GBP' } })
    ).toEqual([amountError]);
    // ...but a zero fraction at the cap is still exactly the cap
    expect(
      validateDefinition({ ...base, price: { amount: '9007199254740991.0', currency: 'GBP' } })
    ).toEqual([]);
    // Number() would reinterpret these, but definitionToEvent signs the original
    // spelling into the price tag — so the tag would disagree with what we validated
    for (const amount of ['0x10', ' 10 ', '1e3', '+10', '.5', '010x']) {
      expect(validateDefinition({ ...base, price: { amount, currency: 'GBP' } })).toEqual([
        amountError,
      ]);
    }
    // milliseconds instead of seconds (beyond year 2100) must be rejected
    expect(
      validateDefinition({
        ...base,
        price: { amount: '10', currency: 'GBP' },
        published_at: 1786555390000,
      })
    ).toEqual([
      '"published_at" must be a positive unix timestamp in seconds (not milliseconds) when present',
    ]);
  });
});

describe('definitionToEvent', () => {
  const def = {
    d: 'widget',
    title: 'Widget',
    summary: 'A widget',
    price: { amount: 100, currency: 'SATS' },
    tags: ['merch', 'widgets'],
    images: ['https://example.com/a.png'],
    location: 'UK',
    content: 'The widget.',
  };

  it('maps every field to the right kind-30402 tag', () => {
    const event = definitionToEvent(def, { createdAt: 1700000000 });
    expect(event.kind).toBe(LISTING_KIND);
    expect(event.created_at).toBe(1700000000);
    expect(event.content).toBe('The widget.');
    expect(tag(event, 'd')).toEqual(['d', 'widget']);
    expect(tag(event, 'title')).toEqual(['title', 'Widget']);
    expect(tag(event, 'summary')).toEqual(['summary', 'A widget']);
    expect(tag(event, 'price')).toEqual(['price', '100', 'SATS']);
    expect(tag(event, 'published_at')).toEqual(['published_at', '1700000000']);
    expect(tagsNamed(event, 't')).toEqual([
      ['t', 'merch'],
      ['t', 'widgets'],
    ]);
    expect(tagsNamed(event, 'image')).toEqual([['image', 'https://example.com/a.png']]);
    expect(tag(event, 'location')).toEqual(['location', 'UK']);
    expect(tag(event, 'status')).toBeUndefined(); // omitted unless set
  });

  it('includes optional status, price frequency and explicit published_at', () => {
    const event = definitionToEvent(
      {
        ...def,
        status: 'sold',
        published_at: 1600000000,
        price: { amount: '50', currency: 'GBP', frequency: 'month' },
      },
      { createdAt: 1700000000 }
    );
    expect(tag(event, 'status')).toEqual(['status', 'sold']);
    expect(tag(event, 'price')).toEqual(['price', '50', 'GBP', 'month']);
    expect(tag(event, 'published_at')).toEqual(['published_at', '1600000000']);
  });

  it('uses supplied imageUrls (post-Blossom-upload) in order', () => {
    const event = definitionToEvent(
      { ...def, images: ['/local/a.png', 'https://example.com/b.png'] },
      { createdAt: 1, imageUrls: ['https://blossom.example/aaa.png', 'https://example.com/b.png'] }
    );
    expect(tagsNamed(event, 'image')).toEqual([
      ['image', 'https://blossom.example/aaa.png'],
      ['image', 'https://example.com/b.png'],
    ]);
  });
});

describe('example YAML definitions', () => {
  it('tminus15-book.yaml reproduces the live listing event', () => {
    const def = loadDefinition(join(EXAMPLES, 'tminus15-book.yaml'));
    expect(validateDefinition(def)).toEqual([]);
    const event = definitionToEvent(def, { createdAt: 1786555390 });
    expect(tag(event, 'd')).toEqual(['d', 'tminus15-book']);
    expect(tag(event, 'title')).toEqual([
      'title',
      'T-Minus-15: Secrets of an Elite DevOps Team (paperback)',
    ]);
    expect(tag(event, 'price')).toEqual(['price', '9.99', 'GBP']);
    expect(tag(event, 'published_at')).toEqual(['published_at', '1786555390']);
    expect(tagsNamed(event, 't').map((t) => t[1])).toEqual([
      'books',
      'devops',
      'tminus15',
      'merch',
    ]);
    expect(tagsNamed(event, 'image')).toEqual([
      ['image', 'https://www.knowall.ai/images/products/tminus15-book.png'],
    ]);
    expect(tag(event, 'location')).toEqual(['location', 'Ships from UK']);
    expect(event.content).toContain('**T-Minus-15: Secrets of an Elite DevOps Team**');
    expect(event.content).toContain('https://www.knowall.ai/#tminus15');
  });

  it('knowall-sticker-pack.yaml is valid and lists seven local images for upload', () => {
    const def = loadDefinition(join(EXAMPLES, 'knowall-sticker-pack.yaml'));
    expect(validateDefinition(def)).toEqual([]);
    expect(def.d).toBe('knowall-sticker-pack');
    expect(def.price).toEqual({ amount: '10000', currency: 'SATS' });
    expect(def.images).toHaveLength(7);
    expect(def.images!.every((i: string) => !isRemoteImage(i))).toBe(true);
    expect(def.content).toContain('**Price: 10,000 sats**');
  });
});

describe('eventToListing / latestByDtag / withStatus', () => {
  const event = {
    kind: LISTING_KIND,
    created_at: 1700000100,
    content: 'The widget.',
    tags: [
      ['d', 'widget'],
      ['title', 'Widget'],
      ['published_at', '1600000000'],
      ['price', '100', 'SATS'],
      ['t', 'merch'],
      ['image', 'https://example.com/a.png'],
      ['location', 'UK'],
    ],
  };

  it('round-trips an event into a listing (status defaults to active)', () => {
    const listing = eventToListing(event);
    expect(listing).toMatchObject({
      d: 'widget',
      title: 'Widget',
      price: { amount: '100', currency: 'SATS' },
      status: 'active',
      images: ['https://example.com/a.png'],
      tags: ['merch'],
      location: 'UK',
      publishedAt: '1600000000',
      createdAt: 1700000100,
    });
  });

  it('latestByDtag keeps only the newest revision per d-tag', () => {
    const older = { ...event, created_at: 1, tags: [...event.tags] };
    const other = { ...event, created_at: 5, tags: [['d', 'other']] };
    const latest = latestByDtag([older, other, event]);
    expect(latest.size).toBe(2);
    expect(latest.get('widget')!.created_at).toBe(1700000100);
    expect(latest.get('other')!.created_at).toBe(5);
  });

  it('latestByDtag breaks created_at ties on the lower event id (NIP-01), whatever the relay order', () => {
    const a = { ...event, id: 'aaa', tags: [...event.tags] };
    const b = { ...event, id: 'bbb', tags: [...event.tags] };
    expect(latestByDtag([a, b]).get('widget')!.id).toBe('aaa');
    expect(latestByDtag([b, a]).get('widget')!.id).toBe('aaa');
  });

  it('withStatus replaces the status tag, keeps published_at, refreshes created_at', () => {
    const sold = withStatus({ ...event, tags: [...event.tags, ['status', 'active']] }, 'sold', {
      createdAt: 1800000000,
    });
    expect(sold.created_at).toBe(1800000000);
    expect(tagsNamed(sold, 'status')).toEqual([['status', 'sold']]);
    expect(tag(sold, 'published_at')).toEqual(['published_at', '1600000000']);
    expect(sold.content).toBe('The widget.');
    expect(() => withStatus(event, 'archived')).toThrow(/status must be one of/);
  });

  it('replacementCreatedAt is strictly greater than the replaced revision (NIP-01 ties)', () => {
    expect(replacementCreatedAt(100, 200)).toBe(200); // normal case: now wins
    expect(replacementCreatedAt(200, 200)).toBe(201); // same-second republish bumps past it
    expect(replacementCreatedAt(300, 200)).toBe(301); // clock skew: still beats the old revision
    expect(replacementCreatedAt(undefined, 200)).toBe(200); // no prior revision
  });
});

describe('formatting helpers', () => {
  it('formats prices and dates for the table view', () => {
    expect(formatPrice({ amount: '9.99', currency: 'GBP' })).toBe('9.99 GBP');
    expect(formatPrice({ amount: '50', currency: 'GBP', frequency: 'month' })).toBe('50 GBP/month');
    expect(formatPrice(undefined)).toBe('-');
    expect(formatDate(1786555390)).toBe('2026-08-12');
    expect(formatDate(undefined)).toBe('-');
  });

  it('classifies remote vs local images', () => {
    expect(isRemoteImage('https://example.com/a.png')).toBe(true);
    expect(isRemoteImage('http://example.com/a.png')).toBe(true);
    expect(isRemoteImage('./local/a.png')).toBe(false);
    expect(isRemoteImage('/abs/path/a.png')).toBe(false);
  });
});
