'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, Mail, Menu, ShoppingBag, ShoppingCart, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Logo from '@/components/logo';
import SignInButton from '@/components/auth/sign-in-button';
import { CartDrawer } from '@/components/checkout/cart-drawer';
import { useContactPanel } from '@/components/contact-panel';
import { useCart } from '@/hooks/use-cart';

/** Header cart button: opens the drawer; badge shows the item count. */
function CartButton() {
  const { totalItems, setIsOpen } = useCart();
  return (
    <button
      onClick={() => setIsOpen(true)}
      aria-label={`Cart${totalItems > 0 ? ` (${totalItems} items)` : ''}`}
      title="Cart"
      className="relative flex flex-col items-center gap-0.5 text-gray-300 hover:text-lime-500 transition-colors"
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      <span className="text-[10px] text-gray-400">Cart</span>
      {totalItems > 0 && (
        <span
          data-testid="cart-count"
          className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-500 px-1 text-[10px] font-semibold text-black"
        >
          {totalItems}
        </span>
      )}
    </button>
  );
}

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
    { name: 'Team', href: '/#team' },
  ];

  // NOTE: "Allie for Accounts" (#allie) joins this dropdown once PR #7 merges.
  const productLinks = [
    { name: 'Zaplie', href: '/#zaplie' },
    { name: 'Zapdesk', href: '/#zapdesk' },
    { name: 'Thyme', href: '/#thyme' },
    { name: 'T-Minus-15', href: '/#tminus15' },
    { name: 'Sallie for Sales', href: '/#sallie' },
  ];

  const trailingNavLinks = [{ name: 'Copilots', href: '/#copilots' }];

  // Next 16 no longer resets scroll to the top for the empty '/#' hash (section
  // hashes like '/#services' still scroll to their element). Scroll to the top
  // explicitly when a '/#' link is clicked while already on the homepage.
  const handleTopLink = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Only handle a plain primary-button click on a '/#' link while already on
    // the homepage. Let the browser deal with modified/non-primary clicks
    // (Cmd/Ctrl/Shift-click, middle-click → open in new tab, etc.).
    if (
      href !== '/#' ||
      window.location.pathname !== '/' ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    // Clear any stale section hash (e.g. '#services') from the URL so a
    // refresh stays at the top rather than jumping back to the old section.
    window.history.replaceState(null, '', '/');
  };

  return (
    <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-xs border-b border-gray-800">
      <div className="container max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/#" className="flex items-center" onClick={handleTopLink('/#')}>
            <Logo darkBackground={true} className="h-12" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={handleTopLink(link.href)}
                className="text-gray-300 hover:text-lime-500 transition-colors"
              >
                {link.name}
              </Link>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-gray-300 hover:text-lime-500 transition-colors rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 data-[state=open]:text-lime-500">
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
              className="flex flex-col items-center gap-0.5 text-gray-300 hover:text-lime-500 transition-colors"
            >
              <BookOpen className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] text-gray-400">Our Story</span>
            </Link>
            <Link
              href="/shop"
              aria-label="Shop"
              title="Shop"
              className="flex flex-col items-center gap-0.5 text-gray-300 hover:text-lime-500 transition-colors"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] text-gray-400">Shop</span>
            </Link>
            <CartButton />
            <button
              onClick={() => openContactPanel()}
              aria-label="Message"
              title="Message"
              className="flex flex-col items-center gap-0.5 text-gray-300 hover:text-lime-500 transition-colors"
            >
              <Mail className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] text-gray-400">Message</span>
            </button>
            <SignInButton />
          </div>

          {/* Mobile Cart + Contact + Menu Buttons */}
          <div className="md:hidden flex items-center gap-4">
            <CartButton />
            <button
              onClick={() => openContactPanel()}
              aria-label="Message"
              title="Message"
              className="flex flex-col items-center gap-0.5 text-gray-300 hover:text-lime-500 transition-colors"
            >
              <Mail className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] text-gray-400">Message</span>
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
                  onClick={(e) => {
                    handleTopLink(link.href)(e);
                    setIsMenuOpen(false);
                  }}
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
                <BookOpen className="h-5 w-5" aria-hidden="true" />
                Our Story
              </Link>
              <Link
                href="/shop"
                aria-label="Shop"
                className="flex items-center gap-2 text-gray-300 hover:text-lime-500 transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                Shop
              </Link>
              <div className="pt-2">
                <SignInButton className="w-full" />
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Global cart drawer (and its checkout dialog) — one instance per page. */}
      <CartDrawer />
    </header>
  );
}
