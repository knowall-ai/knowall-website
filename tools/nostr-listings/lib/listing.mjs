// Pure NIP-99 listing logic: YAML definition <-> kind-30402 event mapping.
// No imports on purpose — everything here is unit-testable without touching
// the network, the filesystem, or the signer.

export const LISTING_KIND = 30402;

export const STATUSES = ['active', 'sold', 'inactive'];

export const DEFINITION_KEYS = [
  'd',
  'title',
  'summary',
  'price',
  'status',
  'published_at',
  'tags',
  'images',
  'location',
  'content',
];
export const PRICE_KEYS = ['amount', 'currency', 'frequency'];

/** Upper bound for published_at (2100-01-01 UTC) — catches ms-instead-of-s mistakes. */
export const MAX_PUBLISHED_AT = 4102444800;

/**
 * Upper bound for price.amount. A plain decimal like '99999999999999999999' is
 * still finite, so without a cap an absurd amount would be signed into the
 * price tag; past MAX_SAFE_INTEGER the value also stops round-tripping through
 * Number(), so the tag could no longer match what the definition asked for.
 */
export const MAX_PRICE_AMOUNT = Number.MAX_SAFE_INTEGER;

/**
 * price.amount must be a plain decimal. Number() also accepts '0x10', '1e3'
 * and ' 10 ', but definitionToEvent() signs the *original* spelling into the
 * price tag — so anything Number() reinterprets would publish a tag that
 * disagrees with the value we validated.
 */
const DECIMAL_AMOUNT = /^\d+(\.\d+)?$/;

/** Validation message for a bad price.amount (exported so tests can't drift from it). */
export const PRICE_AMOUNT_ERROR = `"price.amount" must be a plain decimal number no greater than ${MAX_PRICE_AMOUNT} (e.g. 9.99 or 10000)`;

/** True when an images[] entry is already a hosted URL (kept as-is on publish). */
export function isRemoteImage(image) {
  return /^https?:\/\//i.test(image);
}

/**
 * Validate a parsed YAML listing definition. Returns an array of
 * human-readable problems; empty array means the definition is publishable.
 */
export function validateDefinition(def) {
  const errors = [];
  if (!def || typeof def !== 'object' || Array.isArray(def)) {
    return ['definition must be a YAML mapping (key: value pairs)'];
  }
  for (const key of Object.keys(def)) {
    if (!DEFINITION_KEYS.includes(key)) {
      errors.push(`unknown key "${key}" — allowed keys: ${DEFINITION_KEYS.join(', ')}`);
    }
  }
  for (const field of ['d', 'title', 'summary', 'content']) {
    if (typeof def[field] !== 'string' || def[field].trim() === '') {
      errors.push(`"${field}" is required and must be a non-empty string`);
    }
  }
  if (typeof def.d === 'string' && /\s/.test(def.d)) {
    errors.push('"d" must not contain whitespace (it is the stable listing identifier)');
  }
  if (!def.price || typeof def.price !== 'object') {
    errors.push('"price" is required, with "amount" and "currency" keys');
  } else {
    for (const key of Object.keys(def.price)) {
      if (!PRICE_KEYS.includes(key)) {
        errors.push(`unknown key "price.${key}" — allowed keys: ${PRICE_KEYS.join(', ')}`);
      }
    }
    const amount = def.price.amount;
    if (
      (typeof amount !== 'string' && typeof amount !== 'number') ||
      !DECIMAL_AMOUNT.test(String(amount)) ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) > MAX_PRICE_AMOUNT
    ) {
      errors.push(PRICE_AMOUNT_ERROR);
    }
    if (typeof def.price.currency !== 'string' || def.price.currency.trim() === '') {
      errors.push('"price.currency" must be a currency code (e.g. GBP, SATS)');
    }
    if (def.price.frequency !== undefined && typeof def.price.frequency !== 'string') {
      errors.push('"price.frequency" must be a string (e.g. month) when present');
    }
  }
  if (def.status !== undefined && !STATUSES.includes(def.status)) {
    errors.push(`"status" must be one of: ${STATUSES.join(', ')}`);
  }
  if (def.images !== undefined) {
    if (!Array.isArray(def.images) || def.images.some((i) => typeof i !== 'string')) {
      errors.push('"images" must be a list of strings (local file paths or https URLs)');
    }
  }
  if (def.tags !== undefined) {
    if (!Array.isArray(def.tags) || def.tags.some((t) => typeof t !== 'string')) {
      errors.push('"tags" must be a list of strings');
    }
  }
  if (def.location !== undefined && typeof def.location !== 'string') {
    errors.push('"location" must be a string');
  }
  if (
    def.published_at !== undefined &&
    (!Number.isInteger(def.published_at) ||
      def.published_at <= 0 ||
      def.published_at > MAX_PUBLISHED_AT)
  ) {
    errors.push(
      '"published_at" must be a positive unix timestamp in seconds (not milliseconds) when present'
    );
  }
  return errors;
}

/**
 * Build an unsigned kind-30402 event from a validated definition.
 *
 * @param def parsed YAML definition (see validateDefinition)
 * @param opts.imageUrls hosted URLs to use for the image tags, in order.
 *   Callers upload local files to Blossom first and pass the resulting URLs;
 *   defaults to def.images filtered to remote URLs (dry-run behaviour).
 * @param opts.createdAt unix seconds (defaults to now)
 * @param opts.publishedAt unix seconds for the published_at tag — pass the
 *   original value when updating an existing listing (defaults to
 *   def.published_at, then createdAt)
 */
export function definitionToEvent(def, opts = {}) {
  const createdAt = opts.createdAt ?? Math.floor(Date.now() / 1000);
  const publishedAt = opts.publishedAt ?? def.published_at ?? createdAt;
  const imageUrls = opts.imageUrls ?? (def.images ?? []).filter(isRemoteImage);

  const tags = [
    ['d', def.d],
    ['title', def.title],
    ['summary', def.summary],
    ['published_at', String(publishedAt)],
  ];
  const price = ['price', String(def.price.amount), def.price.currency];
  if (def.price.frequency) price.push(def.price.frequency);
  tags.push(price);
  for (const t of def.tags ?? []) tags.push(['t', t]);
  for (const url of imageUrls) tags.push(['image', url]);
  if (def.location) tags.push(['location', def.location]);
  if (def.status) tags.push(['status', def.status]);

  return { kind: LISTING_KIND, created_at: createdAt, tags, content: def.content };
}

function tagValue(event, name) {
  const tag = event.tags.find((t) => t[0] === name);
  return tag ? tag[1] : undefined;
}

/** Flatten a kind-30402 event into a plain listing object for display. */
export function eventToListing(event) {
  const priceTag = event.tags.find((t) => t[0] === 'price');
  return {
    d: tagValue(event, 'd') ?? '',
    title: tagValue(event, 'title') ?? '(untitled)',
    summary: tagValue(event, 'summary'),
    price: priceTag
      ? { amount: priceTag[1], currency: priceTag[2], frequency: priceTag[3] }
      : undefined,
    status: tagValue(event, 'status') ?? 'active',
    images: event.tags.filter((t) => t[0] === 'image').map((t) => t[1]),
    tags: event.tags.filter((t) => t[0] === 't').map((t) => t[1]),
    location: tagValue(event, 'location'),
    publishedAt: tagValue(event, 'published_at'),
    createdAt: event.created_at,
    content: event.content,
    id: event.id,
    pubkey: event.pubkey,
  };
}

/**
 * Deduplicate addressable events by d-tag, keeping the newest per identifier
 * (relays may each return different revisions). Returns a Map d -> event.
 */
export function latestByDtag(events) {
  const latest = new Map();
  for (const event of events) {
    const d = tagValue(event, 'd');
    if (d === undefined) continue;
    const current = latest.get(d);
    if (!current || isNewerRevision(event, current)) latest.set(d, event);
  }
  return latest;
}

/**
 * NIP-01 revision ordering for addressable events: the newer created_at wins,
 * and ties are broken by keeping the lexicographically LOWER event id. Relays
 * return revisions in arbitrary order, so without the tiebreak two events
 * sharing a created_at would resolve differently from run to run.
 */
function isNewerRevision(candidate, current) {
  if (candidate.created_at !== current.created_at) {
    return candidate.created_at > current.created_at;
  }
  return String(candidate.id ?? '') < String(current.id ?? '');
}

/**
 * Build an unsigned replacement event from an existing listing event with the
 * status tag set to `status`. All other tags (including published_at) are
 * preserved; created_at is refreshed so relays treat it as the new revision.
 */
export function withStatus(event, status, opts = {}) {
  if (!STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${STATUSES.join(', ')}`);
  }
  const tags = event.tags.filter((t) => t[0] !== 'status').map((t) => [...t]);
  tags.push(['status', status]);
  return {
    kind: LISTING_KIND,
    created_at: opts.createdAt ?? Math.floor(Date.now() / 1000),
    tags,
    content: event.content,
  };
}

/**
 * created_at for a replacement of an existing addressable event. NIP-01 breaks
 * created_at ties by keeping the lexicographically LOWER event id, so a
 * replacement published within the same second as the current revision could
 * lose to it — always go strictly greater than the revision being replaced.
 */
export function replacementCreatedAt(previousCreatedAt, now = Math.floor(Date.now() / 1000)) {
  return Math.max(now, (previousCreatedAt ?? 0) + 1);
}

/** Format a unix-seconds timestamp as a UTC date string for tables. */
export function formatDate(unixSeconds) {
  if (!unixSeconds) return '-';
  return new Date(Number(unixSeconds) * 1000).toISOString().slice(0, 10);
}

/** Format a price object like { amount, currency, frequency } for display. */
export function formatPrice(price) {
  if (!price) return '-';
  const base = `${price.amount} ${price.currency ?? ''}`.trim();
  return price.frequency ? `${base}/${price.frequency}` : base;
}
