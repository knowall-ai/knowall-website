import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Page not found | KnowAll AI',
};

/** Branded 404 — rendered by Next for unknown routes and `notFound()` calls
 *  (e.g. invalid /shop/<naddr> product addresses). */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <section className="container mx-auto flex max-w-6xl flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 px-6 py-12 text-center">
          <Compass className="mx-auto mb-4 h-12 w-12 text-lime-600" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-bold text-white">Page not found</h1>
          <p className="text-sm leading-relaxed text-gray-400">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-lime-600 hover:bg-lime-700 text-white">
              <Link href="/">Go home</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-gray-700 bg-transparent text-gray-300 hover:border-lime-600 hover:bg-gray-800 hover:text-lime-500"
            >
              <Link href="/shop">Visit the shop</Link>
            </Button>
          </div>
        </div>
      </section>
      <Footer darkMode={true} />
    </main>
  );
}
