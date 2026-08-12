/**
 * Pure helpers for the Story page's Nostr feed — media extraction (NIP-92
 * `imeta` tags plus inline URLs), NIP-10 reply detection, relative timestamps
 * and NIP-19 bech32 encoding. Free of React and browser dependencies so every
 * branch can be unit-tested directly. Mirrors the story-page pattern used by
 * robotechy.com and edenweeks.art.
 */

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

/* ---------------------------------------------------------------------------
 * Media extraction
 * ------------------------------------------------------------------------- */

/**
 * Fresh RegExp per call so the shared `g` flag never leaks `lastIndex` state
 * between `match`/`replace` calls.
 */
function imageUrlRegex(): RegExp {
  return /https?:\/\/\S+?\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s<>()[\]]*)?/gi;
}

function videoUrlRegex(): RegExp {
  return /https?:\/\/\S+?\.(?:mp4|webm|mov|m4v)(?:\?[^\s<>()[\]]*)?/gi;
}

/**
 * True when a URL's path actually ends in one of the given extensions. Parses
 * the URL and inspects the pathname suffix rather than substring-matching, so
 * paths like `…/a.png/extra` (where `.png` is not the real suffix) are not
 * misread as media.
 */
function pathnameEndsWith(url: string, extensions: RegExp): boolean {
  try {
    const { pathname } = new URL(url);
    return extensions.test(pathname);
  } catch {
    return false;
  }
}

const IMAGE_PATH_SUFFIX = /\.(?:png|jpe?g|gif|webp|avif)$/i;
const VIDEO_PATH_SUFFIX = /\.(?:mp4|webm|mov|m4v)$/i;

/**
 * Extract media URLs of one family (image/video) from a kind-1 note.
 *
 * Sources, in priority order:
 *  1. NIP-92 `imeta` tags (`['imeta', 'url <href>', 'm image/png', …]`).
 *  2. Bare media URLs embedded in the note content.
 *
 * `imeta` tags describe attachments of any type, so a declared `imeta` is
 * included only when its `m` (mime) belongs to the requested family, or — when
 * no mime is declared — when the URL's pathname itself looks like that family.
 * Only http(s) URLs are accepted (keeping `data:` and other non-network
 * schemes out of `src` attributes). Duplicates are removed preserving
 * first-seen order, so `imeta`-declared media win over the same URL repeated
 * inline.
 */
function extractMediaUrls(
  event: NostrEvent,
  mimePrefix: string,
  pathSuffix: RegExp,
  contentRegex: RegExp
): string[] {
  const urls: string[] = [];

  for (const tag of event.tags) {
    if (tag[0] !== 'imeta') continue;

    let url = '';
    let mime: string | undefined;
    for (const part of tag.slice(1)) {
      if (typeof part !== 'string') continue;
      if (part.startsWith('url ')) url = part.slice(4).trim();
      else if (part.startsWith('m ')) mime = part.slice(2).trim();
    }

    if (!/^https?:\/\//i.test(url)) continue;
    const matches = mime ? mime.startsWith(mimePrefix) : pathnameEndsWith(url, pathSuffix);
    if (matches) urls.push(url);
  }

  const inline = event.content.match(contentRegex);
  if (inline) urls.push(...inline);

  return Array.from(new Set(urls));
}

/** Image URLs attached to a note, from NIP-92 `imeta` tags and inline links. */
export function extractImageUrls(event: NostrEvent): string[] {
  return extractMediaUrls(event, 'image/', IMAGE_PATH_SUFFIX, imageUrlRegex());
}

/** Video URLs attached to a note, from NIP-92 `imeta` tags and inline links. */
export function extractVideoUrls(event: NostrEvent): string[] {
  return extractMediaUrls(event, 'video/', VIDEO_PATH_SUFFIX, videoUrlRegex());
}

/**
 * Remove bare image/video URLs from note content so the text reads cleanly
 * when the media are rendered separately. Collapses the runs of blank lines
 * that removal can leave behind and trims surrounding whitespace.
 */
export function stripMediaUrls(content: string): string {
  return content
    .replace(imageUrlRegex(), '')
    .replace(videoUrlRegex(), '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ---------------------------------------------------------------------------
 * Reply detection (NIP-10)
 * ------------------------------------------------------------------------- */

/**
 * A kind-1 note is treated as a reply when it carries an `e` tag that threads
 * it onto another note (NIP-10). The story timeline shows only top-level
 * posts, so replies are filtered out.
 *
 * Marked `e` tags are `['e', <id>, <relay?>, <marker?>]` where the marker is
 * `root`, `reply` or `mention`. A `mention` marker is a quote/reference, not a
 * threading link, so it does NOT make the note a reply — otherwise legitimate
 * top-level posts that quote another note would be dropped. Unmarked (legacy
 * positional) `e` tags are conservatively treated as replies.
 */
export function isReply(event: NostrEvent): boolean {
  return event.tags.some((tag) => tag[0] === 'e' && tag[3] !== 'mention');
}

/* ---------------------------------------------------------------------------
 * Timestamps
 * ------------------------------------------------------------------------- */

/** Coarse relative timestamp ("3 days ago") for a unix-seconds time. */
export function timeAgo(unixSeconds: number, nowMs: number = Date.now()): string {
  const seconds = Math.floor(nowMs / 1000) - unixSeconds;
  const units: Array<[string, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, unitSeconds] of units) {
    const count = Math.floor(seconds / unitSeconds);
    if (count >= 1) return `${count} ${name}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/* ---------------------------------------------------------------------------
 * Minimal bech32 (BIP-173) encoder — just enough to turn 32-byte hex ids into
 * NIP-19 `note1…`/`npub1…` identifiers for njump links, without pulling in
 * nostr-tools (whose ESM-only build trips up the CJS unit-test runner).
 * ------------------------------------------------------------------------- */

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Polymod(values: number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= BECH32_GENERATOR[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const expanded: number[] = [];
  for (const c of hrp) expanded.push(c.charCodeAt(0) >> 5);
  expanded.push(0);
  for (const c of hrp) expanded.push(c.charCodeAt(0) & 31);
  return expanded;
}

/** Regroup 8-bit bytes (as a hex string) into the 5-bit words bech32 encodes. */
function hexToWords(hex: string): number[] {
  const words: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < hex.length; i += 2) {
    acc = (acc << 8) | parseInt(hex.slice(i, i + 2), 16);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) words.push((acc << (5 - bits)) & 31);
  return words;
}

/** bech32-encode a hex payload under the given human-readable prefix. */
export function encodeBech32(hrp: string, hex: string): string {
  const words = hexToWords(hex);
  const values = [...bech32HrpExpand(hrp), ...words];
  const polymod = bech32Polymod([...values, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum: number[] = [];
  for (let i = 0; i < 6; i++) checksum.push((polymod >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...words, ...checksum].map((w) => BECH32_CHARSET[w]).join('')}`;
}

/** NIP-19 `note1…` encoding of a hex event id, for njump.me links. */
export function encodeNoteId(idHex: string): string {
  return encodeBech32('note', idHex);
}
