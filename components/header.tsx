'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, Mail, Menu, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Logo from '@/components/logo';
import SignInButton from '@/components/auth/sign-in-button';
import { useContactPanel } from '@/components/contact-panel';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { openContactPanel } = useContactPanel();

  // Hash links point at sections on the homepage (prefixed with '/' so they
  // still work from other routes like /story). Home and the logo use '/#' so
  // that clicking them scrolls to the top when already on the homepage, while
  // still navigating home from other routes. The Story route lives in the
  // right-hand cluster as a BookOpen icon rather than in this text nav.
  const navLinks = [
    { name: 'Home', href: '/#' },
    { name: 'Services', href: '/#services' },
  ];

  // NOTE: "Allie for Accounts" (#allie) joins this dropdown once PR #7 merges.
  const productLinks = [
    { name: 'Zaplie', href: '/#zapp' },
    { name: 'Zapdesk', href: '/#zapdesk' },
    { name: 'Thyme', href: '/#thyme' },
  ];

  const trailingNavLinks = [{ name: 'Copilots', href: '/#copilots' }];

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

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-gray-300 hover:text-lime-500 transition-colors rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 data-[state=open]:text-lime-500">
                Products
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="bg-gray-900 border-gray-800 text-gray-300"
              >
                {productLinks.map((link) => (
                  <DropdownMenuItem
                    key={link.name}
                    asChild
                    className="focus:bg-gray-800 focus:text-lime-500 cursor-pointer"
                  >
                    <Link href={link.href}>{link.name}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {trailingNavLinks.map((link) => (
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
              className="text-gray-300 hover:text-lime-500 transition-colors"
            >
              <BookOpen className="h-5 w-5" />
            </Link>
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

              {/* Products group */}
              <div>
                <span className="block text-gray-500 text-sm font-medium uppercase tracking-wider py-2">
                  Products
                </span>
                {productLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="block pl-4 text-gray-300 hover:text-lime-500 transition-colors py-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>

              {trailingNavLinks.map((link) => (
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
                <SignInButton className="w-full" />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
