import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import ShopListings from '@/components/shop-listings';
import { KNOWALL_NPUB } from '@/lib/nostr';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Shop | KnowAll AI',
  description:
    'KnowAll AI merch and products — listed on Nostr, purchasable with Bitcoin over Lightning.',
};

export default function ShopPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      {/* Profile hero — same slim banner treatment as the Story page. */}
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

        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Shop</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              Our products, listed on Nostr and purchasable with Bitcoin over Lightning. Every
              listing below comes straight from our Nostr merchant profile — no middlemen, no
              platform fees.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button asChild size="sm" className="bg-lime-600 hover:bg-lime-700 text-white">
              <a
                href={`https://njump.me/${KNOWALL_NPUB}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View us on Nostr
              </a>
            </Button>
            <span className="font-mono text-xs text-gray-500 break-all" title={KNOWALL_NPUB}>
              {`${KNOWALL_NPUB.slice(0, 12)}…${KNOWALL_NPUB.slice(-6)}`}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-gray-800 pt-4 text-sm font-medium text-lime-500">
            <ShoppingBag className="h-4 w-4" />
            <span>Products</span>
          </div>
        </div>
      </div>

      {/* Listings grid — live NIP-99 classifieds from our Nostr relays. */}
      <section className="container max-w-6xl mx-auto flex-1 px-4 sm:px-6 lg:px-8 py-12">
        <ShopListings />

        {/* CTA back to services */}
        <div className="mt-14 text-center">
          <p className="text-lg text-gray-300 mb-6">
            Looking for something bigger? See what we can build together.
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
