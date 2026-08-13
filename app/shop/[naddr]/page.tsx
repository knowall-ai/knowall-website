import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/header';
import Footer from '@/components/footer';
import ProductDetail from '@/components/product-detail';
import { decodeListingNaddr } from '@/lib/naddr';
import { KNOWALL_PUBKEY } from '@/lib/nostr';

interface ProductPageProps {
  params: Promise<{ naddr: string }>;
}

/**
 * "tminus15-book" → "Tminus15 Book" — a readable page title derived from the
 * d-tag. Listing data is only fetched client-side (relays are too slow/flaky
 * to block SSR on), so the d-tag is the best server-known name for metadata.
 */
function humanizeIdentifier(identifier: string): string {
  return identifier
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { naddr } = await params;
  const address = decodeListingNaddr(naddr, KNOWALL_PUBKEY);
  if (!address) return { title: 'Product not found | KnowAll AI' };
  const name = humanizeIdentifier(address.identifier) || 'Product';
  return {
    title: `${name} | Shop | KnowAll AI`,
    description: `${name} — a KnowAll AI product listed on Nostr, purchasable with Bitcoin over Lightning.`,
    openGraph: {
      title: `${name} | KnowAll AI Shop`,
      url: `https://www.knowall.ai/shop/${naddr}`,
      siteName: 'KnowAll AI',
    },
  };
}

/**
 * Per-product page at /shop/<naddr>, modeled on robotechy.com's /<naddr>
 * product routes. The naddr is decoded and validated server-side — anything
 * that isn't a kind-30402 address by the KnowAll pubkey is a 404 — and the
 * listing itself is fetched client-side from the shop relays.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { naddr } = await params;
  const address = decodeListingNaddr(naddr, KNOWALL_PUBKEY);
  if (!address) notFound();

  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <section className="container mx-auto max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <ProductDetail naddr={naddr} pubkey={address.pubkey} identifier={address.identifier} />
      </section>
      <Footer darkMode={true} />
    </main>
  );
}
