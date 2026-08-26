'use client';

import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import SignInButton from '@/components/auth/sign-in-button';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import FeedbackAuthor from '@/components/feedback-author';
import { KNOWALL_PUBKEY, SHOP_RELAYS } from '@/lib/nostr';
import { publishToRelays } from '@/lib/relay';
import { buildCommentTemplate, directReplies, topLevelComments } from '@/lib/product-comments';
import type { NostrEvent } from '@/lib/nip99';
import type { ProfileMetadata } from '@/lib/story-social';

/** Comments longer than this are clamped behind a "Show more" toggle. */
const CLAMP_LENGTH = 320;

/** Replies auto-expand for the first two levels, deeper threads start folded. */
const AUTO_EXPAND_DEPTH = 2;

export interface ProductCommentsSectionProps {
  /** The comment thread root: `30402:<merchantPubkey>:<dTag>`. */
  coord: string;
  merchantPubkey: string;
  /** Every kind-1111 comment in the thread (any depth), already moderated. */
  comments: NostrEvent[];
  status: 'loading' | 'ready' | 'error';
  profiles: Map<string, ProfileMetadata>;
  onPosted: (comment: NostrEvent) => void;
  /** Present only for the company viewer — mutes the author site-wide. */
  onMute?: (pubkey: string) => void;
  mutingPubkey: string | null;
}

/**
 * NIP-22 comment thread on a product listing: kind-1111 comments rooted on the
 * product's kind-30402 coordinate, threaded to any depth, plus a composer.
 *
 * Signed-in users post through their NIP-07 signer; signed-out users see the
 * thread read-only with a "Sign in to comment" nudge — the same auth gate as
 * story comments. Comment content renders as plain text only (no links, no
 * media) and long comments are clamped, mirroring the story-page moderation
 * posture. When the viewer is signed in AS the company account each
 * third-party comment grows a mute button (lib/moderation.ts).
 */
export default function ProductCommentsSection({
  coord,
  merchantPubkey,
  comments,
  status,
  profiles,
  onPosted,
  onMute,
  mutingPubkey,
}: ProductCommentsSectionProps) {
  const topLevel = topLevelComments(comments, coord);

  return (
    <div className="space-y-6" data-testid="product-comments">
      <CommentComposer coord={coord} merchantPubkey={merchantPubkey} onPosted={onPosted} />

      {status === 'loading' ? (
        <p className="text-sm text-gray-500">Loading comments…</p>
      ) : status === 'error' && comments.length === 0 ? (
        <p className="text-sm text-gray-500">Comments could not be loaded right now.</p>
      ) : topLevel.length === 0 ? (
        <div className="py-6 text-center text-gray-500">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden="true" />
          <p className="text-sm">No comments yet — be the first to start the discussion.</p>
        </div>
      ) : (
        <ul className="list-none space-y-4">
          {topLevel.map((comment) => (
            <ProductComment
              key={comment.id}
              coord={coord}
              merchantPubkey={merchantPubkey}
              comment={comment}
              allComments={comments}
              profiles={profiles}
              onPosted={onPosted}
              onMute={onMute}
              mutingPubkey={mutingPubkey}
              depth={0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One comment plus its (recursive) reply thread. */
function ProductComment({
  coord,
  merchantPubkey,
  comment,
  allComments,
  profiles,
  onPosted,
  onMute,
  mutingPubkey,
  depth,
}: {
  coord: string;
  merchantPubkey: string;
  comment: NostrEvent;
  allComments: NostrEvent[];
  profiles: Map<string, ProfileMetadata>;
  onPosted: (comment: NostrEvent) => void;
  onMute?: (pubkey: string) => void;
  mutingPubkey: string | null;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(depth < AUTO_EXPAND_DEPTH);

  const replies = directReplies(allComments, comment.id);
  const needsClamp = comment.content.length > CLAMP_LENGTH;
  const text =
    needsClamp && !expanded ? `${comment.content.slice(0, CLAMP_LENGTH)}…` : comment.content;

  return (
    <li
      className={depth > 0 ? 'ml-5 border-l-2 border-gray-800 pl-4' : ''}
      data-testid="product-comment"
    >
      <div className="group">
        <FeedbackAuthor
          pubkey={comment.pubkey}
          createdAt={comment.created_at}
          metadata={profiles.get(comment.pubkey)}
          onMute={
            onMute && comment.pubkey.toLowerCase() !== KNOWALL_PUBKEY
              ? () => onMute(comment.pubkey)
              : undefined
          }
          isMuting={mutingPubkey === comment.pubkey}
        />
        {/* Plain text only — no linkification or media in comments. */}
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">
          {text}
        </p>
        {needsClamp && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-1 text-xs font-medium text-lime-500 hover:underline"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowReplyForm((value) => !value)}
            className="text-xs font-medium text-gray-500 hover:text-lime-500"
          >
            Reply
          </button>
          {replies.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReplies((value) => !value)}
              className="text-xs font-medium text-gray-500 hover:text-lime-500"
            >
              {showReplies ? 'Hide' : 'Show'} {replies.length}{' '}
              {replies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </div>

      {showReplyForm && (
        <div className="ml-5 mt-3">
          <CommentComposer
            coord={coord}
            merchantPubkey={merchantPubkey}
            reply={comment}
            onPosted={(posted) => {
              onPosted(posted);
              setShowReplyForm(false);
              setShowReplies(true);
            }}
          />
        </div>
      )}

      {replies.length > 0 && showReplies && (
        <ul className="mt-3 list-none space-y-3">
          {replies.map((reply) => (
            <ProductComment
              key={reply.id}
              coord={coord}
              merchantPubkey={merchantPubkey}
              comment={reply}
              allComments={allComments}
              profiles={profiles}
              onPosted={onPosted}
              onMute={onMute}
              mutingPubkey={mutingPubkey}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Compose box for a top-level comment or a threaded reply, NIP-07 gated. */
function CommentComposer({
  coord,
  merchantPubkey,
  reply,
  onPosted,
}: {
  coord: string;
  merchantPubkey: string;
  reply?: NostrEvent;
  onPosted: (comment: NostrEvent) => void;
}) {
  const { user, signEvent } = useNostrAuth();
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = content.trim();
    if (!user || !text || isPosting) return;

    setIsPosting(true);
    setError(null);
    try {
      const signed = await signEvent(buildCommentTemplate({ coord, merchantPubkey }, text, reply));
      await publishToRelays(SHOP_RELAYS, signed);
      onPosted(signed);
      setContent('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not post your comment. Please try again.'
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2"
      data-testid={reply ? 'product-reply-composer' : 'product-comment-composer'}
    >
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={
          user
            ? reply
              ? 'Write a reply…'
              : 'Write a comment…'
            : 'Sign in to join the conversation…'
        }
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
            disabled={isPosting || !content.trim()}
            className="bg-lime-600 text-white hover:bg-lime-700"
          >
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            {isPosting ? 'Posting…' : reply ? 'Reply' : 'Comment'}
          </Button>
        ) : (
          <SignInButton label={reply ? 'Sign in to reply' : 'Sign in to comment'} />
        )}
      </div>
    </form>
  );
}
