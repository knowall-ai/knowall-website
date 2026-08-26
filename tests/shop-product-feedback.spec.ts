import { test, expect, type Page } from '@playwright/test';
import { KNOWALL_PUBKEY } from '../lib/nostr';

/**
 * Product feedback (comments + reviews) tests — /shop/<naddr>
 *
 * The product page shows a Reviews | Comments tab strip below the description:
 * kind-31555 Gamma Markets reviews and kind-1111 NIP-22 comments rooted on the
 * listing's kind-30402 coordinate. Everything is staged deterministically by
 * stubbing WebSocket before any page script runs (the same pattern as the
 * other shop specs), with sign-in seeded via localStorage and a window.nostr
 * NIP-07 stub.
 */

const TMINUS15_NADDR =
  'naddr1qvzqqqrkcgpzpdenajkjvhvd7clptc5dyjtjzsd9a0pphl032v4d45hxwq0g2wyjqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hszrthwden5te0dehhxtnvdakqqrt5d45kuatnxy6j6cn0da4s74j5lz';

const D_TAG = 'tminus15-book';
const PRODUCT_COORD = `30402:${KNOWALL_PUBKEY}:${D_TAG}`;
const REVIEW_COORD = `a:30402:${KNOWALL_PUBKEY}:${D_TAG}`;

const COMMENTER = 'a'.repeat(64);
const REPLIER = 'b'.repeat(64);
const VISITOR = 'c'.repeat(64);

/** The live tminus15-book listing, as scripted relay data. */
const LISTING = {
  id: 'e'.repeat(64),
  pubkey: KNOWALL_PUBKEY,
  created_at: 1700000000,
  kind: 30402,
  content: 'The playbook for agentic delivery.',
  tags: [
    ['d', D_TAG],
    ['title', 'T-Minus-15 Book'],
    ['price', '9.99', 'GBP'],
    ['status', 'active'],
  ],
};

function comment(id: string, pubkey: string, content: string, createdAt: number) {
  return {
    id,
    pubkey,
    created_at: createdAt,
    kind: 1111,
    content,
    tags: [
      ['A', PRODUCT_COORD],
      ['K', '30402'],
      ['P', KNOWALL_PUBKEY],
      ['a', PRODUCT_COORD],
      ['k', '30402'],
      ['p', KNOWALL_PUBKEY],
    ],
  };
}

function reply(id: string, pubkey: string, parentId: string, content: string, createdAt: number) {
  return {
    id,
    pubkey,
    created_at: createdAt,
    kind: 1111,
    content,
    tags: [
      ['A', PRODUCT_COORD],
      ['K', '30402'],
      ['P', KNOWALL_PUBKEY],
      ['e', parentId],
      ['k', '1111'],
      ['p', COMMENTER],
    ],
  };
}

function review(id: string, pubkey: string, rating: string, content: string, createdAt: number) {
  return {
    id,
    pubkey,
    created_at: createdAt,
    kind: 31555,
    content,
    tags: [
      ['d', REVIEW_COORD],
      ['rating', rating, 'thumb'],
    ],
  };
}

const SCRIPTED_COMMENTS = [
  comment('1'.repeat(64), COMMENTER, 'Does it ship to Ireland?', 1700000100),
  reply('2'.repeat(64), REPLIER, '1'.repeat(64), 'It does — worldwide from the UK.', 1700000200),
];

const SCRIPTED_REVIEWS = [
  review('3'.repeat(64), COMMENTER, '1', 'Loved it. Practical from page one.', 1700000300),
  review('4'.repeat(64), REPLIER, '0.6', 'Solid, wanted more on QA.', 1700000400),
];

/**
 * Stub WebSocket before any page script runs. Each REQ may carry several
 * filters (the feedback query batches comments + reviews into one REQ); every
 * filter is answered with the scripted events matching its kinds, then EOSE.
 * Published EVENTs are ACKed with OK so posting resolves.
 */
async function mockRelays(
  page: Page,
  events: { listing?: object[]; comments?: object[]; reviews?: object[] } = {}
) {
  await page.addInitScript(
    ({ listing, comments, reviews }) => {
      class MockWebSocket {
        url: string;
        onopen: (() => void) | null = null;
        onmessage: ((message: { data: string }) => void) | null = null;
        onerror: (() => void) | null = null;
        onclose: (() => void) | null = null;

        constructor(url: string) {
          this.url = url;
          setTimeout(() => this.onopen?.(), 0);
        }

        send(payload: string) {
          const data = JSON.parse(payload) as unknown[];
          setTimeout(() => {
            if (data[0] === 'EVENT') {
              const event = data[1] as { id: string };
              this.onmessage?.({ data: JSON.stringify(['OK', event.id, true, '']) });
              return;
            }
            if (data[0] !== 'REQ') return;
            const subscriptionId = data[1] as string;
            for (const filter of data.slice(2) as { kinds?: number[] }[]) {
              const scripted = filter.kinds?.includes(30402)
                ? listing
                : filter.kinds?.includes(1111)
                  ? comments
                  : filter.kinds?.includes(31555)
                    ? reviews
                    : [];
              for (const event of scripted ?? []) {
                this.onmessage?.({ data: JSON.stringify(['EVENT', subscriptionId, event]) });
              }
            }
            this.onmessage?.({ data: JSON.stringify(['EOSE', subscriptionId]) });
          }, 0);
        }

        close() {
          // No-op.
        }
      }

      (window as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    },
    {
      listing: events.listing ?? [LISTING],
      comments: events.comments ?? SCRIPTED_COMMENTS,
      reviews: events.reviews ?? SCRIPTED_REVIEWS,
    }
  );
}

/** Seed a NIP-07 session: persisted pubkey + a window.nostr signing stub. */
async function signIn(page: Page, pubkey: string) {
  await page.addInitScript(
    ({ pk }) => {
      window.localStorage.setItem('knowall.nostr.pubkey', pk);
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: () => Promise.resolve(pk),
        signEvent: (template: object) =>
          Promise.resolve({
            ...template,
            id: 'f'.repeat(64),
            pubkey: pk,
            sig: '9'.repeat(128),
          }),
      };
    },
    { pk: pubkey }
  );
}

test.describe('Product feedback tabs', () => {
  test('shows reviews (default tab) with aggregate, counts and sign-in gate', async ({ page }) => {
    await mockRelays(page);
    await page.goto(`/shop/${TMINUS15_NADDR}`, { waitUntil: 'load' });

    const feedback = page.getByTestId('product-feedback');
    await expect(feedback).toBeVisible();

    // Tab labels carry live counts (2 reviews, 1 top-level comment).
    await expect(feedback.getByRole('tab', { name: 'Reviews (2)' })).toBeVisible();
    await expect(feedback.getByRole('tab', { name: 'Comments (1)' })).toBeVisible();

    // Aggregate: (5 + 3) / 2 = 4.0 stars across 2 reviewers.
    const aggregate = page.getByTestId('review-aggregate');
    await expect(aggregate).toContainText('4.0');
    await expect(aggregate).toContainText('(2 reviews)');

    // Review list renders both reviews, newest first.
    const reviews = page.getByTestId('product-review');
    await expect(reviews).toHaveCount(2);
    await expect(reviews.first()).toContainText('Solid, wanted more on QA.');

    // Signed out: composer inputs are disabled behind a sign-in nudge.
    const composer = page.getByTestId('product-review-composer');
    await expect(composer.locator('textarea')).toBeDisabled();
    await expect(composer.getByRole('button', { name: 'Sign in to review' })).toBeVisible();
  });

  test('comments tab shows the thread with nested replies and a sign-in gate', async ({ page }) => {
    await mockRelays(page);
    await page.goto(`/shop/${TMINUS15_NADDR}`, { waitUntil: 'load' });

    await page.getByRole('tab', { name: 'Comments (1)' }).click();

    const comments = page.getByTestId('product-comment');
    await expect(comments).toHaveCount(2);
    await expect(comments.first()).toContainText('Does it ship to Ireland?');
    // The reply is threaded under its parent (auto-expanded at depth < 2).
    await expect(comments.nth(1)).toContainText('worldwide from the UK');

    const composer = page.getByTestId('product-comment-composer');
    await expect(composer.locator('textarea')).toBeDisabled();
    await expect(composer.getByRole('button', { name: 'Sign in to comment' })).toBeVisible();
  });

  test('signed-in users can post a comment and submit a review', async ({ page }) => {
    await mockRelays(page);
    await signIn(page, VISITOR);
    await page.goto(`/shop/${TMINUS15_NADDR}`, { waitUntil: 'load' });

    // Review: pick 4 stars, write, submit — the list and aggregate update.
    const reviewComposer = page.getByTestId('product-review-composer');
    await reviewComposer.getByRole('radio', { name: '4 stars' }).click();
    await reviewComposer.locator('textarea').fill('Great read.');
    await reviewComposer.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByTestId('product-review')).toHaveCount(3);
    await expect(page.getByRole('tab', { name: 'Reviews (3)' })).toBeVisible();
    // Re-submitting edits (one review per reviewer): the form now offers Update.
    await expect(reviewComposer.getByRole('button', { name: 'Update review' })).toBeVisible();

    // Comment: post into the thread.
    await page.getByRole('tab', { name: 'Comments (1)' }).click();
    const commentComposer = page.getByTestId('product-comment-composer');
    await commentComposer.locator('textarea').fill('Just ordered mine!');
    await commentComposer.getByRole('button', { name: 'Comment' }).click();
    await expect(page.getByTestId('product-comment')).toHaveCount(3);
    await expect(page.getByTestId('product-comments')).toContainText('Just ordered mine!');
  });

  test('company viewer sees mute buttons; muting removes the author everywhere', async ({
    page,
  }) => {
    await mockRelays(page);
    await signIn(page, KNOWALL_PUBKEY);
    await page.goto(`/shop/${TMINUS15_NADDR}`, { waitUntil: 'load' });

    // Reviews tab: one mute button per third-party review.
    await expect(page.getByTestId('feedback-mute-button')).toHaveCount(2);

    // Mute the first reviewer (REPLIER, newest first) — their review AND their
    // comment reply disappear optimistically.
    await page.getByTestId('product-review').first().hover();
    await page.getByTestId('feedback-mute-button').first().click();
    await expect(page.getByTestId('product-review')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: /^Reviews \(1\)/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Comments (1)' }).click();
    const comments = page.getByTestId('product-comment');
    await expect(comments).toHaveCount(1);
    await expect(page.getByTestId('product-comments')).not.toContainText('worldwide from the UK');
  });

  test('signed-out visitors never see mute buttons', async ({ page }) => {
    await mockRelays(page);
    await page.goto(`/shop/${TMINUS15_NADDR}`, { waitUntil: 'load' });

    await expect(page.getByTestId('product-feedback')).toBeVisible();
    await expect(page.getByTestId('feedback-mute-button')).toHaveCount(0);
  });
});
