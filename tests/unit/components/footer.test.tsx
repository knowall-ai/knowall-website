import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '@/components/footer';

/**
 * Footer component tests
 *
 * Requirements: contact-us (docs/requirements.yaml)
 */

describe('Footer', () => {
  it('renders the KnowAll logo', () => {
    render(<Footer />);

    expect(screen.getByAltText('KnowAll.ai')).toBeInTheDocument();
  });

  it('renders the company description', () => {
    render(<Footer />);

    expect(
      screen.getByText(/AI consultancy specializing in agent development/)
    ).toBeInTheDocument();
  });

  it('renders service links pointing at page sections', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'AI Consultancy' })).toHaveAttribute(
      'href',
      '/#services'
    );
    expect(screen.getByRole('link', { name: 'Microsoft Copilots' })).toHaveAttribute(
      'href',
      '/#copilots'
    );
    expect(screen.getByRole('link', { name: 'Bitcoin Integration' })).toHaveAttribute(
      'href',
      '/#zapp'
    );
  });

  it('renders the contact email address', () => {
    render(<Footer />);

    expect(screen.getByText('hello@knowall.ai')).toBeInTheDocument();
  });

  it('renders social links that open in a new tab safely', () => {
    render(<Footer />);

    const github = screen.getByRole('link', { name: 'GitHub' });
    expect(github).toHaveAttribute('href', 'https://github.com/knowall-ai');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');

    expect(screen.getByRole('link', { name: 'Twitter' })).toHaveAttribute(
      'href',
      'https://x.com/KnowAllAI'
    );
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      expect.stringContaining('linkedin.com')
    );
  });

  it('renders the copyright notice', () => {
    render(<Footer />);

    expect(screen.getByText(/KnowAll AI Ltd\. All rights reserved\./)).toBeInTheDocument();
  });
});
