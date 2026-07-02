import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '@/components/header';

/**
 * Header component tests
 *
 * Requirements: primary-navigation, responsive-design (docs/requirements.yaml)
 */

describe('Header', () => {
  it('renders the logo linking to the top of the page', () => {
    render(<Header />);

    const logo = screen.getByAltText('KnowAll.ai');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '#');
  });

  it('renders all primary navigation links', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '#');
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '#services');
    expect(screen.getByRole('link', { name: 'Zapp.ie' })).toHaveAttribute('href', '#zapp');
    expect(screen.getByRole('link', { name: 'Copilots' })).toHaveAttribute('href', '#copilots');
  });

  it('renders a Contact Us call to action linking to the contact section', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '#contact');
  });

  it('renders a mobile menu toggle button', () => {
    render(<Header />);

    expect(screen.getByRole('button', { name: 'Toggle menu' })).toBeInTheDocument();
  });

  it('opens the mobile menu when the toggle is clicked', () => {
    render(<Header />);

    // Only the desktop nav links are rendered initially
    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));

    // The mobile nav duplicates the links when open
    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Contact Us' })).toHaveLength(2);
  });

  it('closes the mobile menu when the toggle is clicked again', () => {
    render(<Header />);

    const toggle = screen.getByRole('button', { name: 'Toggle menu' });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(1);
  });

  it('closes the mobile menu when a navigation link is clicked', () => {
    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    const mobileLinks = screen.getAllByRole('link', { name: 'Services' });
    fireEvent.click(mobileLinks[1]);

    expect(screen.getAllByRole('link', { name: 'Services' })).toHaveLength(1);
  });
});
