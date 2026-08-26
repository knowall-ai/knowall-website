'use client';

import { useEffect, useState } from 'react';
import { Send, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import SignInButton from '@/components/auth/sign-in-button';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import FeedbackAuthor from '@/components/feedback-author';
import { StarRating, StarRatingInput } from '@/components/star-rating';
import { KNOWALL_PUBKEY, SHOP_RELAYS } from '@/lib/nostr';
import { publishToRelays } from '@/lib/relay';
import {
  buildReviewTemplate,
  type ParsedReview,
  type ReviewAggregate,
} from '@/lib/product-reviews';
import type { NostrEvent } from '@/lib/nip99';
import type { ProfileMetadata } from '@/lib/story-social';

export interface ProductReviewsSectionProps {
  /** Product review coordinate: `a:30402:<merchantPubkey>:<productDTag>`. */
  reviewCoord: string;
  /** Parsed, moderated reviews (newest first, one per reviewer). */
  reviews: ParsedReview[];
  aggregate: ReviewAggregate;
  status: 'loading' | 'ready' | 'error';
  profiles: Map<string, ProfileMetadata>;
  onPosted: (review: NostrEvent) => void;
  /** Present only for the company viewer — mutes the author site-wide. */
  onMute?: (pubkey: string) => void;
  mutingPubkey: string | null;
}

/**
 * Gamma Markets (kind-31555) product reviews: the aggregate rating (average
 * stars + count), a write-a-review form, and the list of reviews. Because a
 * review's `d` tag is the product coordinate, each reviewer holds exactly one
 * review per product — re-submitting edits it, and the form prefills from the
 * signed-in user's existing review.
 *
 * Auth, moderation and rendering posture all mirror the comments section:
 * NIP-07 sign-in gate, plain-text content, mute button for the company viewer.
 */
export default function ProductReviewsSection({
  reviewCoord,
  reviews,
  aggregate,
  status,
  profiles,
  onPosted,
  onMute,
  mutingPubkey,
}: ProductReviewsSectionProps) {
  const { user } = useNostrAuth();
  const ownReview = user
    ? reviews.find((review) => review.pubkey.toLowerCase() === user.pubkey.toLowerCase())
    : undefined;

  return (
    <div className="space-y-6" data-testid="product-reviews">
      {aggregate.count > 0 && (
        <div className="flex items-center gap-2" data-testid="review-aggregate">
          <StarRating stars={aggregate.average} size="sm" />
          <span className="text-sm font-semibold text-white">{aggregate.average.toFixed(1)}</span>
          <span className="text-sm text-gray-500">
            ({aggregate.count} {aggregate.count === 1 ? 'review' : 'reviews'})
          </span>
        </div>
      )}

      <ReviewComposer reviewCoord={reviewCoord} existing={ownReview} onPosted={onPosted} />

      {status === 'loading' ? (
        <p className="text-sm text-gray-500">Loading reviews…</p>
      ) : status === 'error' && reviews.length === 0 ? (
        <p className="text-sm text-gray-500">Reviews could not be loaded right now.</p>
      ) : reviews.length === 0 ? (
        <div className="py-6 text-center text-gray-500">
          <Star className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden="true" />
          <p className="text-sm">No reviews yet — be the first to review this product.</p>
        </div>
      ) : (
        <ul className="list-none space-y-5">
          {reviews.map((review) => (
            <li key={review.id} className="group" data-testid="product-review">
              <FeedbackAuthor
                pubkey={review.pubkey}
                createdAt={review.createdAt}
                metadata={profiles.get(review.pubkey)}
                onMute={
                  onMute && review.pubkey.toLowerCase() !== KNOWALL_PUBKEY
                    ? () => onMute(review.pubkey)
                    : undefined
                }
                isMuting={mutingPubkey === review.pubkey}
              >
                <StarRating stars={review.stars} size="sm" />
              </FeedbackAuthor>
              {review.text && (
                // Plain text only — same moderation posture as comments.
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">
                  {review.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Write/edit-a-review form: 1..5 star picker + optional text, NIP-07 gated. */
function ReviewComposer({
  reviewCoord,
  existing,
  onPosted,
}: {
  reviewCoord: string;
  /** The signed-in user's existing review, if any (enables edit/prefill). */
  existing?: ParsedReview;
  onPosted: (review: NostrEvent) => void;
}) {
  const { user, signEvent } = useNostrAuth();
  const [stars, setStars] = useState(existing ? Math.round(existing.stars) : 0);
  const [content, setContent] = useState(existing?.text ?? '');
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the form in sync with the user's existing review: prefill when it
  // loads or changes. Depending on the primitive fields (not the `existing`
  // object) means a refetch returning identical values doesn't clobber
  // in-progress edits.
  const existingStars = existing?.stars;
  const existingText = existing?.text;
  useEffect(() => {
    setStars(existingStars != null ? Math.round(existingStars) : 0);
    setContent(existingText ?? '');
  }, [existingStars, existingText]);

  const isEditing = !!existing;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || isPosting) return;
    if (stars < 1) {
      setError('Please select at least one star before submitting.');
      return;
    }

    setIsPosting(true);
    setError(null);
    try {
      const signed = await signEvent(
        buildReviewTemplate({ coord: reviewCoord, stars, content: content.trim() })
      );
      await publishToRelays(SHOP_RELAYS, signed);
      onPosted(signed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not publish your review. Please try again.'
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" data-testid="product-review-composer">
      <div className="space-y-1.5">
        <span id="review-rating-label" className="block text-sm font-medium text-gray-300">
          Your rating
        </span>
        <StarRatingInput
          value={stars}
          onChange={(next) => {
            setStars(next);
            setError(null);
          }}
          disabled={!user || isPosting}
          labelledBy="review-rating-label"
        />
      </div>

      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={user ? 'Share your experience with this product…' : 'Sign in to review…'}
        disabled={!user || isPosting}
        className="min-h-[72px] border-gray-800 bg-gray-950 text-gray-200 placeholder:text-gray-500"
      />
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        {user ? (
          <Button
            type="submit"
            size="sm"
            disabled={isPosting || stars < 1}
            className="bg-lime-600 text-white hover:bg-lime-700"
          >
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            {isPosting
              ? isEditing
                ? 'Updating…'
                : 'Submitting…'
              : isEditing
                ? 'Update review'
                : 'Submit review'}
          </Button>
        ) : (
          <SignInButton label="Sign in to review" />
        )}
      </div>
    </form>
  );
}
