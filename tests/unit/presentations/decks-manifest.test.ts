import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { siteIndex } from '@/app/api/chat/site-index';

/**
 * Deck manifest tests
 *
 * Requirements: presentations
 * - public/presentations/decks.json is the one list of slide decks
 * - Sallie's site index lists every deck in it, by URL, and no retired deck
 */

interface Deck {
  slug: string;
  title: string;
  description: string;
  cover: string;
  thumb: string;
  order: number;
}

const dir = path.resolve(__dirname, '../../../public/presentations');
const manifest = JSON.parse(readFileSync(path.join(dir, 'decks.json'), 'utf8')) as {
  decks: Deck[];
  retired: { slug: string; redirectTo: string }[];
};
const deckUrl = (slug: string) => `https://www.knowall.ai/presentations/${slug}.html`;

describe('deck manifest', () => {
  it('describes each deck fully, with a unique slug and order', () => {
    expect(manifest.decks.length).toBeGreaterThan(0);
    for (const deck of manifest.decks) {
      for (const field of ['slug', 'title', 'description', 'cover', 'thumb'] as const) {
        expect(deck[field], `${deck.slug}.${field}`).toMatch(/\S/);
      }
      expect(Number.isInteger(deck.order)).toBe(true);
    }
    expect(new Set(manifest.decks.map((d) => d.slug)).size).toBe(manifest.decks.length);
    expect(new Set(manifest.decks.map((d) => d.order)).size).toBe(manifest.decks.length);
  });

  it('points at files that exist', () => {
    for (const deck of manifest.decks) {
      for (const file of [`${deck.slug}.html`, deck.cover, deck.thumb]) {
        expect(existsSync(path.join(dir, file)), file).toBe(true);
      }
    }
  });

  it('gives every deck an entry and URL in the site index', () => {
    for (const deck of manifest.decks) {
      // an entry is a list item whose link is the deck: "- <name> (<url>): ..."
      const entry = siteIndex
        .split('\n')
        .find((line) => line.startsWith('- ') && line.includes(`(${deckUrl(deck.slug)})`));
      expect(entry, `site-index entry for ${deck.slug}`).toBeDefined();
    }
  });

  it('lists no deck in the site index that is not in the manifest', () => {
    const linked = [
      ...siteIndex.matchAll(/https:\/\/www\.knowall\.ai\/presentations\/([\w-]+)\.html/g),
    ].map((m) => m[1]);
    const slugs = manifest.decks.map((d) => d.slug);
    for (const slug of linked) expect(slugs, slug).toContain(slug);
  });

  it('keeps retired decks out of the manifest and the site index, behind a redirect', () => {
    const slugs = manifest.decks.map((d) => d.slug);
    for (const retired of manifest.retired) {
      expect(slugs).not.toContain(retired.slug);
      expect(slugs).toContain(retired.redirectTo);
      expect(siteIndex).not.toContain(`/presentations/${retired.slug}`);
      const page = readFileSync(path.join(dir, `${retired.slug}.html`), 'utf8');
      expect(page).toContain(`url=${retired.redirectTo}.html`);
    }
  });
});
