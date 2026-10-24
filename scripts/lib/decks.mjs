// The deck manifest (public/presentations/decks.json): the one list of slide
// decks, read by the build script, the QA harness and the unit tests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const presentationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'public',
  'presentations'
);

export function loadManifest() {
  const manifest = JSON.parse(readFileSync(join(presentationsDir, 'decks.json'), 'utf8'));
  return {
    decks: [...manifest.decks].sort((a, b) => a.order - b.order),
    retired: manifest.retired ?? [],
  };
}
