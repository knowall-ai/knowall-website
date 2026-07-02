'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Hash links point at sections on the homepage (prefixed with '/' so they
  // still work from other routes like /story). Home and the logo use '/#' so
  // that clicking them scrolls to the top when already on the homepage, while
  // still navigating home from other routes. The Story route lives in the
  // right-hand cluster as a BookOpen icon rather than in this text nav.
  const navLinks = [
    { name: 'Home', href: '/#' },
    { name: 'Services', href: '/#services' },
    { name: 'Zapp.ie', href: '/#zapp' },
    { name: 'Copilots', href: '/#copilots' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800">
      <div className="container max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/#" className="flex items-center">
            <Logo darkBackground={true} className="h-12" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-gray-300 hover:text-lime-500 transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/story"
              aria-label="Our Story"
              title="Our Story"
              className="p-2 text-gray-300 hover:text-lime-500 transition-colors"
            >
              <BookOpen className="h-5 w-5" />
            </Link>
            <Button asChild className="bg-lime-600 hover:bg-lime-700 text-white">
              <Link href="/#contact">Contact Us</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-gray-300" />
            ) : (
              <Menu className="h-6 w-6 text-gray-300" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden pt-4 pb-6">
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-gray-300 hover:text-lime-500 transition-colors py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <Link
                href="/story"
                aria-label="Our Story"
                className="flex items-center gap-2 text-gray-300 hover:text-lime-500 transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <BookOpen className="h-5 w-5" />
                Our Story
              </Link>
              <div className="pt-2">
                <Button asChild className="w-full bg-lime-600 hover:bg-lime-700 text-white">
                  <Link href="/#contact" onClick={() => setIsMenuOpen(false)}>
                    Contact Us
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
