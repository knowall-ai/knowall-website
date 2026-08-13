import type React from 'react';
import './globals.css';
import { preload } from 'react-dom';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ContactPanelProvider } from '@/components/contact-panel';
import { NostrAuthProvider } from '@/components/auth/nostr-auth-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'KnowAll.ai - AI Consultancy & Agent Development',
  description:
    'AI consultancy specializing in agent development and Bitcoin-powered value-for-value transactions.',
  generator: 'v0.dev',
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  metadataBase: new URL('https://knowall.ai'),
  keywords: [
    'AI',
    'artificial intelligence',
    'consultancy',
    'chatbot',
    'Bitcoin',
    'Lightning Network',
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Hint the hero background early without hand-writing <head> (which makes React
  // warn about Next's dev-injected script tags on every page).
  preload('/images/green-bg.png', { as: 'image' });
  return (
    <html lang="en">
      <body className={inter.className}>
        <NostrAuthProvider>
          <ContactPanelProvider>{children}</ContactPanelProvider>
        </NostrAuthProvider>
      </body>
    </html>
  );
}
