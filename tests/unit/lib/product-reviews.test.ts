import { describe, it, expect } from 'vitest';

import { KNOWALL_PUBKEY } from '@/lib/nostr';
import { buildBlocklist, filterBlocked } from '@/lib/moderation';
import {
  REVIEW_KIND,
  aggregateReviews,
  buildReviewTemplate,
  dedupeNewestPerAuthor,
  isProductReviewCoord,
  parseReviewEvent,
  parseReviews,
  productReviewCoord,
  ratingToStars,
  reviewFilterForProduct,
  starsToRating,
} from '@/lib/product-reviews';
import type { NostrEvent } from '@/lib/nip99';

const MERCHANT = KNOWALL_PUBKEY;
const D_TAG = 'tminus15-book';
const COORD = `a:30402:${MERCHANT}:${D_TAG}`;
const REVIEWER = 'a'.repeat(64);
const OTHER_REVIEWER = 'b'.repeat(64);

function makeReview(partial: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: REVIEWER,
    created_at: 1000,
    kind: REVIEW_KIND,
    content: 'Great book',
    tags: [
      ['d', COORD],
      ['rating', '0.8', 'thumb'],
    ],
    ...partial,
  };
}

describe('productReviewCoord / isProductReviewCoord', () => {
  it('builds the Gamma Markets review coordinate', () => {
    expect(productReviewCoord(MERCHANT, D_TAG)).toBe(COORD);
  });

  it('accepts well-formed coordinates, including d-tags containing colons', () => {
    expect(isProductReviewCoord(COORD)).toBe(true);
    expect(isProductReviewCoord(`a:30402:${MERCHANT}:with:colons`)).toBe(true);
  });

  it('rejects malformed coordinates', () => {
    expect(isProductReviewCoord('')).toBe(false);
    expect(isProductReviewCoord(`30402:${MERCHANT}:${D_TAG}`)).toBe(false); // missing a: prefix
    expect(isProductReviewCoord(`a:30023:${MERCHANT}:${D_TAG}`)).toBe(false); // wrong kind
    expect(isProductReviewCoord('a:30402:nothex:d')).toBe(false);
    expect(isProductReviewCoord(`a:30402:${MERCHANT}:`)).toBe(false); // empty d-tag
  });
});

describe('star/rating conversion', () => {
  it('maps 1..5 stars onto the 0..1 scale and back', () => {
    expect(starsToRating(4)).toBe(0.8);
    expect(starsToRating(5)).toBe(1);
    expect(ratingToStars(0.8)).toBe(4);
    expect(ratingToStars(1)).toBe(5);
  });

  it('clamps out-of-range and rejects non-finite values', () => {
    expect(starsToRating(7)).toBe(1);
    expect(starsToRating(-2)).toBe(0);
    expect(starsToRating(NaN)).toBe(0);
    expect(ratingToStars(1.5)).toBe(5);
    expect(ratingToStars(-1)).toBe(0);
    expect(ratingToStars(Infinity)).toBe(0);
  });
});

describe('buildReviewTemplate', () => {
  it('builds a kind-31555 event keyed by the product coordinate', () => {
    const template = buildReviewTemplate(
      { coord: COORD, stars: 4, content: '  Great book  ' },
      123
    );
    expect(template.kind).toBe(REVIEW_KIND);
    expect(template.created_at).toBe(123);
    expect(template.content).toBe('Great book');
    expect(template.tags).toEqual([
      ['d', COORD],
      ['rating', '0.8', 'thumb'],
    ]);
  });

  it('appends category ratings, skipping empty/thumb/zero-star categories', () => {
    const template = buildReviewTemplate({
      coord: COORD,
      stars: 5,
      categories: [
        { category: 'quality', stars: 3 },
        { category: 'thumb', stars: 4 }, // reserved name — dropped
        { category: '', stars: 4 }, // unnamed — dropped
        { category: 'value', stars: 0 }, // unrated — dropped
      ],
    });
    expect(template.tags).toEqual([
      ['d', COORD],
      ['rating', '1', 'thumb'],
      ['rating', '0.6', 'quality'],
    ]);
  });

  it('formats ratings without floating-point noise', () => {
    const template = buildReviewTemplate({ coord: COORD, stars: 3 });
    expect(template.tags[1][1]).toBe('0.6');
  });
});

describe('parseReviewEvent', () => {
  it('parses a valid review', () => {
    const review = parseReviewEvent(
      makeReview({ tags: [...makeReview().tags, ['rating', '0.4', 'quality']] })
    );
    expect(review).toMatchObject({
      pubkey: REVIEWER,
      stars: 4,
      rating: 0.8,
      text: 'Great book',
      categories: [{ category: 'quality', stars: 2 }],
    });
  });

  it('rejects wrong kinds, missing/malformed d coordinates and missing thumb ratings', () => {
    expect(parseReviewEvent(makeReview({ kind: 1 }))).toBeNull();
    expect(parseReviewEvent(makeReview({ tags: [['rating', '0.8', 'thumb']] }))).toBeNull();
    expect(
      parseReviewEvent(
        makeReview({
          tags: [
            ['d', 'not-a-coordinate'],
            ['rating', '0.8', 'thumb'],
          ],
        })
      )
    ).toBeNull();
    expect(parseReviewEvent(makeReview({ tags: [['d', COORD]] }))).toBeNull();
  });

  it('rejects non-numeric thumb ratings and drops non-numeric category ratings', () => {
    expect(
      parseReviewEvent(
        makeReview({
          tags: [
            ['d', COORD],
            ['rating', 'five', 'thumb'],
          ],
        })
      )
    ).toBeNull();

    const review = parseReviewEvent(
      makeReview({ tags: [...makeReview().tags, ['rating', 'meh', 'quality']] })
    );
    expect(review?.categories).toEqual([]);
  });

  it('clamps out-of-range stored ratings into 0..1', () => {
    const review = parseReviewEvent(
      makeReview({
        tags: [
          ['d', COORD],
          ['rating', '7', 'thumb'],
        ],
      })
    );
    expect(review?.rating).toBe(1);
    expect(review?.stars).toBe(5);
  });
});

describe('dedupeNewestPerAuthor / parseReviews', () => {
  it('keeps only the newest review per author (republishing edits)', () => {
    const older = makeReview({ id: '1'.repeat(64), created_at: 100, content: 'v1' });
    const newer = makeReview({ id: '2'.repeat(64), created_at: 200, content: 'v2' });
    const other = makeReview({ id: '3'.repeat(64), pubkey: OTHER_REVIEWER, created_at: 50 });

    const deduped = dedupeNewestPerAuthor([older, newer, other]);
    expect(deduped).toHaveLength(2);
    expect(deduped.find((event) => event.pubkey === REVIEWER)?.content).toBe('v2');
  });

  it('never lets an event without a timestamp beat a well-formed newer one', () => {
    const timeless = makeReview({
      id: '1'.repeat(64),
      created_at: undefined as unknown as number,
    });
    const wellFormed = makeReview({ id: '2'.repeat(64), created_at: 10 });
    const deduped = dedupeNewestPerAuthor([wellFormed, timeless]);
    expect(deduped).toEqual([wellFormed]);
  });

  it('drops malformed events and sorts newest first', () => {
    const reviews = parseReviews([
      makeReview({ id: '1'.repeat(64), created_at: 100 }),
      makeReview({ id: '2'.repeat(64), pubkey: OTHER_REVIEWER, created_at: 300 }),
      makeReview({ id: '3'.repeat(64), pubkey: 'c'.repeat(64), tags: [] }), // malformed
    ]);
    expect(reviews.map((review) => review.pubkey)).toEqual([OTHER_REVIEWER, REVIEWER]);
  });
});

describe('aggregateReviews', () => {
  it('averages overall stars across reviewers', () => {
    const reviews = parseReviews([
      makeReview({ id: '1'.repeat(64) }), // 4 stars
      makeReview({
        id: '2'.repeat(64),
        pubkey: OTHER_REVIEWER,
        tags: [
          ['d', COORD],
          ['rating', '0.4', 'thumb'],
        ],
      }), // 2 stars
    ]);
    expect(aggregateReviews(reviews)).toEqual({ average: 3, count: 2 });
  });

  it('yields a zeroed aggregate when there are no reviews', () => {
    expect(aggregateReviews([])).toEqual({ average: 0, count: 0 });
  });
});

describe('reviewFilterForProduct', () => {
  it('targets kind 31555 by #d coordinate with a bounded limit', () => {
    expect(reviewFilterForProduct(COORD)).toEqual({
      kinds: [REVIEW_KIND],
      '#d': [COORD],
      limit: 500,
    });
  });
});

describe('moderation of reviews', () => {
  it('filters muted reviewers out before aggregation', () => {
    const blocklist = buildBlocklist({ tags: [['p', REVIEWER]] });
    const visible = filterBlocked(
      [makeReview(), makeReview({ id: '9'.repeat(64), pubkey: OTHER_REVIEWER })],
      blocklist
    );
    const reviews = parseReviews(visible);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].pubkey).toBe(OTHER_REVIEWER);
    expect(aggregateReviews(reviews).count).toBe(1);
  });
});
