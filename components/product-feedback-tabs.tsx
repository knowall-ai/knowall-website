'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import ProductCommentsSection from '@/components/product-comments-section';
import ProductReviewsSection from '@/components/product-reviews-section';
import { KNOWALL_PUBKEY, SHOP_RELAYS } from '@/lib/nostr';
import { getBlocklist, filterBlocked, muteUser } from '@/lib/moderation';
import { queryRelaysDetailed } from '@/lib/relay';
import { fetchProfiles } from '@/lib/nostr-profiles';
import {
  COMMENT_KIND,
  commentFilterForProduct,
  dedupeComments,
  productCoord,
  topLevelComments,
} from '@/lib/product-comments';
import {
  REVIEW_KIND,
  aggregateReviews,
  parseReviews,
  productReviewCoord,
  reviewFilterForProduct,
} from '@/lib/product-reviews';
import type { NostrEvent } from '@/lib/nip99';
import type { ProfileMetadata } from '@/lib/story-social';

const FEEDBACK_TIMEOUT_MS = 8000;

/**
 * Reviews + Comments shown as two tabs below the product description
 * (defaults to Reviews), ported from robotechy.com's ProductFeedbackTabs and
 * restyled for this site's dark shop theme (classic underlined tabs).
 *
 * One relay round-trip fetches both kinds (a single REQ carries the kind-1111
 * comment filter and the kind-31555 review filter), and both result sets are
 * screened against the company's NIP-51 mute list before rendering — the same
 * moderation the story feed and shop grid apply. When the viewer is signed in
 * AS the company account, third-party comments and reviews grow a mute button.
 */
export default function ProductFeedbackTabs({
  merchantPubkey,
  dTag,
  className,
}: {
  merchantPubkey: string;
  dTag: string;
  className?: string;
}) {
  const { user, signEvent } = useNostrAuth();
  const coord = productCoord(merchantPubkey, dTag);
  const reviewCoord = productReviewCoord(merchantPubkey, dTag);

  const [comments, setComments] = useState<NostrEvent[]>([]);
  const [reviewEvents, setReviewEvents] = useState<NostrEvent[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [profiles, setProfiles] = useState<Map<string, ProfileMetadata>>(new Map());
  const [mutingPubkey, setMutingPubkey] = useState<string | null>(null);
  const [muteError, setMuteError] = useState<string | null>(null);

  // Fetch the whole thread + review set once per product. The blocklist fetch
  // (page-load cached) runs in parallel with the relay query.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setComments([]);
    setReviewEvents([]);

    const blocklistPromise = getBlocklist();
    void queryRelaysDetailed(
      SHOP_RELAYS,
      [commentFilterForProduct(coord), reviewFilterForProduct(reviewCoord)],
      FEEDBACK_TIMEOUT_MS
    ).then(async ({ events, respondedRelays }) => {
      const blocklist = await blocklistPromise;
      if (cancelled) return;
      // Moderation: both kinds are screened against the company mute list.
      const visible = filterBlocked(events, blocklist);
      setComments(dedupeComments(visible.filter((event) => event.kind === COMMENT_KIND)));
      setReviewEvents(visible.filter((event) => event.kind === REVIEW_KIND));
      setStatus(respondedRelays === 0 ? 'error' : 'ready');
    });

    return () => {
      cancelled = true;
    };
  }, [coord, reviewCoord]);

  const reviews = useMemo(() => parseReviews(reviewEvents), [reviewEvents]);
  const aggregate = useMemo(() => aggregateReviews(reviews), [reviews]);
  const commentCount = useMemo(() => topLevelComments(comments, coord).length, [comments, coord]);

  // Resolve author names/avatars (kind-0, cached in lib/nostr-profiles) for
  // everyone who commented or reviewed — one batched lookup.
  useEffect(() => {
    const pubkeys = [
      ...new Set([...comments.map((c) => c.pubkey), ...reviews.map((r) => r.pubkey)]),
    ];
    if (pubkeys.length === 0) return;
    let cancelled = false;
    void fetchProfiles(pubkeys).then((resolved) => {
      if (!cancelled && resolved.size > 0) setProfiles(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [comments, reviews]);

  const handleCommentPosted = (comment: NostrEvent) => {
    setComments((current) =>
      current.some((existing) => existing.id === comment.id) ? current : [...current, comment]
    );
  };

  const handleReviewPosted = (review: NostrEvent) => {
    // One review per reviewer per product (the `d` tag is the coordinate):
    // the new event replaces the author's previous one.
    setReviewEvents((current) => [
      ...current.filter((existing) => existing.pubkey !== review.pubkey),
      review,
    ]);
  };

  // The in-site mute action is for the company account only, exactly as on
  // story comments. The NIP-07 extension may return the pubkey in either case.
  const isCompanyViewer = user?.pubkey.toLowerCase() === KNOWALL_PUBKEY;

  const handleMute = async (pubkey: string) => {
    if (mutingPubkey) return;
    setMutingPubkey(pubkey);
    setMuteError(null);
    try {
      // Merges into (never clobbers) the current kind-10000 list, signs via
      // the NIP-07 extension, publishes — then the author's comments AND
      // reviews disappear optimistically.
      await muteUser(pubkey, signEvent);
      const muted = pubkey.toLowerCase();
      setComments((current) => current.filter((event) => event.pubkey.toLowerCase() !== muted));
      setReviewEvents((current) => current.filter((event) => event.pubkey.toLowerCase() !== muted));
    } catch (err) {
      setMuteError(
        err instanceof Error ? err.message : 'Could not mute this user. Please try again.'
      );
    } finally {
      setMutingPubkey(null);
    }
  };

  const onMute = isCompanyViewer ? handleMute : undefined;

  // Classic underlined tabs: override the shadcn primitive's segmented/pill
  // defaults at the usage site (full-width row with a bottom rule; the active
  // tab is a lime underline overlapping that rule via -mb-px).
  const listClass =
    'h-auto w-full justify-start gap-6 rounded-none border-b border-gray-800 bg-transparent p-0 text-gray-400';
  const triggerClass =
    '-mb-px inline-flex items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 font-medium text-gray-400 shadow-none transition-colors hover:text-white data-[state=active]:border-lime-500 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-white data-[state=active]:shadow-none';

  return (
    <section className={className} data-testid="product-feedback">
      {muteError && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {muteError}
        </p>
      )}
      <Tabs defaultValue="reviews" className="w-full">
        <TabsList className={listClass}>
          <TabsTrigger value="reviews" className={triggerClass}>
            <Star className="h-4 w-4" aria-hidden="true" />
            Reviews{aggregate.count > 0 ? ` (${aggregate.count})` : ''}
          </TabsTrigger>
          <TabsTrigger value="comments" className={triggerClass}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Comments{commentCount > 0 ? ` (${commentCount})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="mt-4">
          <ProductReviewsSection
            reviewCoord={reviewCoord}
            reviews={reviews}
            aggregate={aggregate}
            status={status}
            profiles={profiles}
            onPosted={handleReviewPosted}
            onMute={onMute}
            mutingPubkey={mutingPubkey}
          />
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <ProductCommentsSection
            coord={coord}
            merchantPubkey={merchantPubkey}
            comments={comments}
            status={status}
            profiles={profiles}
            onPosted={handleCommentPosted}
            onMute={onMute}
            mutingPubkey={mutingPubkey}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
