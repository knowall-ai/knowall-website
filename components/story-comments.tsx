'use client';

import { useEffect, useState } from 'react';
import { Send, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import SignInButton from '@/components/auth/sign-in-button';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import { KNOWALL_PUBKEY } from '@/lib/nostr';
import { muteUser } from '@/lib/moderation';
import { SOCIAL_RELAYS, publishToRelays } from '@/lib/relay';
import { fetchProfiles } from '@/lib/nostr-profiles';
import { buildReplyTags, profileDisplayName, type ProfileMetadata } from '@/lib/story-social';
import { encodeBech32, timeAgo, type NostrEvent } from '@/lib/story-notes';

/** Comments longer than this are clamped behind a "Show more" toggle. */
const CLAMP_LENGTH = 320;

/**
 * The expanded comment thread under a story post: other users' kind-1 NIP-10
 * replies (oldest-first, so the newest reads last) plus a composer.
 *
 * Signed-in users post a kind-1 reply through their NIP-07 signer, tagged with
 * the story note as thread root; signed-out users see the thread read-only
 * with a "Sign in to comment" nudge. Mirrors StoryReplies on edenweeks.art.
 *
 * Moderation: comment content renders as plain text only (no links, no media)
 * and long comments are clamped with an explicit expand. When the viewer is
 * signed in AS the company account, each third-party comment additionally
 * grows a mute button that appends the author to the company's NIP-51 mute
 * list (lib/moderation.ts) — invisible to everyone else.
 */
export default function StoryComments({
  note,
  replies,
  onPosted,
  onMuted,
}: {
  note: NostrEvent;
  replies: NostrEvent[];
  onPosted: (reply: NostrEvent) => void;
  onMuted: (pubkey: string) => void;
}) {
  const { user, signEvent } = useNostrAuth();
  const [profiles, setProfiles] = useState<Map<string, ProfileMetadata>>(new Map());
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutingPubkey, setMutingPubkey] = useState<string | null>(null);
  const [muteError, setMuteError] = useState<string | null>(null);

  // The in-site mute action is for the company account only.
  const isCompanyViewer = user?.pubkey === KNOWALL_PUBKEY;

  const handleMute = async (pubkey: string) => {
    if (mutingPubkey) return;
    setMutingPubkey(pubkey);
    setMuteError(null);
    try {
      // Merges into (never clobbers) the current kind-10000 list, signs via
      // the NIP-07 extension, publishes, then the author's comments disappear
      // optimistically via onMuted.
      await muteUser(pubkey, signEvent);
      onMuted(pubkey);
    } catch (err) {
      setMuteError(
        err instanceof Error ? err.message : 'Could not mute this user. Please try again.'
      );
    } finally {
      setMutingPubkey(null);
    }
  };

  // Resolve commenter names/avatars (kind-0, cached in lib/nostr-profiles).
  useEffect(() => {
    const pubkeys = [...new Set(replies.map((reply) => reply.pubkey))];
    if (pubkeys.length === 0) return;
    let cancelled = false;
    void fetchProfiles(pubkeys).then((resolved) => {
      if (!cancelled && resolved.size > 0) setProfiles(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [replies]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = content.trim();
    if (!user || !text || isPosting) return;

    setIsPosting(true);
    setError(null);
    try {
      const signed = await signEvent({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: text,
        // Root marker on the story note + p tags for its author and KnowAll
        // (deduplicated — story posts are authored by the KnowAll account).
        tags: buildReplyTags(note, [KNOWALL_PUBKEY]),
      });
      await publishToRelays(SOCIAL_RELAYS, signed);
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
    <div className="mt-4 border-t border-gray-800 pt-4" data-testid="story-comments">
      {muteError && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {muteError}
        </p>
      )}
      {replies.length > 0 ? (
        <ul className="list-none space-y-4">
          {replies.map((reply) => (
            <StoryComment
              key={reply.id}
              reply={reply}
              metadata={profiles.get(reply.pubkey)}
              onMute={
                isCompanyViewer && reply.pubkey !== KNOWALL_PUBKEY
                  ? () => handleMute(reply.pubkey)
                  : undefined
              }
              isMuting={mutingPubkey === reply.pubkey}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No comments yet — be the first to respond.</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-2" data-testid="story-comment-composer">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={user ? 'Write a comment…' : 'Sign in to join the conversation…'}
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
              {isPosting ? 'Posting…' : 'Comment'}
            </Button>
          ) : (
            <SignInButton label="Sign in to comment" />
          )}
        </div>
      </form>
    </div>
  );
}

/** One comment: avatar + name (kind-0 metadata), relative time, plain text —
 *  plus, for the company account only, a discreet hover-revealed mute button. */
function StoryComment({
  reply,
  metadata,
  onMute,
  isMuting,
}: {
  reply: NostrEvent;
  metadata: ProfileMetadata | undefined;
  onMute?: () => void;
  isMuting?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // Avatar URLs come from arbitrary (sometimes dead) hosts; when one fails to
  // load, fall back to the initial-based avatar instead of an empty gap.
  const [avatarBroken, setAvatarBroken] = useState(false);
  const npub = encodeBech32('npub', reply.pubkey);
  const name = profileDisplayName(metadata, npub);
  const needsClamp = reply.content.length > CLAMP_LENGTH;
  const text = needsClamp && !expanded ? `${reply.content.slice(0, CLAMP_LENGTH)}…` : reply.content;

  return (
    <li className="group flex gap-3">
      <a
        href={`https://njump.me/${npub}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        {metadata?.picture && !avatarBroken ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars come from Nostr kind-0 metadata, hosts unknown at build time
          <img
            src={metadata.picture}
            alt={name}
            width={32}
            height={32}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setAvatarBroken(true)}
            className="h-8 w-8 rounded-full border border-gray-800 bg-gray-800 object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-600 text-sm font-semibold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <a
            href={`https://njump.me/${npub}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-200 hover:text-lime-500"
          >
            {name}
          </a>
          <span className="text-xs text-gray-500">{timeAgo(reply.created_at)}</span>
          {onMute && (
            <button
              type="button"
              onClick={onMute}
              disabled={isMuting}
              title="Mute this user (adds them to the KnowAll mute list)"
              aria-label={`Mute ${name}`}
              data-testid="story-mute-button"
              className="ml-auto text-gray-600 opacity-0 transition-opacity hover:text-red-400 focus-visible:opacity-100 disabled:cursor-wait disabled:opacity-100 group-hover:opacity-100"
            >
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {/* Plain text only — no linkification or media in comments. */}
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">
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
      </div>
    </li>
  );
}
