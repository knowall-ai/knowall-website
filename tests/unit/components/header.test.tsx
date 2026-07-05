import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '@/components/header';
import { NostrAuthProvider } from '@/components/auth/nostr-auth-provider';
import { ContactPanelProvider } from '@/components/contact-panel';

/**
 * Header component tests
 *
 * Requirements: primary-navigation, responsive-design, contact-us
 * (docs/requirements.yaml)
 *
 * The header depends on the Nostr auth context (Sign In button) and the
 * contact panel context (mail icon), so it is rendered inside both providers
 * — the same nesting as app/layout.tsx.
 */

function renderHeader() {
  return render(
    <NostrAuthProvider>
      <ContactPanelProvider>
        <Header />
      </ContactPanelProvider>
    </NostrAuthProvider>
  );
}

describe('Header', () => {
  it('renders the logo linking to the top of the page', () => {
    renderHeader();

    const logo = screen.getByAltText('KnowAll.ai');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/#');
  });

  it('renders all primary navigation links', () => {
    renderHeader();

    // Section links are prefixed with '/' so they resolve from other routes too.
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/#');
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/#services');
    expect(screen.getByRole('link', { name: 'Copilots' })).toHaveAttribute('href', '/#copilots');
    // The individual products (Zaplie, Zapdesk, …) now live under a Products dropdown.
    expect(screen.getByRole('button', { name: 'Products' })).toBeInTheDocument();
  });

  it('renders contact mail buttons for desktop and mobile', () => {
    renderHeader();

    // One in the desktop action area, one next to the mobile menu toggle
    expect(screen.getAllByRole('button', { name: 'Contact us' })).toHaveLength(2);
  });

  it('opens the contact panel when the mail button is clicked', () => {
    renderHeader();

    fireEvent.click(screen.getAllByRole('button', { name: 'Contact us' })[0]);

    expect(screen.getByText('Message us')).toBeInTheDocument();
  });

  it('renders a Sign In button when signed out', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders a mobile menu toggle button', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: 'Toggle menu' })).toBeInTheDocument();
  });

  it('opens the mobile menu when the toggle is clicked', () => {
    renderHeader();

    // Only the desktop nav links are rendered initially
    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Sign In' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));

    // The mobile nav duplicates the links (and the Sign In button) when open
    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Sign In' })).toHaveLength(2);
  });

  it('closes the mobile menu when the toggle is clicked again', () => {
    renderHeader();

    const toggle = screen.getByRole('button', { name: 'Toggle menu' });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(1);
  });

  it('closes the mobile menu when a navigation link is clicked', () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    const mobileLinks = screen.getAllByRole('link', { name: 'Services' });
    fireEvent.click(mobileLinks[1]);

    expect(screen.getAllByRole('link', { name: 'Services' })).toHaveLength(1);
  });
});
