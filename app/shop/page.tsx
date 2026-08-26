import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/header';
import Footer from '@/components/footer';
import ShopHero from '@/components/shop-hero';
import ShopCatalog from '@/components/shop-catalog';
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

      {/* Profile hero — live Nostr banner/avatar, same treatment as the Story page. */}
      <ShopHero />

      {/* Listings grid — live NIP-99 classifieds from our Nostr relays, with
          owner tools above it for the signed-in KnowAll npub. */}
      <section className="container max-w-6xl mx-auto flex-1 px-4 sm:px-6 lg:px-8 py-12">
        <ShopCatalog />

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
