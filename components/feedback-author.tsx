'use client';

import { useState } from 'react';
import { VolumeX } from 'lucide-react';
import { profileDisplayName, type ProfileMetadata } from '@/lib/story-social';
import { encodeBech32, timeAgo } from '@/lib/story-notes';

/**
 * Author byline shared by product comments and reviews: avatar + name (kind-0
 * metadata, njump-linked), relative time — plus, for the company account only,
 * the discreet hover-revealed mute button (same affordance as story comments).
 * `children` renders on the right of the byline row (e.g. a review's stars).
 */
export default function FeedbackAuthor({
  pubkey,
  createdAt,
  metadata,
  onMute,
  isMuting,
  children,
}: {
  pubkey: string;
  createdAt: number;
  metadata: ProfileMetadata | undefined;
  /** Present only when the viewer may moderate (company account). */
  onMute?: () => void;
  isMuting?: boolean;
  children?: React.ReactNode;
}) {
  // Avatar URLs come from arbitrary (sometimes dead) hosts; when one fails to
  // load, fall back to the initial-based avatar instead of an empty gap.
  const [avatarBroken, setAvatarBroken] = useState(false);
  const npub = encodeBech32('npub', pubkey);
  const name = profileDisplayName(metadata, npub);

  return (
    <div className="flex items-center gap-3">
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
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
        <a
          href={`https://njump.me/${npub}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gray-200 hover:text-lime-500"
        >
          {name}
        </a>
        <span className="text-xs text-gray-500">{timeAgo(createdAt)}</span>
        <span className="ml-auto flex items-center gap-2">
          {children}
          {onMute && (
            <button
              type="button"
              onClick={onMute}
              disabled={isMuting}
              title="Mute this user (adds them to the KnowAll mute list)"
              aria-label={`Mute ${name}`}
              data-testid="feedback-mute-button"
              className="text-gray-600 opacity-0 transition-opacity hover:text-red-400 focus-visible:opacity-100 disabled:cursor-wait disabled:opacity-100 group-hover:opacity-100"
            >
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
