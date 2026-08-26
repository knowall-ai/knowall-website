import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, basename } from 'node:path';
import { BLOSSOM_URL } from './config.mjs';
import { signEvent } from './nostr.mjs';

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * Upload a local image to the Blossom media server. Each upload needs a
 * kind-24242 authorization event signed via Amber (one approval per file).
 * Returns the hosted URL.
 */
export async function uploadImage(signer, filePath, note) {
  const contentType = CONTENT_TYPES[extname(filePath).toLowerCase()];
  if (!contentType) {
    throw new Error(
      `unsupported image type for ${filePath} (supported: ${Object.keys(CONTENT_TYPES).join(', ')})`
    );
  }
  let bytes;
  try {
    bytes = readFileSync(filePath);
  } catch (err) {
    throw new Error(`cannot read image ${filePath}: ${err.message}`);
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const now = Math.floor(Date.now() / 1000);
  const auth = await signEvent(
    signer,
    {
      kind: 24242,
      created_at: now,
      tags: [
        ['t', 'upload'],
        ['x', sha256],
        ['expiration', String(now + 600)],
      ],
      content: note ?? `Upload ${basename(filePath)} for KnowAll listing`,
    },
    `Blossom upload authorization for ${basename(filePath)}`
  );
  const res = await fetch(`${BLOSSOM_URL}/upload`, {
    method: 'PUT',
    headers: {
      Authorization: 'Nostr ' + Buffer.from(JSON.stringify(auth)).toString('base64'),
      'Content-Type': contentType,
    },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`Blossom upload of ${filePath} failed ${res.status}: ${await res.text()}`);
  }
  const { url } = await res.json();
  console.log(`Uploaded ${basename(filePath)} -> ${url}`);
  return url;
}
