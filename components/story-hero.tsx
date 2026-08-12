'use client';

import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KNOWALL_NPUB } from '@/lib/nostr';
import { useNostrProfile } from '@/hooks/use-nostr-profile';

/**
 * The Story page hero: the KnowAll AI Nostr profile rendered like a client —
 * banner with the avatar overlapping its bottom edge, name, bio, follow
 * button and npub. Banner, avatar, name and bio come live from the account's
 * kind-0 metadata event via useNostrProfile (newest wins across relays), with
 * static fallbacks so the hero renders instantly and still looks right if
 * every relay is down. Mirrors the profile-hero pattern on robotechy.com and
 * edenweeks.art.
 */
export default function StoryHero() {
  const { bannerSrc, avatarSrc, name, about, onBannerError, onAvatarError } = useNostrProfile();

  return (
    <div data-testid="story-hero">
      {/* Banner: live profile banner (or the static export of it), over a
          brand gradient that shows through while the image loads. */}
      <div className="relative h-40 w-full sm:h-48 bg-gradient-to-r from-lime-900/40 via-gray-900 to-gray-800">
        {/* eslint-disable-next-line @next/next/no-img-element -- live banner URLs come from Nostr kind-0 metadata, hosts unknown at build time */}
        <img
          src={bannerSrc}
          alt={`${name} banner`}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onBannerError}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Avatar straddles the banner/content boundary, profile-style. */}
        <div className="relative z-10 -mt-12 sm:-mt-14 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- live avatar URLs come from Nostr kind-0 metadata, hosts unknown at build time */}
          <img
            src={avatarSrc}
            alt={`${name} logo`}
            width={112}
            height={112}
            referrerPolicy="no-referrer"
            onError={onAvatarError}
            className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-gray-950 bg-gray-900 object-cover shadow-md"
          />
        </div>

        <div className="mt-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{name}</h1>
          <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-gray-400">
            {about}
          </p>
        </div>

        {/* Nostr identity — folded into the header instead of a separate card. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button asChild size="sm" className="bg-lime-600 hover:bg-lime-700 text-white">
            <a href={`https://njump.me/${KNOWALL_NPUB}`} target="_blank" rel="noopener noreferrer">
              Follow us on Nostr
            </a>
          </Button>
          <span className="font-mono text-xs text-gray-500 break-all" title={KNOWALL_NPUB}>
            {`${KNOWALL_NPUB.slice(0, 12)}…${KNOWALL_NPUB.slice(-6)}`}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-gray-800 pt-4 text-sm font-medium text-lime-500">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          <span>Our Story</span>
        </div>
      </div>
    </div>
  );
}
