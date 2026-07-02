'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Menu, X } from 'lucide-react';
import Logo from '@/components/logo';
import SignInButton from '@/components/auth/sign-in-button';
import { useContactPanel } from '@/components/contact-panel';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { openContactPanel } = useContactPanel();

  const navLinks = [
    { name: 'Home', href: '#' },
    { name: 'Services', href: '#services' },
    { name: 'Zaplie', href: '#zapp' },
    { name: 'Copilots', href: '#copilots' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800">
      <div className="container max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="#" className="flex items-center">
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
            <button
              onClick={openContactPanel}
              aria-label="Contact us"
              title="Contact us"
              className="text-gray-300 hover:text-lime-500 transition-colors"
            >
              <Mail className="h-5 w-5" />
            </button>
            <SignInButton />
          </div>

          {/* Mobile Contact + Menu Buttons */}
          <div className="md:hidden flex items-center gap-4">
            <button
              onClick={openContactPanel}
              aria-label="Contact us"
              title="Contact us"
              className="text-gray-300 hover:text-lime-500 transition-colors"
            >
              <Mail className="h-5 w-5" />
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
              {isMenuOpen ? (
                <X className="h-6 w-6 text-gray-300" />
              ) : (
                <Menu className="h-6 w-6 text-gray-300" />
              )}
            </button>
          </div>
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
              <div className="pt-2">
                <SignInButton className="w-full" />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
