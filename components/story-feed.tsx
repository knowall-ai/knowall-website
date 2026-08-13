'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BookOpen, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StoryComments from '@/components/story-comments';
import StoryZapButton from '@/components/story-zap';
import { KNOWALL_NPUB, KNOWALL_PUBKEY } from '@/lib/nostr';
import { SOCIAL_RELAYS, queryRelays } from '@/lib/relay';
import {
  type ZapTotals,
  aggregateZapsByNote,
  groupRepliesByNote,
  sortRepliesChronologically,
} from '@/lib/story-social';
import {
  type NostrEvent,
  encodeNoteId,
  extractImageUrls,
  extractVideoUrls,
  isReply,
  stripMediaUrls,
  timeAgo,
} from '@/lib/story-notes';

const RELAYS = SOCIAL_RELAYS;
const MAX_NOTES = 50;
const RELAY_TIMEOUT_MS = 8000;
const NO_ZAPS: ZapTotals = { count: 0, sats: 0 };

/* ---------------------------------------------------------------------------
 * Content linkification — web URLs, NIP-21 nostr: references and #hashtags.
 * ------------------------------------------------------------------------- */

// Web URLs, NIP-21 nostr: references (npub/note/nprofile/nevent/naddr) rendered
// as short njump.me links rather than walls of bech32, and #hashtags rendered
// as filter buttons (the edenweeks.art story pattern).
const LINK_REGEX =
  /(https?:\/\/[^\s]+)|(?:nostr:)?((?:npub|note|nprofile|nevent|naddr)1[02-9ac-hj-np-z]{20,})|(#\w+)/g;

function linkify(text: string, onTagClick: (tag: string) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(LINK_REGEX)) {
    const [fullMatch, url, nostrRef, hashtag] = match;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (url) {
      parts.push(
        <a
          key={`link-${key++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lime-500 hover:underline break-all"
        >
          {url}
        </a>
      );
    } else if (nostrRef) {
      parts.push(
        <a
          key={`link-${key++}`}
          href={`https://njump.me/${nostrRef}`}
          target="_blank"
          rel="noopener noreferrer"
          title={nostrRef}
          className="text-lime-500 hover:underline"
        >
          {`@${nostrRef.slice(0, 10)}…${nostrRef.slice(-4)}`}
        </a>
      );
    } else {
      parts.push(
        <button
          key={`link-${key++}`}
          type="button"
          onClick={() => onTagClick(hashtag.slice(1))}
          className="font-medium text-lime-500 hover:underline"
        >
          {hashtag}
        </button>
      );
    }
    lastIndex = match.index + fullMatch.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/* ---------------------------------------------------------------------------
 * The feed.
 * ------------------------------------------------------------------------- */

interface StoryFeedProps {
  /** Hex pubkey whose kind-1 notes make up the story (defaults to KnowAll AI). */
  pubkey?: string;
}

export default function StoryFeed({ pubkey = KNOWALL_PUBKEY }: StoryFeedProps) {
  const [notes, setNotes] = useState<NostrEvent[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [repliesByNote, setRepliesByNote] = useState<Map<string, NostrEvent[]>>(new Map());
  const [zapsByNote, setZapsByNote] = useState<Map<string, ZapTotals>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const events = new Map<string, NostrEvent>();
    const sockets: WebSocket[] = [];
    let settledRelays = 0;
    let successfulRelays = 0;

    const finish = () => {
      if (cancelled) return;
      // Top-level notes only: replies (NIP-10 threading, excluding mention
      // markers) don't belong on the story timeline.
      const timeline = [...events.values()]
        .filter((event) => !isReply(event))
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, MAX_NOTES);
      setNotes(timeline);
      setStatus(successfulRelays === 0 && timeline.length === 0 ? 'error' : 'ready');
    };

    const settle = (ok: boolean) => {
      settledRelays += 1;
      if (ok) successfulRelays += 1;
      if (settledRelays === RELAYS.length) finish();
    };

    for (const url of RELAYS) {
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        settle(false);
        continue;
      }
      sockets.push(socket);

      let done = false;
      const complete = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          // Already closed.
        }
        settle(ok);
      };
      const timer = setTimeout(() => complete(false), RELAY_TIMEOUT_MS);

      socket.onopen = () => {
        socket.send(
          JSON.stringify(['REQ', 'story', { kinds: [1], authors: [pubkey], limit: MAX_NOTES }])
        );
      };
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data as string);
          if (data[0] === 'EVENT' && data[2]?.kind === 1 && data[2]?.pubkey === pubkey) {
            events.set(data[2].id, data[2] as NostrEvent);
          } else if (data[0] === 'EOSE') {
            complete(true);
          }
        } catch {
          // Ignore malformed relay messages.
        }
      };
      socket.onerror = () => complete(false);
      socket.onclose = () => complete(false);
    }

    return () => {
      cancelled = true;
      for (const socket of sockets) {
        try {
          socket.close();
        } catch {
          // Already closed.
        }
      }
    };
  }, [pubkey]);

  // Once the timeline has settled, fetch every post's social context in one
  // batched query — kind-1 replies (the comment threads) and kind-9735 zap
  // receipts — rather than one round-trip per post.
  useEffect(() => {
    if (notes.length === 0) return;
    let cancelled = false;
    const noteIds = notes.map((note) => note.id);
    void queryRelays(RELAYS, [{ kinds: [1, 9735], '#e': noteIds, limit: 1000 }]).then((events) => {
      if (cancelled) return;
      setRepliesByNote(groupRepliesByNote(events, noteIds));
      setZapsByNote(aggregateZapsByNote(events, noteIds));
    });
    return () => {
      cancelled = true;
    };
  }, [notes]);

  // Hashtag filter (the edenweeks.art story pattern): clicking a #tag in any
  // note narrows the timeline to notes mentioning that tag.
  const visibleNotes = useMemo(() => {
    if (!activeTag) return notes;
    const regex = new RegExp(`#${activeTag}\\b`, 'i');
    return notes.filter((note) => regex.test(note.content));
  }, [notes, activeTag]);

  if (status === 'loading') {
    return (
      <div className="space-y-8" data-testid="story-loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 sm:gap-6">
            <Skeleton className="mt-1.5 h-4 w-4 shrink-0 rounded-full bg-gray-800" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3 w-24 bg-gray-800" />
              <Skeleton className="h-4 w-full bg-gray-800" />
              <Skeleton className="h-4 w-3/4 bg-gray-800" />
              <Skeleton className="h-48 w-full rounded-lg bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (status === 'error' && notes.length === 0) {
    return (
      <div
        className="rounded-xl border border-gray-800 bg-gray-900 py-12 px-6 text-center"
        data-testid="story-error"
      >
        <p className="text-gray-400">
          We couldn&apos;t load the story feed right now. Please try again later, or{' '}
          <a
            href={`https://njump.me/${KNOWALL_NPUB}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lime-500 hover:underline"
          >
            read it on njump
          </a>
          .
        </p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div
        className="rounded-xl border border-gray-800 bg-gray-900 py-12 px-6 text-center"
        data-testid="story-empty"
      >
        <BookOpen className="mx-auto mb-4 h-12 w-12 text-lime-600" />
        <h2 className="mb-2 text-lg font-semibold text-white">Our story is just beginning</h2>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-gray-400">
          KnowAll AI was founded by our CEO, Ben Weeks — an open-source developer with deep roots in
          the Nostr and Bitcoin communities — and operates through two companies: KnowAll AI Ltd in
          the UK and KnowAll AI SAS de CV, incorporated in El Salvador in 2025. Everything we
          publish lands here first, straight from our Nostr feed.
        </p>
        <Button asChild className="mt-6 bg-lime-600 hover:bg-lime-700 text-white">
          <a href={`https://njump.me/${KNOWALL_NPUB}`} target="_blank" rel="noopener noreferrer">
            Follow us on Nostr
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div>
      {activeTag && (
        <div
          className="mb-6 flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 p-3"
          data-testid="story-tag-filter"
        >
          <span className="text-sm text-gray-400">Filtering by:</span>
          <span className="rounded bg-lime-500/10 px-2 py-0.5 text-sm font-medium text-lime-500">
            #{activeTag}
          </span>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className="ml-auto flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>
      )}

      {visibleNotes.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 py-12 px-6 text-center">
          <p className="text-gray-400">No posts mention #{activeTag} yet.</p>
        </div>
      ) : (
        <ol className="list-none" data-testid="story-feed">
          {visibleNotes.map((note, index) => (
            <StoryNote
              key={note.id}
              note={note}
              isLast={index === visibleNotes.length - 1}
              onTagClick={setActiveTag}
              replies={repliesByNote.get(note.id) ?? []}
              zapTotals={zapsByNote.get(note.id) ?? NO_ZAPS}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

/** One entry on the story timeline: node + spine, relative timestamp linking to
 *  the note on njump, linkified text, any attached images/videos, and the
 *  social action row — comment count with an expandable thread, and a zap
 *  button with the post's running total. */
function StoryNote({
  note,
  isLast,
  onTagClick,
  replies,
  zapTotals,
}: {
  note: NostrEvent;
  isLast: boolean;
  onTagClick: (tag: string) => void;
  replies: NostrEvent[];
  zapTotals: ZapTotals;
}) {
  const [showComments, setShowComments] = useState(false);
  // Comments this visitor posted in this session, merged into the fetched
  // thread so they appear immediately (relays take a moment to serve them).
  const [localReplies, setLocalReplies] = useState<NostrEvent[]>([]);
  const images = extractImageUrls(note);
  const videos = extractVideoUrls(note);
  const text = stripMediaUrls(note.content);
  const timestamp = new Date(note.created_at * 1000);

  const thread = useMemo(() => {
    const fetchedIds = new Set(replies.map((reply) => reply.id));
    const merged = [...replies, ...localReplies.filter((reply) => !fetchedIds.has(reply.id))];
    return sortRepliesChronologically(merged);
  }, [replies, localReplies]);

  // Content-aware alt text so screen readers get something meaningful rather
  // than the same generic label repeated; numbered generic fallback otherwise.
  const altBase = text.slice(0, 80);
  const imageAlt = (index: number) => {
    if (!altBase) return `KnowAll AI story post image ${index + 1}`;
    return images.length > 1 ? `${altBase} (image ${index + 1})` : altBase;
  };

  return (
    <li className="relative flex gap-4 sm:gap-6">
      {/* Timeline spine + node */}
      <div className="flex flex-col items-center">
        <span
          className="mt-1.5 h-4 w-4 shrink-0 rounded-full bg-lime-500 ring-4 ring-lime-500/20"
          aria-hidden="true"
        />
        {!isLast && (
          <span
            className="mt-1 w-0.5 grow bg-gradient-to-b from-lime-500/40 to-transparent"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Note card */}
      <div className="mb-8 flex-1 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-sm transition-shadow hover:shadow-md">
        <div className="space-y-4 p-5 sm:p-6">
          <a
            href={`https://njump.me/${encodeNoteId(note.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <time
              dateTime={timestamp.toISOString()}
              title={timestamp.toLocaleString()}
              className="text-xs font-medium uppercase tracking-wide text-lime-500 hover:underline"
            >
              {timeAgo(note.created_at)}
            </time>
          </a>

          {text.length > 0 && (
            <div className="whitespace-pre-wrap break-words leading-relaxed text-gray-300">
              {linkify(text, onTagClick)}
            </div>
          )}

          {images.length > 0 && (
            <div
              className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}
            >
              {images.map((src, index) => (
                // Arbitrary remote hosts from Nostr notes can't be enumerated in
                // next.config images.remotePatterns, so plain <img> is used here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={imageAlt(index)}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Nostr notes reference images on arbitrary (sometimes dead)
                    // hosts; hide the ones that fail rather than leaving gaps.
                    e.currentTarget.style.display = 'none';
                  }}
                  className="w-full rounded-lg border border-gray-800 object-cover"
                />
              ))}
            </div>
          )}

          {videos.map((src) => (
            <div key={src} className="overflow-hidden rounded-lg border border-gray-800 bg-black">
              <video src={src} controls preload="metadata" className="max-h-[500px] w-full" />
            </div>
          ))}

          {/* Social actions: expandable comment thread + NIP-57 zaps. */}
          <div className="flex items-center gap-5 border-t border-gray-800 pt-3">
            <button
              type="button"
              onClick={() => setShowComments((value) => !value)}
              aria-expanded={showComments}
              data-testid="story-comments-toggle"
              className={`flex items-center gap-1.5 text-sm transition-colors hover:text-lime-500 ${
                showComments ? 'text-lime-500' : 'text-gray-400'
              }`}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              <span>
                {thread.length > 0
                  ? `${thread.length} ${thread.length === 1 ? 'comment' : 'comments'}`
                  : 'Comment'}
              </span>
            </button>
            <StoryZapButton note={note} totals={zapTotals} />
          </div>

          {showComments && (
            <StoryComments
              note={note}
              replies={thread}
              onPosted={(reply) => setLocalReplies((current) => [...current, reply])}
            />
          )}
        </div>
      </div>
    </li>
  );
}
