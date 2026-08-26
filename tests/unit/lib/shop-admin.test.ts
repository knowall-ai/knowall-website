import { describe, it, expect } from 'vitest';
import {
  BLOSSOM_AUTH_KIND,
  buildBlossomAuthEvent,
  buildCollectionEvent,
  buildDeleteEvent,
  buildProductEvent,
  buildShippingZoneEvent,
  COLLECTION_KIND,
  collectionEventToFormData,
  dedupeByDTag,
  EMPTY_COLLECTION_FORM,
  EMPTY_PRODUCT_FORM,
  EMPTY_SHIPPING_FORM,
  generateProductId,
  getDTag,
  isShopOwner,
  parseCollection,
  parseShippingZone,
  PRODUCT_KIND,
  productEventToFormData,
  SHIPPING_OPTION_KIND,
  shippingZoneEventToFormData,
  slugify,
  validateCollectionForm,
  validateProductForm,
  validateShippingZoneForm,
  type ProductFormData,
  type ShippingZoneFormData,
} from '@/lib/shop-admin';
import { KNOWALL_PUBKEY } from '@/lib/nostr';
import type { NostrEvent } from '@/lib/story-notes';

const OTHER_PUBKEY = 'a'.repeat(64);

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'event-1',
    pubkey: KNOWALL_PUBKEY,
    created_at: 1_700_000_000,
    kind: PRODUCT_KIND,
    content: 'A pack of stickers.',
    tags: [
      ['d', 'sticker-pack'],
      ['title', 'Sticker Pack'],
      ['summary', 'Ten stickers'],
      ['price', '10000', 'SATS'],
      ['image', 'https://example.com/b.png', '', '1'],
      ['image', 'https://example.com/a.png', '', '0'],
      ['status', 'active'],
      ['visibility', 'on-sale'],
      ['stock', '5'],
      ['location', 'United Kingdom'],
      ['t', 'stickers'],
      ['shipping_option', `30406:${KNOWALL_PUBKEY}:ship-uk`],
      ['published_at', '1690000000'],
      // Unmanaged Gamma tags that edits must preserve.
      ['weight', '0.1', 'kg'],
      ['a', `30405:${KNOWALL_PUBKEY}:collection-merch`],
    ],
    ...overrides,
  };
}

describe('isShopOwner', () => {
  it('is true only for the KnowAll company pubkey', () => {
    expect(isShopOwner(KNOWALL_PUBKEY)).toBe(true);
    expect(isShopOwner(OTHER_PUBKEY)).toBe(false);
    expect(isShopOwner('')).toBe(false);
    expect(isShopOwner(null)).toBe(false);
    expect(isShopOwner(undefined)).toBe(false);
  });
});

describe('slugify / generateProductId', () => {
  it('slugifies titles into URL-safe identifiers', () => {
    expect(slugify('KnowAll AI Sticker Pack!')).toBe('knowall-ai-sticker-pack');
    expect(slugify('  --Weird__ Input--  ')).toBe('weird-input');
    expect(slugify('')).toBe('product');
  });

  it('generates unique ids sharing the slug prefix', () => {
    const a = generateProductId('Sticker Pack');
    const b = generateProductId('Sticker Pack');
    expect(a).toMatch(/^sticker-pack-[0-9a-f]{8}$/);
    expect(a).not.toBe(b);
  });
});

describe('dedupeByDTag', () => {
  it('keeps only the newest event per (pubkey, d)', () => {
    const older = makeEvent({ id: 'old', created_at: 100 });
    const newer = makeEvent({ id: 'new', created_at: 200 });
    const other = makeEvent({
      id: 'other',
      created_at: 150,
      tags: [
        ['d', 'other-product'],
        ['title', 'Other'],
      ],
    });
    const result = dedupeByDTag([older, newer, other]);
    expect(result.map((e) => e.id)).toEqual(['new', 'other']);
  });

  it('ignores events without a d tag', () => {
    expect(dedupeByDTag([makeEvent({ tags: [['title', 'No d']] })])).toEqual([]);
  });
});

describe('validateProductForm', () => {
  const valid: ProductFormData = {
    ...EMPTY_PRODUCT_FORM,
    title: 'Sticker Pack',
    priceAmount: '10000',
    priceCurrency: 'SATS',
  };

  it('accepts a minimal valid form', () => {
    expect(validateProductForm(valid)).toEqual([]);
  });

  it('rejects missing title, bad price, bad image URL and bad stock', () => {
    expect(validateProductForm({ ...valid, title: ' ' })).not.toEqual([]);
    expect(validateProductForm({ ...valid, priceAmount: '' })).not.toEqual([]);
    expect(validateProductForm({ ...valid, priceAmount: '-1' })).not.toEqual([]);
    expect(validateProductForm({ ...valid, priceAmount: 'abc' })).not.toEqual([]);
    expect(validateProductForm({ ...valid, images: ['ftp://x'] })).not.toEqual([]);
    expect(validateProductForm({ ...valid, stock: '1.5' })).not.toEqual([]);
    expect(validateProductForm({ ...valid, stock: '-2' })).not.toEqual([]);
  });
});

describe('buildProductEvent', () => {
  const form: ProductFormData = {
    id: '',
    title: ' Sticker Pack ',
    summary: 'Ten stickers',
    description: 'Lovely stickers.',
    priceAmount: '10000',
    priceCurrency: 'sats',
    images: ['https://example.com/a.png', '', 'https://example.com/b.png'],
    status: 'active',
    visibility: 'on-sale',
    stock: '5',
    location: 'United Kingdom',
    categories: ['stickers', 'stickers', ' ', 'merch'],
    shippingRefs: ['ship-uk', 'ship-uk', 'ship-eu'],
  };

  it('builds a complete kind-30402 template for a new product', () => {
    const event = buildProductEvent(form);
    expect(event.kind).toBe(PRODUCT_KIND);
    expect(event.content).toBe('Lovely stickers.');
    const dTag = event.tags.find(([n]) => n === 'd')?.[1];
    expect(dTag).toMatch(/^sticker-pack-[0-9a-f]{8}$/);
    expect(event.tags).toContainEqual(['title', 'Sticker Pack']);
    expect(event.tags).toContainEqual(['price', '10000', 'SATS']);
    // Empty image rows dropped; order preserved via the sort-order field.
    expect(event.tags.filter(([n]) => n === 'image')).toEqual([
      ['image', 'https://example.com/a.png', '', '0'],
      ['image', 'https://example.com/b.png', '', '1'],
    ]);
    // Categories deduplicated and trimmed.
    expect(event.tags.filter(([n]) => n === 't')).toEqual([
      ['t', 'stickers'],
      ['t', 'merch'],
    ]);
    // Shipping refs expand to Gamma coordinates against the company key.
    expect(event.tags.filter(([n]) => n === 'shipping_option')).toEqual([
      ['shipping_option', `${SHIPPING_OPTION_KIND}:${KNOWALL_PUBKEY}:ship-uk`],
      ['shipping_option', `${SHIPPING_OPTION_KIND}:${KNOWALL_PUBKEY}:ship-eu`],
    ]);
    expect(event.tags).toContainEqual(['status', 'active']);
    expect(event.tags).toContainEqual(['visibility', 'on-sale']);
    expect(event.tags).toContainEqual(['stock', '5']);
  });

  it('reuses the d tag and published_at, and preserves unmanaged tags on edit', () => {
    const existing = makeEvent();
    const edited = buildProductEvent({ ...form, id: 'sticker-pack', status: 'sold' }, existing);
    expect(getDTag({ tags: edited.tags })).toBe('sticker-pack');
    // Original published_at kept — replaceable events must not clobber it.
    expect(edited.tags).toContainEqual(['published_at', '1690000000']);
    // Unmanaged tags carried forward.
    expect(edited.tags).toContainEqual(['weight', '0.1', 'kg']);
    expect(edited.tags).toContainEqual(['a', `30405:${KNOWALL_PUBKEY}:collection-merch`]);
    // Managed tags rebuilt, not duplicated.
    expect(edited.tags.filter(([n]) => n === 'status')).toEqual([['status', 'sold']]);
    expect(edited.tags.filter(([n]) => n === 'published_at')).toHaveLength(1);
  });
});

describe('productEventToFormData', () => {
  it('round-trips an event into editable form data', () => {
    const data = productEventToFormData(makeEvent());
    expect(data).toMatchObject({
      id: 'sticker-pack',
      title: 'Sticker Pack',
      summary: 'Ten stickers',
      description: 'A pack of stickers.',
      priceAmount: '10000',
      priceCurrency: 'SATS',
      status: 'active',
      visibility: 'on-sale',
      stock: '5',
      location: 'United Kingdom',
      categories: ['stickers'],
      shippingRefs: ['ship-uk'],
    });
    // Images ordered by the Gamma sort-order field, not tag order.
    expect(data.images).toEqual(['https://example.com/a.png', 'https://example.com/b.png']);
  });

  it('defaults sensibly for sparse plain NIP-99 events', () => {
    const data = productEventToFormData(
      makeEvent({
        tags: [
          ['d', 'bare'],
          ['title', 'Bare'],
          ['price', '21', 'gbp'],
        ],
      })
    );
    expect(data.priceCurrency).toBe('GBP');
    expect(data.status).toBe('active');
    expect(data.visibility).toBe('on-sale');
    expect(data.images).toEqual(['']); // one blank row for the form
    expect(data.shippingRefs).toEqual([]);
  });
});

describe('buildDeleteEvent', () => {
  it('builds a NIP-09 kind-5 request against the addressable coordinate', () => {
    const event = buildDeleteEvent(PRODUCT_KIND, KNOWALL_PUBKEY, 'sticker-pack', 'Product deleted');
    expect(event.kind).toBe(5);
    expect(event.content).toBe('Product deleted');
    expect(event.tags).toEqual([
      ['a', `${PRODUCT_KIND}:${KNOWALL_PUBKEY}:sticker-pack`],
      ['k', String(PRODUCT_KIND)],
    ]);
  });

  it('refuses to build without a d tag', () => {
    expect(() => buildDeleteEvent(PRODUCT_KIND, KNOWALL_PUBKEY, '', 'x')).toThrow();
  });
});

describe('shipping zones (kind 30406)', () => {
  const form: ShippingZoneFormData = {
    ...EMPTY_SHIPPING_FORM,
    title: 'United Kingdom',
    priceAmount: '2.50',
    priceCurrency: 'gbp',
    countries: ['gb', 'GB', ' im '],
    service: 'standard',
    carrier: 'Royal Mail',
  };

  it('validates the form', () => {
    expect(validateShippingZoneForm(form)).toEqual([]);
    expect(validateShippingZoneForm({ ...form, title: '' })).not.toEqual([]);
    expect(validateShippingZoneForm({ ...form, priceAmount: 'x' })).not.toEqual([]);
    expect(validateShippingZoneForm({ ...form, countries: [] })).not.toEqual([]);
    expect(validateShippingZoneForm({ ...form, countries: ['GBR'] })).not.toEqual([]);
  });

  it('serialises the zone with uppercased, deduplicated countries in one multi-value tag', () => {
    const event = buildShippingZoneEvent(form);
    expect(event.kind).toBe(SHIPPING_OPTION_KIND);
    expect(getDTag({ tags: event.tags })).toMatch(/^ship-united-kingdom-[0-9a-f]{8}$/);
    expect(event.tags).toContainEqual(['title', 'United Kingdom']);
    expect(event.tags).toContainEqual(['price', '2.50', 'GBP']);
    expect(event.tags).toContainEqual(['country', 'GB', 'IM']);
    expect(event.tags).toContainEqual(['service', 'standard']);
    expect(event.tags).toContainEqual(['carrier', 'Royal Mail']);
  });

  it('keeps the d tag and unmanaged tags on edit', () => {
    const existing: NostrEvent = {
      id: 'zone-1',
      pubkey: KNOWALL_PUBKEY,
      created_at: 100,
      kind: SHIPPING_OPTION_KIND,
      content: '',
      tags: [
        ['d', 'ship-uk'],
        ['title', 'UK'],
        ['price', '500', 'SATS'],
        ['country', 'GB'],
        ['service', 'standard'],
        ['duration', '2', '4', 'days'], // unmanaged — must survive
      ],
    };
    const edited = buildShippingZoneEvent({ ...form, id: 'ship-uk' }, existing);
    expect(getDTag({ tags: edited.tags })).toBe('ship-uk');
    expect(edited.tags).toContainEqual(['duration', '2', '4', 'days']);
    expect(edited.tags.filter(([n]) => n === 'price')).toEqual([['price', '2.50', 'GBP']]);
  });

  it('parses zone events, including one-country-per-tag publishers', () => {
    const multi = buildShippingZoneEvent(form);
    const parsed = parseShippingZone({
      ...makeEvent({ kind: SHIPPING_OPTION_KIND }),
      tags: multi.tags,
    });
    expect(parsed).toMatchObject({
      title: 'United Kingdom',
      price: { amount: '2.50', currency: 'GBP' },
      countries: ['GB', 'IM'],
      service: 'standard',
      carrier: 'Royal Mail',
    });

    const perTag = parseShippingZone(
      makeEvent({
        kind: SHIPPING_OPTION_KIND,
        tags: [
          ['d', 'ship-eu'],
          ['title', 'Europe'],
          ['price', '4.50', 'GBP'],
          ['country', 'FR'],
          ['country', 'DE'],
        ],
      })
    );
    expect(perTag?.countries).toEqual(['FR', 'DE']);
    expect(perTag?.service).toBe('standard');
  });

  it('rejects non-zone events and round-trips into form data', () => {
    expect(parseShippingZone(makeEvent())).toBeNull();
    const event = makeEvent({
      kind: SHIPPING_OPTION_KIND,
      tags: buildShippingZoneEvent(form).tags,
    });
    expect(shippingZoneEventToFormData(event)).toMatchObject({
      title: 'United Kingdom',
      priceAmount: '2.50',
      priceCurrency: 'GBP',
      countries: ['GB', 'IM'],
      service: 'standard',
      carrier: 'Royal Mail',
    });
  });
});

describe('collections (kind 30405)', () => {
  it('validates the form', () => {
    expect(validateCollectionForm({ ...EMPTY_COLLECTION_FORM, title: 'Merch' })).toEqual([]);
    expect(validateCollectionForm({ ...EMPTY_COLLECTION_FORM, title: '' })).not.toEqual([]);
    expect(
      validateCollectionForm({ ...EMPTY_COLLECTION_FORM, title: 'x', image: 'not-a-url' })
    ).not.toEqual([]);
  });

  it('stores membership as coordinate `a` refs against the merchant pubkey', () => {
    const event = buildCollectionEvent(
      {
        ...EMPTY_COLLECTION_FORM,
        title: 'Merch',
        description: 'All the merch',
        productIds: ['sticker-pack', 'sticker-pack', 'tminus15-book'],
      },
      KNOWALL_PUBKEY
    );
    expect(event.kind).toBe(COLLECTION_KIND);
    expect(event.content).toBe('All the merch');
    expect(getDTag({ tags: event.tags })).toMatch(/^collection-merch-[0-9a-f]{8}$/);
    expect(event.tags.filter(([n]) => n === 'a')).toEqual([
      ['a', `${PRODUCT_KIND}:${KNOWALL_PUBKEY}:sticker-pack`],
      ['a', `${PRODUCT_KIND}:${KNOWALL_PUBKEY}:tminus15-book`],
    ]);
  });

  it('parses and round-trips collection events into form data', () => {
    const event = makeEvent({
      kind: COLLECTION_KIND,
      content: 'All the merch',
      tags: [
        ['d', 'collection-merch'],
        ['title', 'Merch'],
        ['image', 'https://example.com/cover.png'],
        ['a', `${PRODUCT_KIND}:${KNOWALL_PUBKEY}:sticker-pack`],
        ['a', `30406:${KNOWALL_PUBKEY}:ship-uk`], // non-product ref ignored
      ],
    });
    expect(parseCollection(event)).toEqual({
      id: 'collection-merch',
      title: 'Merch',
      description: 'All the merch',
      image: 'https://example.com/cover.png',
      products: [`${PRODUCT_KIND}:${KNOWALL_PUBKEY}:sticker-pack`],
    });
    expect(collectionEventToFormData(event)).toEqual({
      id: 'collection-merch',
      title: 'Merch',
      description: 'All the merch',
      image: 'https://example.com/cover.png',
      productIds: ['sticker-pack'],
    });
    expect(parseCollection(makeEvent())).toBeNull();
  });
});

describe('buildBlossomAuthEvent', () => {
  it('builds a kind-24242 upload authorization with a 10-minute expiry', () => {
    const event = buildBlossomAuthEvent('ab'.repeat(32), 'photo.png', 1_700_000_000);
    expect(event.kind).toBe(BLOSSOM_AUTH_KIND);
    expect(event.created_at).toBe(1_700_000_000);
    expect(event.tags).toEqual([
      ['t', 'upload'],
      ['x', 'ab'.repeat(32)],
      ['expiration', '1700000600'],
    ]);
    expect(event.content).toContain('photo.png');
  });
});
