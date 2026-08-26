/**
 * NIP-99 classified listings (kind 30402) — parsing and formatting helpers.
 *
 * A listing is a parameterized-replaceable Nostr event: the `d` tag identifies
 * the product, and the newest event per (pubkey, d) pair wins. Metadata lives
 * in tags; the event content is a markdown-ish long description.
 *
 * Spec: https://github.com/nostr-protocol/nips/blob/master/99.md
 */

export const CLASSIFIED_LISTING_KIND = 30402;

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
}

export interface ListingPrice {
  /** Numeric amount in `currency` units (e.g. 10000 for 10,000 sats). */
  amount: number;
  /** ISO 4217 code or "SATS"/"BTC" per NIP-99 convention. */
  currency: string;
  /** Optional recurrence (e.g. "month") for subscription-style listings. */
  frequency?: string;
}

export interface Listing {
  /** Event id of the newest version of this listing. */
  id: string;
  /** Author pubkey (hex). */
  pubkey: string;
  /** `d` tag — the stable per-product identifier. */
  dTag: string;
  title: string;
  summary: string;
  /** Long description (markdown-ish plain text) from the event content. */
  description: string;
  price: ListingPrice | null;
  /** Image URLs from `image` tags (first entry of each tag). */
  images: string[];
  /** Lowercased `t` hashtags, deduplicated, for filtering. */
  tags: string[];
  location: string | null;
  status: 'active' | 'sold';
  /**
   * Gamma Markets `visibility` tag (used by Robotechy/Eden tooling alongside
   * NIP-99). Absent on plain NIP-99 listings.
   */
  visibility: 'hidden' | 'on-sale' | 'pre-order' | null;
  /** Gamma `stock` tag — null when the listing doesn't track stock. */
  stock: number | null;
  /** Unix seconds: `published_at` tag when present, else event created_at. */
  publishedAt: number;
  /** Event created_at — used to pick the newest version per d tag. */
  createdAt: number;
  /**
   * d-tags of the kind-30406 shipping zones this listing references via Gamma
   * `shipping_option` tags ("30406:<pubkey>:<d>"). The product page resolves
   * these against the merchant's shipping-zone events to show P&P.
   */
  shippingZoneIds: string[];
}

/** Gamma Markets shipping-option kind referenced by `shipping_option` tags. */
const SHIPPING_OPTION_KIND = '30406';

/** Zone d-tags from `shipping_option` coordinate refs (other kinds ignored). */
function parseShippingZoneIds(event: NostrEvent): string[] {
  const ids = event.tags
    .filter((t) => t[0] === 'shipping_option' && typeof t[1] === 'string')
    .map((t) => t[1].split(':'))
    // slice(2).join(':') preserves d-tags that themselves contain ':'.
    .filter((parts) => parts.length >= 3 && parts[0] === SHIPPING_OPTION_KIND)
    .map((parts) => parts.slice(2).join(':'))
    .filter(Boolean);
  return [...new Set(ids)];
}

/** First value of the first tag with the given name, or null. */
function tagValue(event: NostrEvent, name: string): string | null {
  const tag = event.tags.find((t) => t[0] === name && typeof t[1] === 'string');
  return tag ? tag[1] : null;
}

/** All (non-empty) first values of tags with the given name. */
function tagValues(event: NostrEvent, name: string): string[] {
  return event.tags
    .filter((t) => t[0] === name && typeof t[1] === 'string' && t[1])
    .map((t) => t[1]);
}

function parsePrice(event: NostrEvent): ListingPrice | null {
  const tag = event.tags.find((t) => t[0] === 'price' && typeof t[1] === 'string');
  if (!tag) return null;
  const amount = Number(tag[1]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency = typeof tag[2] === 'string' && tag[2] ? tag[2].toUpperCase() : 'SATS';
  const frequency = typeof tag[3] === 'string' && tag[3] ? tag[3] : undefined;
  return { amount, currency, ...(frequency ? { frequency } : {}) };
}

/**
 * Parse a kind-30402 event into a Listing. Returns null for events that are
 * not usable listings (wrong kind, missing d tag or title).
 */
export function parseListing(event: NostrEvent): Listing | null {
  if (event.kind !== CLASSIFIED_LISTING_KIND) return null;

  const dTag = tagValue(event, 'd');
  const title = tagValue(event, 'title');
  if (dTag === null || !title) return null;

  const publishedAtRaw = Number(tagValue(event, 'published_at'));
  const status = tagValue(event, 'status');
  const visibility = tagValue(event, 'visibility');
  const stockRaw = tagValue(event, 'stock');
  const stock = stockRaw !== null ? Number(stockRaw) : NaN;

  return {
    id: event.id,
    pubkey: event.pubkey,
    dTag,
    title,
    summary: tagValue(event, 'summary') ?? '',
    description: event.content ?? '',
    price: parsePrice(event),
    images: [...new Set(tagValues(event, 'image'))],
    tags: [...new Set(tagValues(event, 't').map((t) => t.toLowerCase()))],
    location: tagValue(event, 'location'),
    status: status === 'sold' ? 'sold' : 'active',
    visibility:
      visibility === 'hidden' || visibility === 'on-sale' || visibility === 'pre-order'
        ? visibility
        : null,
    stock: Number.isFinite(stock) && stock >= 0 ? stock : null,
    publishedAt:
      Number.isFinite(publishedAtRaw) && publishedAtRaw > 0 ? publishedAtRaw : event.created_at,
    createdAt: event.created_at,
    shippingZoneIds: parseShippingZoneIds(event),
  };
}

/**
 * Whether a listing belongs on the public storefront: Gamma-style `hidden`
 * listings are owner-only (matches the Robotechy/Eden visibility gate).
 */
export function isPubliclyVisible(listing: Listing): boolean {
  return listing.visibility !== 'hidden';
}

/** Sold via NIP-99 `status`, or out of stock via the Gamma `stock` tag. */
export function isSoldOut(listing: Listing): boolean {
  return listing.status === 'sold' || listing.stock === 0;
}

/**
 * Reduce raw events to the newest listing per (pubkey, d) pair — kind 30402 is
 * parameterized-replaceable, so older versions are superseded — sorted newest
 * first by published date.
 */
export function dedupeListings(events: NostrEvent[]): Listing[] {
  const byKey = new Map<string, Listing>();
  for (const event of events) {
    const listing = parseListing(event);
    if (!listing) continue;
    const key = `${listing.pubkey}:${listing.dTag}`;
    const existing = byKey.get(key);
    if (!existing || listing.createdAt > existing.createdAt) {
      byKey.set(key, listing);
    }
  }
  return [...byKey.values()].sort((a, b) => b.publishedAt - a.publishedAt);
}

/**
 * Newest usable listing for one (pubkey, d) address, or null. Guards against
 * relays returning events outside the requested filter, so the product page
 * can trust the result matches its address.
 */
export function selectListing(events: NostrEvent[], pubkey: string, dTag: string): Listing | null {
  return (
    dedupeListings(events).find((listing) => listing.pubkey === pubkey && listing.dTag === dTag) ??
    null
  );
}

/** Currency symbols matching the Robotechy/Eden formatter. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  BTC: '₿',
};

/** "10,000 sats", "₿0.001", "$25.00", with an optional " / month" suffix.
 *  Fiat renders with exactly two decimals ("£2.50", never "£2.5") so item
 *  prices and shipping costs read consistently. */
export function formatPrice(price: ListingPrice | null): string {
  if (!price) return 'Contact for price';
  const { amount, currency, frequency } = price;
  const isSats = currency === 'SATS' || currency === 'SAT';
  const isBtc = currency === 'BTC';
  const formattedAmount = amount.toLocaleString(
    'en-US',
    isSats
      ? { maximumFractionDigits: 0 }
      : isBtc
        ? { maximumFractionDigits: 8 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );
  const symbol = CURRENCY_SYMBOLS[currency];
  const base = isSats
    ? `${formattedAmount} ${formattedAmount === '1' ? 'sat' : 'sats'}`
    : symbol
      ? `${symbol}${formattedAmount}`
      : `${formattedAmount} ${currency}`;
  return frequency ? `${base} / ${frequency}` : base;
}

/**
 * Case-insensitive client-side search across title, summary, description and
 * hashtags, plus optional single-tag filtering.
 */
export function filterListings(
  listings: Listing[],
  query: string,
  activeTag: string | null
): Listing[] {
  const q = query.trim().toLowerCase();
  return listings.filter((listing) => {
    if (activeTag && !listing.tags.includes(activeTag)) return false;
    if (!q) return true;
    return (
      listing.title.toLowerCase().includes(q) ||
      listing.summary.toLowerCase().includes(q) ||
      listing.description.toLowerCase().includes(q) ||
      listing.tags.some((tag) => tag.includes(q))
    );
  });
}

/** Sorted list of every distinct hashtag across the given listings. */
export function collectTags(listings: Listing[]): string[] {
  return [...new Set(listings.flatMap((listing) => listing.tags))].sort();
}
