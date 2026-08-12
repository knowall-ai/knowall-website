import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/header';
import Footer from '@/components/footer';
import StoryHero from '@/components/story-hero';
import StoryFeed from '@/components/story-feed';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Our Story | KnowAll AI',
  description:
    'Follow the KnowAll AI story — product updates, builds, and behind-the-scenes notes, straight from our Nostr feed.',
};

/**
 * The Story page: the company's live Nostr presence rendered as a page —
 * profile hero (kind-0 metadata) above a timeline of kind-1 notes. Mirrors
 * the story pages on robotechy.com and edenweeks.art.
 */
export default function StoryPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      <StoryHero />

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
