/**
 * Store-owner catalog management — pure builders and parsers.
 *
 * Turns owner-form data into unsigned Nostr event templates for the NIP-99 +
 * Gamma Markets catalog. Signing happens in the owner's NIP-07 extension
 * (components/auth/nostr-auth-provider.tsx) and publishing via lib/relay.ts,
 * so everything here is free of React/browser dependencies and directly
 * unit-testable. Ported from the robotechy.com / edenweeks.art admin UIs.
 *
 * Gamma Markets terminology (spec:
 * https://github.com/GammaMarkets/market-spec/blob/main/spec.md):
 *   - kind 30402 — product listing (NIP-99 classified listing).
 *   - kind 30405 — collection: addressable grouping of products; drives the
 *     storefront's category taxonomy.
 *   - kind 30406 — shipping option (zone name / destination countries / cost).
 *   - `t` tags   — free-text categories on an individual product.
 *
 * All three kinds are addressable (parameterized-replaceable): the newest
 * event per (pubkey, d) wins, so edits fetch the latest version and republish
 * with the same `d` tag, preserving any tags the form doesn't manage.
 */

import { KNOWALL_PUBKEY } from './nostr';
import { CLASSIFIED_LISTING_KIND } from './nip99';
import type { NostrEvent } from './story-notes';
import type { EventTemplate } from './story-social';

export const PRODUCT_KIND = CLASSIFIED_LISTING_KIND; // 30402
export const COLLECTION_KIND = 30405;
export const SHIPPING_OPTION_KIND = 30406;
export const DELETE_KIND = 5; // NIP-09 deletion request
export const BLOSSOM_AUTH_KIND = 24242; // Blossom (BUD-02) upload authorization

/**
 * True when `pubkey` is the KnowAll AI company key — i.e. the signed-in user
 * owns the shop catalog. Owner-only UI is gated on this; it mirrors what
 * relays enforce anyway (only the company key can replace its own addressable
 * events), so the gate is cosmetic, not a security boundary.
 */
export function isShopOwner(pubkey: string | null | undefined): boolean {
  return Boolean(pubkey) && pubkey === KNOWALL_PUBKEY;
}

/** The addressable `d` identifier of an event, or undefined if absent. */
export function getDTag(event: Pick<NostrEvent, 'tags'>): string | undefined {
  return event.tags.find(([name]) => name === 'd')?.[1];
}

/** Slugify a title into a stable, URL-safe d-tag identifier. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'product'
  );
}

/** A short, cryptographically-random hex suffix for uniquifying d-tags. */
function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

/** Generate a fresh, collision-resistant d-tag for a new listing. */
export function generateProductId(title: string): string {
  return `${slugify(title)}-${randomSuffix()}`;
}

/**
 * Reduce raw addressable events to the newest per (pubkey, d) pair — older
 * versions are superseded. Order: newest created_at first.
 */
export function dedupeByDTag(events: NostrEvent[]): NostrEvent[] {
  const byKey = new Map<string, NostrEvent>();
  for (const event of events) {
    const dTag = getDTag(event);
    if (dTag === undefined) continue;
    const key = `${event.pubkey}:${dTag}`;
    const existing = byKey.get(key);
    if (!existing || event.created_at > existing.created_at) byKey.set(key, event);
  }
  return [...byKey.values()].sort((a, b) => b.created_at - a.created_at);
}

/* ---------------------------------------------------------------------------
 * Products (kind 30402)
 * ------------------------------------------------------------------------- */

export type ProductVisibility = 'on-sale' | 'pre-order' | 'hidden';
export type ProductStatus = 'active' | 'sold';

export interface ProductFormData {
  /** d-tag identifier. Empty when creating; reused verbatim when editing. */
  id?: string;
  title: string;
  summary?: string;
  /** Markdown-ish description -> event content. */
  description?: string;
  priceAmount: string;
  priceCurrency: string;
  /** Image URLs in display order. */
  images: string[];
  /** NIP-99 status — the storefront's Sold Out gate. */
  status: ProductStatus;
  /** Gamma visibility — `hidden` keeps a listing off the public storefront. */
  visibility: ProductVisibility;
  /** Stock count as a string; blank = no stock tag (untracked). */
  stock?: string;
  location?: string;
  /** Free-text `t` categories. */
  categories: string[];
  /** d-tags of the kind-30406 shipping zones this product ships with. */
  shippingRefs: string[];
}

export const EMPTY_PRODUCT_FORM: ProductFormData = {
  id: '',
  title: '',
  summary: '',
  description: '',
  priceAmount: '',
  priceCurrency: 'SATS',
  images: [''],
  status: 'active',
  visibility: 'on-sale',
  stock: '',
  location: '',
  categories: [],
  shippingRefs: [],
};

/** Tag names the product form owns and fully rebuilds on every save. */
const MANAGED_PRODUCT_TAGS = new Set([
  'd',
  'title',
  'summary',
  'price',
  'image',
  'status',
  'visibility',
  'stock',
  'location',
  't',
  'shipping_option',
  'published_at',
  'client',
]);

/** Validate product form input; returns a list of human-readable errors. */
export function validateProductForm(data: ProductFormData): string[] {
  const errors: string[] = [];
  if (!data.title?.trim()) errors.push('Title is required.');
  const amount = Number(data.priceAmount);
  if (data.priceAmount?.trim() === '' || !Number.isFinite(amount) || amount < 0) {
    errors.push('Price must be a non-negative number.');
  }
  if (!data.priceCurrency?.trim()) errors.push('Currency is required.');
  for (const url of data.images) {
    if (url.trim() && !/^https?:\/\//i.test(url.trim())) {
      errors.push(`Image URL must start with http(s): "${url}"`);
    }
  }
  if (data.stock !== undefined && data.stock.trim() !== '') {
    const stock = Number(data.stock);
    if (!Number.isInteger(stock) || stock < 0) errors.push('Stock must be a non-negative integer.');
  }
  return errors;
}

/**
 * Build the unsigned kind-30402 template for a product listing.
 *
 * On edit, pass the existing (latest) event so unmanaged tags (spec, weight,
 * dim, geohash, collection `a` refs, …) are preserved and the original
 * `published_at` is kept — the new event replaces the old because it carries
 * the same `d` tag. Never build an edit from a stale parse: fetch-latest,
 * merge, republish.
 */
export function buildProductEvent(data: ProductFormData, existing?: NostrEvent): EventTemplate {
  const now = Math.floor(Date.now() / 1000);
  const dTag = data.id?.trim() || (existing && getDTag(existing)) || generateProductId(data.title);

  const publishedAt =
    existing?.tags.find(([name]) => name === 'published_at')?.[1] || now.toString();

  const tags: string[][] = [
    ['d', dTag],
    ['title', data.title.trim()],
  ];

  if (data.summary?.trim()) tags.push(['summary', data.summary.trim()]);

  tags.push(['price', data.priceAmount.trim(), data.priceCurrency.trim().toUpperCase()]);

  // Images: ["image", url, dimensions, sort-order] (Gamma). Dimensions unknown -> "".
  data.images
    .map((url) => url.trim())
    .filter(Boolean)
    .forEach((url, index) => tags.push(['image', url, '', index.toString()]));

  if (data.status === 'sold') tags.push(['status', 'sold']);
  else tags.push(['status', 'active']);

  tags.push(['visibility', data.visibility]);

  if (data.stock !== undefined && data.stock.trim() !== '') {
    tags.push(['stock', data.stock.trim()]);
  }

  if (data.location?.trim()) tags.push(['location', data.location.trim()]);

  // De-duplicated, non-empty category `t` tags.
  [...new Set(data.categories.map((c) => c.trim()).filter(Boolean))].forEach((category) =>
    tags.push(['t', category])
  );

  // Shipping zones the product ships with: refs to the owner's kind-30406
  // events by addressable coordinate, matching the Gamma checkout flow.
  const ownerPubkey = existing?.pubkey ?? KNOWALL_PUBKEY;
  [...new Set(data.shippingRefs.map((ref) => ref.trim()).filter(Boolean))].forEach((dRef) =>
    tags.push(['shipping_option', `${SHIPPING_OPTION_KIND}:${ownerPubkey}:${dRef}`])
  );

  tags.push(['published_at', publishedAt]);

  // Preserve tags the form does not manage (spec, weight, dim, g, a, ...).
  if (existing) {
    for (const tag of existing.tags) {
      if (!MANAGED_PRODUCT_TAGS.has(tag[0])) tags.push(tag);
    }
  }

  return {
    kind: PRODUCT_KIND,
    content: data.description ?? existing?.content ?? '',
    tags,
    created_at: now,
  };
}

/** Map the latest product event into editable form data. */
export function productEventToFormData(event: NostrEvent): ProductFormData {
  const get = (name: string) => event.tags.find(([n]) => n === name)?.[1];
  const priceTag = event.tags.find(([n]) => n === 'price');
  const visibility = get('visibility');
  const images = event.tags
    .filter(([n]) => n === 'image')
    .map(([, url, , sortOrder]) => ({
      url: url ?? '',
      sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ url }) => url)
    .filter(Boolean);
  return {
    id: get('d') || '',
    title: get('title') || '',
    summary: get('summary') || '',
    description: event.content || '',
    priceAmount: priceTag?.[1] || '',
    priceCurrency: (priceTag?.[2] || 'SATS').toUpperCase(),
    images: images.length > 0 ? images : [''],
    status: get('status') === 'sold' ? 'sold' : 'active',
    visibility:
      visibility === 'hidden' || visibility === 'pre-order' || visibility === 'on-sale'
        ? visibility
        : 'on-sale',
    stock: get('stock') || '',
    location: get('location') || '',
    categories: event.tags.filter(([n]) => n === 't').map(([, t]) => t ?? ''),
    // shipping_option refs are "30406:<pubkey>:<d>" — keep the zone's d-tag.
    // slice(2).join(':') preserves d-tags that themselves contain ':'.
    shippingRefs: event.tags
      .filter(([n, ref]) => n === 'shipping_option' && (ref ?? '').split(':').length >= 3)
      .map(([, ref]) => (ref as string).split(':').slice(2).join(':'))
      .filter(Boolean),
  };
}

/* ---------------------------------------------------------------------------
 * NIP-09 deletion requests (kind 5)
 * ------------------------------------------------------------------------- */

/**
 * Build a NIP-09 deletion request that tombstones one addressable event.
 *
 * Mirrors PlebeianApp/market: a single kind-5 event whose reference is the
 * addressable coordinate `a = <kind>:<pubkey>:<d>`. Addressable events MUST
 * be deleted by coordinate (not `e` id) so every version sharing the `d` tag
 * is removed; the recommended `k` kind hint is included.
 */
export function buildDeleteEvent(
  kind: number,
  pubkey: string,
  dTag: string,
  reason: string
): EventTemplate {
  if (!dTag) {
    throw new Error('Cannot delete an event without a d tag (addressable identifier).');
  }
  return {
    kind: DELETE_KIND,
    content: reason,
    tags: [
      ['a', `${kind}:${pubkey}:${dTag}`],
      ['k', kind.toString()],
    ],
    created_at: Math.floor(Date.now() / 1000),
  };
}

/* ---------------------------------------------------------------------------
 * Shipping zones (kind 30406) — Gamma shipping options
 * ------------------------------------------------------------------------- */

export type ShippingService = 'standard' | 'express' | 'overnight' | 'pickup';

export interface ShippingZoneFormData {
  id?: string;
  /** Zone name, e.g. "UK Standard (Royal Mail)". */
  title: string;
  priceAmount: string;
  priceCurrency: string;
  /** ISO 3166-1 alpha-2 destination country codes. */
  countries: string[];
  service: ShippingService;
  carrier?: string;
}

export const EMPTY_SHIPPING_FORM: ShippingZoneFormData = {
  id: '',
  title: '',
  priceAmount: '',
  priceCurrency: 'SATS',
  countries: [],
  service: 'standard',
  carrier: '',
};

export interface ShippingZone {
  /** d-tag identifier. */
  id: string;
  title: string;
  price: { amount: string; currency: string };
  countries: string[];
  service: string;
  carrier?: string;
}

export function validateShippingZoneForm(data: ShippingZoneFormData): string[] {
  const errors: string[] = [];
  if (!data.title?.trim()) errors.push('Zone name is required.');
  const amount = Number(data.priceAmount);
  if (data.priceAmount?.trim() === '' || !Number.isFinite(amount) || amount < 0) {
    errors.push('Shipping price must be a non-negative number.');
  }
  if (!data.priceCurrency?.trim()) errors.push('Currency is required.');
  const countries = data.countries.map((c) => c.trim()).filter(Boolean);
  if (countries.length === 0) errors.push('At least one destination country is required.');
  for (const code of countries) {
    if (!/^[A-Za-z]{2}$/.test(code)) {
      errors.push(`Country codes must be two letters (ISO 3166-1): "${code}"`);
    }
  }
  return errors;
}

/** Build the unsigned kind-30406 template for a shipping zone. */
export function buildShippingZoneEvent(
  data: ShippingZoneFormData,
  existing?: NostrEvent
): EventTemplate {
  const now = Math.floor(Date.now() / 1000);
  const dTag =
    data.id?.trim() ||
    (existing && getDTag(existing)) ||
    `ship-${slugify(data.title)}-${randomSuffix()}`;

  const countries = [...new Set(data.countries.map((c) => c.trim().toUpperCase()).filter(Boolean))];

  const tags: string[][] = [
    ['d', dTag],
    ['title', data.title.trim()],
    ['price', data.priceAmount.trim(), data.priceCurrency.trim().toUpperCase()],
    // Gamma encodes destination countries as a single multi-value tag.
    ['country', ...countries],
    ['service', data.service],
  ];
  if (data.carrier?.trim()) tags.push(['carrier', data.carrier.trim()]);

  // Preserve Gamma tags the form does not manage (region, duration, location,
  // g, weight-*/dim-*/price-* …) so editing keeps their semantics.
  if (existing) {
    const managed = new Set(['d', 'title', 'price', 'country', 'service', 'carrier', 'client']);
    for (const tag of existing.tags) {
      if (!managed.has(tag[0])) tags.push(tag);
    }
  }

  return {
    kind: SHIPPING_OPTION_KIND,
    content: existing?.content ?? '',
    tags,
    created_at: now,
  };
}

/**
 * Parse a kind-30406 event into a ShippingZone, or null when unusable.
 * Handles both the Gamma multi-value `country` tag and one-tag-per-code
 * publishers.
 */
export function parseShippingZone(event: NostrEvent): ShippingZone | null {
  if (event.kind !== SHIPPING_OPTION_KIND) return null;
  const dTag = getDTag(event);
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  const priceTag = event.tags.find(([name]) => name === 'price');
  if (!dTag || !title || !priceTag) return null;

  const countries = event.tags
    .filter(([name]) => name === 'country')
    .flatMap(([, ...codes]) => codes)
    .filter(Boolean);

  return {
    id: dTag,
    title,
    price: { amount: priceTag[1] ?? '', currency: (priceTag[2] ?? 'SATS').toUpperCase() },
    countries,
    service: event.tags.find(([name]) => name === 'service')?.[1] || 'standard',
    carrier: event.tags.find(([name]) => name === 'carrier')?.[1],
  };
}

/** Map a shipping-zone event into editable form data. */
export function shippingZoneEventToFormData(event: NostrEvent): ShippingZoneFormData | null {
  const parsed = parseShippingZone(event);
  if (!parsed) return null;
  const service = parsed.service;
  return {
    id: parsed.id,
    title: parsed.title,
    priceAmount: parsed.price.amount,
    priceCurrency: parsed.price.currency,
    countries: parsed.countries,
    service:
      service === 'express' || service === 'overnight' || service === 'pickup'
        ? service
        : 'standard',
    carrier: parsed.carrier ?? '',
  };
}

/* ---------------------------------------------------------------------------
 * Collections (kind 30405) — the storefront's category taxonomy
 * ------------------------------------------------------------------------- */

export interface CollectionFormData {
  id?: string;
  title: string;
  description?: string;
  image?: string;
  /** d-tags of the products that belong to this collection. */
  productIds: string[];
}

export const EMPTY_COLLECTION_FORM: CollectionFormData = {
  id: '',
  title: '',
  description: '',
  image: '',
  productIds: [],
};

export interface Collection {
  /** d-tag identifier. */
  id: string;
  title: string;
  description?: string;
  image?: string;
  /** Addressable product refs ("30402:<pubkey>:<d>"). */
  products: string[];
}

export function validateCollectionForm(data: CollectionFormData): string[] {
  const errors: string[] = [];
  if (!data.title?.trim()) errors.push('Collection title is required.');
  if (data.image?.trim() && !/^https?:\/\//i.test(data.image.trim())) {
    errors.push('Collection image must be an http(s) URL.');
  }
  return errors;
}

/**
 * Build the unsigned kind-30405 template for a collection. Membership is
 * stored on the collection as `a` refs to products
 * (`30402:<merchantPubkey>:<productD>`) — the direction Gamma storefronts read.
 */
export function buildCollectionEvent(
  data: CollectionFormData,
  merchantPubkey: string,
  existing?: NostrEvent
): EventTemplate {
  const now = Math.floor(Date.now() / 1000);
  // New collections get a unique suffix so two with the same title can't
  // collide on the same addressable `d` (which would silently replace the
  // first). Edits keep the existing `d` stable.
  const dTag =
    data.id?.trim() ||
    (existing && getDTag(existing)) ||
    `collection-${slugify(data.title)}-${randomSuffix()}`;

  const tags: string[][] = [
    ['d', dTag],
    ['title', data.title.trim()],
  ];
  if (data.image?.trim()) tags.push(['image', data.image.trim()]);

  [...new Set(data.productIds.map((id) => id.trim()).filter(Boolean))].forEach((productId) =>
    tags.push(['a', `${PRODUCT_KIND}:${merchantPubkey}:${productId}`])
  );

  // Preserve unmanaged tags (summary, location, g, shipping_option) on edit.
  if (existing) {
    const managed = new Set(['d', 'title', 'image', 'a', 'client']);
    for (const tag of existing.tags) {
      if (!managed.has(tag[0])) tags.push(tag);
    }
  }

  return {
    kind: COLLECTION_KIND,
    content: data.description ?? existing?.content ?? '',
    tags,
    created_at: now,
  };
}

/** Parse a kind-30405 event into a Collection, or null when unusable. */
export function parseCollection(event: NostrEvent): Collection | null {
  if (event.kind !== COLLECTION_KIND) return null;
  const dTag = getDTag(event);
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  if (!dTag || !title) return null;
  return {
    id: dTag,
    title,
    description: event.content || undefined,
    image: event.tags.find(([name]) => name === 'image')?.[1],
    products: event.tags
      .filter(([name, ref]) => name === 'a' && (ref ?? '').startsWith(`${PRODUCT_KIND}:`))
      .map(([, ref]) => ref as string),
  };
}

/** Map a collection event into editable form data. */
export function collectionEventToFormData(event: NostrEvent): CollectionFormData | null {
  const parsed = parseCollection(event);
  if (!parsed) return null;
  return {
    id: parsed.id,
    title: parsed.title,
    description: parsed.description ?? '',
    image: parsed.image ?? '',
    // Product 'a' refs are "30402:<pubkey>:<d>" — keep the product's d-tag.
    // slice(2).join(':') preserves d-tags that themselves contain ':'.
    productIds: parsed.products.map((ref) => ref.split(':').slice(2).join(':')).filter(Boolean),
  };
}

/* ---------------------------------------------------------------------------
 * Blossom upload authorization (kind 24242, BUD-02)
 * ------------------------------------------------------------------------- */

/**
 * Build the unsigned kind-24242 authorization template for uploading a file
 * (identified by its sha-256) to a Blossom media server. Signed by the
 * owner's extension, base64-encoded, and sent as the `Authorization: Nostr …`
 * header (see lib/blossom.ts).
 */
export function buildBlossomAuthEvent(
  sha256Hex: string,
  filename: string,
  now: number = Math.floor(Date.now() / 1000)
): EventTemplate {
  return {
    kind: BLOSSOM_AUTH_KIND,
    created_at: now,
    tags: [
      ['t', 'upload'],
      ['x', sha256Hex],
      ['expiration', String(now + 600)],
    ],
    content: `Upload ${filename} to the KnowAll AI shop`,
  };
}
