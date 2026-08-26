/**
 * Browser-side Blossom (BUD-02) media upload for the shop owner UI.
 *
 * Mirrors tools/nostr-listings/lib/blossom.mjs, but in the browser: the
 * kind-24242 authorization event is signed by the owner's NIP-07 extension
 * (never a local key), then the file bytes are PUT to the media server with
 * the signed auth as an `Authorization: Nostr <base64>` header.
 */

import { buildBlossomAuthEvent } from './shop-admin';
import type { NostrEvent } from './story-notes';
import type { EventTemplate } from './story-social';

export const BLOSSOM_SERVER = 'https://blossom.primal.net';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

/** Lowercase hex sha-256 of a byte buffer via WebCrypto. */
async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Base64-encode a UTF-8 string (btoa only handles latin-1 directly). */
function base64Utf8(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

/**
 * Upload an image to the Blossom server, authorizing with a kind-24242 event
 * signed by `signEvent` (the owner's extension — one approval per file).
 * Returns the hosted https URL for use in `image` tags.
 */
export async function uploadToBlossom(
  file: File,
  signEvent: (template: EventTemplate) => Promise<NostrEvent>,
  server: string = BLOSSOM_SERVER
): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported image type "${file.type || 'unknown'}" — use PNG, JPEG, GIF, WebP or SVG.`
    );
  }

  const bytes = await file.arrayBuffer();
  const hash = await sha256Hex(bytes);
  const auth = await signEvent(buildBlossomAuthEvent(hash, file.name));

  const response = await fetch(`${server}/upload`, {
    method: 'PUT',
    headers: {
      Authorization: `Nostr ${base64Utf8(JSON.stringify(auth))}`,
      'Content-Type': file.type,
    },
    body: bytes,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}): ${await response.text()}`);
  }

  const result = (await response.json()) as { url?: string };
  if (!result.url || !/^https?:\/\//i.test(result.url)) {
    throw new Error('The media server did not return a hosted URL.');
  }
  return result.url;
}
