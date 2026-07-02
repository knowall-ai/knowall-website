'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KNOWALL_NPUB, KNOWALL_PUBKEY } from '@/lib/nostr';

const RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];
const MAX_NOTES = 50;
const RELAY_TIMEOUT_MS = 8000;

interface NostrNote {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
}

/* ---------------------------------------------------------------------------
 * Minimal bech32 (BIP-173) encoder — just enough to turn a hex event id into
 * a NIP-19 `note1…` identifier for njump links, without pulling in nostr-tools.
 * ------------------------------------------------------------------------- */

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Polymod(values: number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= BECH32_GENERATOR[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const expanded: number[] = [];
  for (const c of hrp) expanded.push(c.charCodeAt(0) >> 5);
  expanded.push(0);
  for (const c of hrp) expanded.push(c.charCodeAt(0) & 31);
  return expanded;
}

/** Regroup 8-bit bytes (as a hex string) into the 5-bit words bech32 encodes. */
function hexToWords(hex: string): number[] {
  const words: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < hex.length; i += 2) {
    acc = (acc << 8) | parseInt(hex.slice(i, i + 2), 16);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) words.push((acc << (5 - bits)) & 31);
  return words;
}

function bech32Encode(hrp: string, words: number[]): string {
  const values = [...bech32HrpExpand(hrp), ...words];
  const polymod = bech32Polymod([...values, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum: number[] = [];
  for (let i = 0; i < 6; i++) checksum.push((polymod >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...words, ...checksum].map((w) => BECH32_CHARSET[w]).join('')}`;
}

/** NIP-19 `note1…` encoding of a hex event id, for njump.me links. */
export function encodeNoteId(idHex: string): string {
  return bech32Encode('note', hexToWords(idHex));
}

/* ---------------------------------------------------------------------------
 * Content helpers — relative timestamps, image extraction, and linkification.
 * ------------------------------------------------------------------------- */

function timeAgo(unixSeconds: number): string {
  const seconds = Math.floor(Date.now() / 1000) - unixSeconds;
  const units: Array<[string, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, unitSeconds] of units) {
    const count = Math.floor(seconds / unitSeconds);
    if (count >= 1) return `${count} ${name}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

const IMAGE_URL_REGEX = /https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?/gi;
// Web URLs, plus NIP-21 nostr: references (npub/note/nprofile/nevent/naddr),
// which are rendered as short njump.me links rather than walls of bech32.
const LINK_REGEX =
  /(https?:\/\/[^\s]+)|(?:nostr:)?((?:npub|note|nprofile|nevent|naddr)1[02-9ac-hj-np-z]{20,})/g;

function extractImageUrls(content: string): string[] {
  return [...new Set(content.match(IMAGE_URL_REGEX) ?? [])];
}

function stripImageUrls(content: string): string {
  return content
    .replace(IMAGE_URL_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Renders note text with web URLs linkified and NIP-21 nostr: references
 *  shortened into njump.me links; line breaks preserved by the parent's
 *  `whitespace-pre-wrap`. */
function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(LINK_REGEX)) {
    const [fullMatch, url, nostrRef] = match;
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
    } else {
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
  const [notes, setNotes] = useState<NostrNote[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const events = new Map<string, NostrNote>();
    const sockets: WebSocket[] = [];
    let settledRelays = 0;
    let successfulRelays = 0;

    const finish = () => {
      if (cancelled) return;
      // Top-level notes only: replies (events referencing another event via an
      // 'e' tag) don't belong on the story timeline.
      const timeline = [...events.values()]
        .filter((event) => !event.tags.some((tag) => tag[0] === 'e'))
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
            events.set(data[2].id, data[2] as NostrNote);
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
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (status === 'error' && notes.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 py-12 px-6 text-center">
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
    <ol className="list-none" data-testid="story-feed">
      {notes.map((note, index) => (
        <StoryNote key={note.id} note={note} isLast={index === notes.length - 1} />
      ))}
    </ol>
  );
}

/** One entry on the story timeline: node + spine, relative timestamp linking to
 *  the note on njump, linkified text, and any attached images. */
function StoryNote({ note, isLast }: { note: NostrNote; isLast: boolean }) {
  const images = extractImageUrls(note.content);
  const text = stripImageUrls(note.content);
  const timestamp = new Date(note.created_at * 1000);

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
              {linkify(text)}
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
                  alt={
                    text
                      ? `${text.slice(0, 80)}${images.length > 1 ? ` (image ${index + 1})` : ''}`
                      : `KnowAll AI story post image ${index + 1}`
                  }
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
        </div>
      </div>
    </li>
  );
}
