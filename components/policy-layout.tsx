import type { ReactNode } from 'react';
import Link from 'next/link';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { POLICY_LINKS } from '@/lib/policy-links';

/** Inline "message us on Nostr" affordance used across the shop policy pages. */
export function MessageUsLink({ children }: { children: ReactNode }) {
  return (
    <a
      href="https://primal.net/p/nprofile1qqstwvlv45n9mr0k8c279rfyjus5rf0tcgdlmu2n9tdd9ensr6zn3ys4u7evm"
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-lime-500 hover:text-lime-400 transition-colors"
    >
      {children}
    </a>
  );
}

/**
 * Shared frame for the shop policy pages: Header, a titled prose column, and a
 * compact strip cross-linking the other policies — mirrors the PolicyLayout
 * pattern used on Robotechy and Eden Weeks Art.
 */
export default function PolicyLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      <div className="container max-w-3xl mx-auto flex-1 px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-white">{title}</h1>
        <div className="space-y-6 text-gray-300">{children}</div>

        <nav className="mt-12 pt-6 border-t border-gray-800 text-sm text-gray-400">
          <span className="mr-2">Shop policies:</span>
          {POLICY_LINKS.map((link, i) => (
            <span key={link.path}>
              {i > 0 && <span className="mx-2 text-gray-600">·</span>}
              <Link href={link.path} className="hover:text-white transition-colors">
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>

      <Footer darkMode={true} />
    </main>
  );
}
