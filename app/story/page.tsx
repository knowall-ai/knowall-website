import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import StoryFeed from '@/components/story-feed';
import { KNOWALL_NPUB } from '@/lib/nostr';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Our Story | KnowAll AI',
  description:
    'Follow the KnowAll AI story — product updates, builds, and behind-the-scenes notes, straight from our Nostr feed.',
};

export default function StoryPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      {/* Profile hero — slim banner with the avatar overlapping its bottom edge. */}
      <div>
        <div className="relative h-40 w-full sm:h-48 bg-gradient-to-r from-lime-900/40 via-gray-900 to-gray-800">
          <Image
            src="/images/knowall-nostr-banner.png"
            alt="KnowAll AI banner"
            fill
            priority
            className="object-cover"
          />
        </div>

        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Avatar straddles the banner/content boundary, profile-style. */}
          <div className="relative z-10 -mt-12 sm:-mt-14 w-fit">
            <Image
              src="/images/knowall-nostr-avatar.png"
              alt="KnowAll AI logo"
              width={112}
              height={112}
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-gray-950 bg-gray-900 shadow-md"
            />
          </div>

          <div className="mt-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">KnowAll AI</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              We build intelligent AI systems that transform businesses through custom Microsoft
              Copilots, multi-agent teams, and Bitcoin-powered value exchange networks.
            </p>
          </div>

          {/* Nostr identity — folded into the header instead of a separate card. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button asChild size="sm" className="bg-lime-600 hover:bg-lime-700 text-white">
              <a
                href={`https://njump.me/${KNOWALL_NPUB}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Follow us on Nostr
              </a>
            </Button>
            <span className="font-mono text-xs text-gray-500 break-all" title={KNOWALL_NPUB}>
              {`${KNOWALL_NPUB.slice(0, 12)}…${KNOWALL_NPUB.slice(-6)}`}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-gray-800 pt-4 text-sm font-medium text-lime-500">
            <BookOpen className="h-4 w-4" />
            <span>Our Story</span>
          </div>
        </div>
      </div>

      {/* Timeline — the story is our Nostr feed. */}
      <section className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <StoryFeed />

        {/* CTA back to services */}
        <div className="mt-14 text-center">
          <p className="text-lg text-gray-300 mb-6">
            Want to be part of the next chapter? See what we can build together.
          </p>
          <Button asChild className="bg-lime-600 hover:bg-lime-700 text-white">
            <Link href="/#services">Explore our services</Link>
          </Button>
        </div>
      </section>

      <Footer darkMode={true} />
    </main>
  );
}
